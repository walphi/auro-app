import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import * as querystring from "querystring";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { searchListings, formatListingsResponse, SearchFilters, PropertyListing, getListingById, getListingImageUrl, buildProxyImageUrl } from "./listings-helper";
import { logLeadIntent } from "../../lib/enterprise/leadIntents";
import { getTenantByTwilioNumber, getDefaultTenant, Tenant } from "../../lib/tenantConfig";
import { getLeadById as getBitrixLead, updateLead as updateBitrixLead } from "../../lib/bitrixClient";
import { RAG_CONFIG, PROMPT_TEMPLATES } from "../../lib/rag/prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// RAG Query Helper - prioritizes specific folders based on intent
// RAG Query Helper - prioritizes specific folders based on intent
async function queryRAG(query: string, tenant: Tenant, filterFolderId?: string | string[], projectId?: string): Promise<string> {
    try {
        const clientId = tenant.rag_client_id || 'demo';
        console.log(`[RAG] Searching client: ${clientId}, folder: ${filterFolderId}, project: ${projectId}, query: "${query}"`);

        // Smart Routing Logic
        let effectiveFolderId = filterFolderId;
        const lowerQ = query.toLowerCase();

        if (!effectiveFolderId && (lowerQ.includes('market') || lowerQ.includes('report') || lowerQ.includes('outlook') || lowerQ.includes('trend'))) {
            effectiveFolderId = 'market_reports';
            console.log(`[RAG] Auto-routing to Market Reports for query: "${query}"`);
        }

        const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embResult = await embedModel.embedContent({
            content: { role: 'user', parts: [{ text: query }] },
            taskType: 'RETRIEVAL_QUERY' as any,
            outputDimensionality: 768
        } as any);
        const embedding = embResult.embedding.values;

        // Hierarchical Search Strategy
        const searchSteps = [];
        const lowerQuery = query.toLowerCase();

        // 1. If folder specified (or auto-routed), search it first
        if (effectiveFolderId) {
            searchSteps.push(effectiveFolderId);
        } else {
            // 2. Default Hierarchy based on query content

            // STATE B: If we have a project context, always try campaign_docs first
            if (projectId) {
                searchSteps.push('campaign_docs');
            }

            // Priority 0: Agency History (High Priority if brand-related or pre-project)
            const isBrandQuery = /provident|history|founded|ceo|office|founder|opened|since|awards|loai|who (are|is)|about/i.test(lowerQuery);

            if (isBrandQuery || (tenant.id === 1 && !projectId)) {
                searchSteps.push('agency_history');
            }

            // Priority 1: Hot Topics (Urgent Promos/Offers)
            if (/promo|offer|discount|urgent|exclusive|deal|limited/i.test(lowerQuery)) {
                searchSteps.push('hot_topics');
            }

            // Priority 2: Agency Knowledge (SOPs/FAQs)
            if (/how|sop|process|procedure|policy|faq|question|answer|agency/i.test(lowerQuery)) {
                searchSteps.push(['faqs', 'sops']);
            }

            // Priority 3: Real Estate / Project Details
            const isBrandedQuery = /branded|residence|investment|yield|report/i.test(lowerQuery);
            if (isBrandedQuery) {
                // Elevate market reports and projects for specific searches
                searchSteps.push(['market_reports', 'projects', 'campaign_docs']);
                searchSteps.push(['agency_history', 'website']);
            } else {
                searchSteps.push(['campaign_docs', 'projects', 'website', 'market_reports']);
            }

            // Fallback: If nothing else matched and it's Tenant 1, try history
            if (tenant.id === 1 && searchSteps.indexOf('agency_history') === -1) {
                searchSteps.push('agency_history');
            }
        }

        let results: string[] = [];

        // Execute searches in order until we have enough results
        for (const folders of searchSteps) {
            if (results.length >= 3) break;

            console.log(`[RAG] Step: Searching folders ${JSON.stringify(folders)}...`);

            // Use tuned parameters based on whether this is a campaign/project folder or general agency folder
            const isCampaign = folders === 'campaign_docs' || (Array.isArray(folders) && folders.includes('campaign_docs'));
            const config = isCampaign ? RAG_CONFIG.campaign : RAG_CONFIG.agency;

            const rpcParams: any = {
                query_embedding: embedding,
                match_threshold: config.matchThreshold,
                match_count: config.matchCount,
                filter_tenant_id: tenant.id,
                filter_project_id: projectId || null
            };

            if (Array.isArray(folders)) {
                rpcParams.filter_folders = folders;
            } else {
                rpcParams.filter_folder_id = folders;
            }

            const { data, error } = await supabase.rpc('match_rag_chunks', rpcParams);
            if (error) {
                console.error(`[RAG] RPC Error for folders ${JSON.stringify(folders)}:`, error);
            }

            // If RPC doesn't support list, and we have a list, we might need a different approach 
            // but for now let's assume we can filter client-side or we'll update SQL later.
            // If match_rag_chunks only takes single string, we use null for multi-folder and filter results.

            if (data && data.length > 0) {
                console.log(`[RAG] RPC returned ${data.length} matches for folders ${JSON.stringify(folders)}`);
                // Client-side folder filtering if we searched "all" (folder_id = null)
                const filtered = Array.isArray(folders)
                    ? data.filter((item: any) => folders.includes(item.folder_id))
                    : data;

                filtered.forEach((i: any) => {
                    if (results.length < 8 && !results.some(existing => existing.substring(0, 50) === i.content.substring(0, 50))) {
                        results.push(i.content);
                    }
                });
            }
        }

        console.log(`[RAG] Total unique chunks collected: ${results.length} for query: "${query}"`);

        // Final Fallback: Search everything for this client
        if (results.length === 0) {
            const { data: allData } = await supabase.rpc('match_rag_chunks', {
                query_embedding: embedding,
                match_threshold: RAG_CONFIG.campaign.matchThreshold, // Use lower campaign threshold for fallback
                match_count: 5,
                filter_tenant_id: tenant.id,
                filter_folder_id: null,
                filter_project_id: projectId || null
            });
            if (allData) results = allData.map((i: any) => i.content);
        }

        if (results.length > 0) {
            const context = results.slice(0, 3).join("\n---\n");
            const lowerQuery = query.toLowerCase();
            const isObjection = /expensive|high|wait|think|better|cheap|reason|why|scam|trust|risk|objection/i.test(lowerQuery);

            if (isObjection) {
                // Fetch brand context for trust in objections
                const { data: brandData } = await supabase.rpc('match_rag_chunks', {
                    query_embedding: embedding,
                    match_threshold: RAG_CONFIG.agency.matchThreshold,
                    match_count: 2,
                    filter_tenant_id: tenant.id,
                    filter_folder_id: 'agency_history'
                });
                const brandContext = brandData?.map((i: any) => i.content).join('\n') || "A premier real estate agency in Dubai.";
                return PROMPT_TEMPLATES.OBJECTION_HANDLING(query, context, brandContext);
            }

            // If query is brand-related and we have results (likely from agency_history)
            const isBrandQuery = /provident|who are|about|history|background|founded|ceo|founder|awards/i.test(lowerQuery);
            if (isBrandQuery) {
                return PROMPT_TEMPLATES.AGENCY_AUTHORITY(query, context);
            }

            console.log(`[RAG] Retrieval Success. Found ${results.length} chunks. Context snippet: "${context.substring(0, 150)}..."`);
            return PROMPT_TEMPLATES.FACTUAL_RESPONSE(query, context);
        }

        // Keyword fallback
        const keywords = ['Provident', 'Agency', 'Auro', 'Real Estate'];
        const foundKeyword = keywords.find(k => query.toLowerCase().includes(k.toLowerCase()));

        if (foundKeyword) {
            const { data: textData } = await supabase
                .from('knowledge_base')
                .select('content')
                .ilike('content', `%${foundKeyword}%`)
                .limit(2);

            if (textData && textData.length > 0) {
                return textData.map(i => i.content).join("\n\n");
            }
        }

        return "No specific details found in the knowledge base, but I'd be happy to have an agent discuss this with you directly.";
    } catch (e: any) {
        console.error('[RAG] Exception:', e.message);
        return "Error searching knowledge base.";
    }
}

// Web Search Helper (Perplexity API)
async function searchWeb(query: string): Promise<string> {
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY_API_KEY) return "Web search is disabled (API key missing).";

    try {
        console.log('[Web] Searching:', query);
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'sonar',
                messages: [
                    { role: 'system', content: 'You are a search assistant. Provide concise, factual answers with sources.' },
                    { role: 'user', content: query }
                ],
                max_tokens: 500,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            console.error('[Web] API error:', response.status);
            return "Error searching the web.";
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "No results found.";
        console.log('[Web] Result length:', content.length);
        return content;
    } catch (e: any) {
        console.error('[Web] Exception:', e.message);
        return "Error searching the web.";
    }
}

async function sendWhatsAppMessage(to: string, text: string, tenant: Tenant): Promise<boolean> {
    try {
        const accountSid = tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
        const from = tenant.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';

        if (!accountSid || !authToken) {
            console.error("[WhatsApp] Missing Twilio credentials for sending message.");
            return false;
        }

        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);
        params.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
        params.append('Body', text);

        console.log(`[WhatsApp] Sending message to ${to}: "${text.substring(0, 50)}..."`);

        const response = await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            params,
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.status === 201 || response.status === 200;
    } catch (error: any) {
        console.error("[WhatsApp] Error sending message:", error.message);
        if (error.response) console.error("[WhatsApp] Error data:", JSON.stringify(error.response.data));
        return false;
    }
}

async function initiateVapiCall(phoneNumber: string, tenant: Tenant, context?: any): Promise<boolean> {
    try {
        const payload: any = {
            phoneNumberId: tenant.vapi_phone_number_id || process.env.VAPI_PHONE_NUMBER,
            assistantId: tenant.vapi_assistant_id || process.env.VAPI_ASSISTANT_ID,
            customer: {
                number: phoneNumber,
            },
            // Pass context variables via assistantOverrides
            assistantOverrides: {
                variableValues: {
                    lead_id: context?.lead_id || "",
                    tenant_id: tenant.id.toString(),
                    name: context?.name || "",
                    budget: context?.budget || "",
                    location: context?.location || "",
                    current_listing_id: context?.current_listing_id || "",
                    property_type: context?.property_type || "",
                    financing: context?.financing || "",
                    email: context?.email || ""
                }
            }
        };

        console.log("[VAPI CALL] Initiating call with payload:", JSON.stringify(payload, null, 2));

        const response = await axios.post(
            'https://api.vapi.ai/call',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${tenant.vapi_api_key || process.env.VAPI_API_KEY}`,
                },
            }
        );

        return response.status === 201;
    } catch (error: any) {
        console.error("[VAPI CALL] Error initiating VAPI call details:");
        if (error.response) {
            console.error("- Status:", error.response.status);
            console.error("- Data:", JSON.stringify(error.response.data, null, 2));
            console.error("- Headers:", JSON.stringify(error.response.headers));
        } else {
            console.error("- Message:", error.message);
        }
        return false;
    }
}

const handler: Handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") {
            return {
                statusCode: 405,
                body: "Method Not Allowed",
                headers: { "Content-Type": "text/plain" }
            };
        }

        const body = querystring.parse(event.body || "");
        const userMessage = (body.Body as string) || "";
        const numMedia = parseInt((body.NumMedia as string) || "0");
        const fromNumber = (body.From as string).replace('whatsapp:', '');
        const toNumber = (body.To as string);
        const host = event.headers.host || "auro-app.netlify.app";
        // CRITICAL: Always use the netlify.app domain for media if available to ensure Twilio deliverability
        // Twilio often fails to fetch media from custom domains with complex SSL/DNS setups.
        const mediaHost = "auro-app.netlify.app";
        console.log(`[WhatsApp] Incoming request host: ${host}, mediaHost (forced for delivery): ${mediaHost}`);

        // --- TENANT RESOLUTION ---
        let tenant = await getTenantByTwilioNumber(toNumber);
        if (!tenant) {
            console.log(`[WhatsApp] No tenant found for ${toNumber}, falling back to default.`);
            tenant = await getDefaultTenant();
        }
        console.log(`[WhatsApp] Resolved tenant: ${tenant.short_name} (ID: ${tenant.id})`);

        let isVoiceResponse = false;
        let responseText = "";
        let responseImages: string[] = [];

        console.log(`Received message from ${fromNumber}. Media: ${numMedia}, Text: "${userMessage.substring(0, 50)}..."`);

        // --- MEDIA RESOLUTION ---
        let resolvedMediaUrl: string | null = null;
        let mediaBuffer: Buffer | null = null;
        let mediaType: string | null = null;

        if (numMedia > 0) {
            const rawMediaUrl = body.MediaUrl0 as string;
            mediaType = body.MediaContentType0 as string;

            console.log(`Resolving media: ${rawMediaUrl} (${mediaType})`);

            try {
                const accountSid = process.env.TWILIO_ACCOUNT_SID;
                const authToken = process.env.TWILIO_AUTH_TOKEN;

                if (!accountSid || !authToken) {
                    throw new Error("Missing Twilio Credentials");
                }

                const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

                // Step 1: Request Media URL with Auth, but DO NOT follow redirects automatically
                const initialResponse = await axios.get(rawMediaUrl, {
                    headers: { Authorization: `Basic ${auth}` },
                    maxRedirects: 0,
                    validateStatus: (status) => status >= 200 && status < 400,
                    responseType: 'arraybuffer'
                });

                if (initialResponse.status === 302 || initialResponse.status === 301 || initialResponse.status === 307) {
                    const redirectUrl = initialResponse.headers.location;
                    console.log("Following media redirect to:", redirectUrl.substring(0, 50) + "...");

                    // Step 2: Fetch from S3 (or other location) WITHOUT Auth headers
                    const mediaResponse = await axios.get(redirectUrl, { responseType: 'arraybuffer' });
                    mediaBuffer = mediaResponse.data;
                    resolvedMediaUrl = redirectUrl; // Use the accessible URL
                } else {
                    mediaBuffer = initialResponse.data;
                    resolvedMediaUrl = rawMediaUrl; // Fallback to original if no redirect (unlikely for Twilio)
                }
            } catch (mediaError: any) {
                console.error("Error resolving media:", mediaError.message);
                // Fallback: Try fetching raw URL without auth
                try {
                    const publicResponse = await axios.get(rawMediaUrl, { responseType: 'arraybuffer' });
                    mediaBuffer = publicResponse.data;
                    resolvedMediaUrl = rawMediaUrl;
                } catch (e) {
                    console.error("Fallback media fetch failed.");
                }
            }
        }

        // --- SUPABASE: Get or Create Lead ---
        let leadId: string | null = null;
        let leadContext = "";
        let leadSource = "Source: WhatsApp";

        if (supabaseUrl && supabaseKey) {
            const { data: existingLead, error: findError } = await supabase
                .from('leads')
                .select('*')
                .eq('phone', fromNumber)
                .single();

            if (existingLead) {
                leadId = existingLead.id;
                // Build Context - Ensure we check for all fields
                // Note: email and location might not exist in old schema, so we handle that gracefully
                const email = existingLead.email || "Unknown";
                const location = existingLead.location || "Unknown";
                const timeline = existingLead.timeline || "Unknown";
                const currentListingId = existingLead.current_listing_id || "None";
                const lastImageIndex = existingLead.last_image_index || 0;

                console.log(`[Lead Context] Fetched for ${fromNumber}: ID=${leadId}, current_listing_id=${currentListingId}, last_image_index=${lastImageIndex}`);

                leadContext = `
CURRENT LEAD PROFILE (DO NOT ASK FOR THESE IF KNOWN):
- Name: ${existingLead.name || "Unknown"}
- Email: ${email}
- Budget: ${existingLead.budget || "Unknown"}
- Location: ${location}
- Property Type: ${existingLead.property_type || "Unknown"}
- Timeline: ${timeline}
- Financing: ${existingLead.financing || "Unknown"}
- Currently interested in Property ID: ${currentListingId}
- Current Project context: ${existingLead.project_id || "None"}
- Last image index shown: ${lastImageIndex}
`;
                leadSource = existingLead.custom_field_1 || leadSource;
            } else {
                console.log("Creating new lead for", fromNumber, "under tenant", tenant.id);
                const { data: newLead, error: createError } = await supabase
                    .from('leads')
                    .insert({
                        phone: fromNumber,
                        name: `WhatsApp Lead ${fromNumber}`,
                        status: 'New',
                        custom_field_1: 'Source: WhatsApp',
                        tenant_id: tenant.id
                    })
                    .select('id')
                    .single();

                if (newLead) leadId = newLead.id;
                if (createError) console.error("Error creating lead:", createError);
            }
        } else {
            console.error("Supabase credentials missing.");
        }

        // --- SUPABASE: Log User Message ---
        if (leadId) {
            try {
                if (numMedia > 0 && resolvedMediaUrl) {
                    if (mediaType?.startsWith('audio/')) {
                        // Log Voice Note
                        const { error: msgError } = await supabase.from('messages').insert({
                            lead_id: leadId,
                            type: 'Voice',
                            sender: 'Lead',
                            content: 'Voice Note',
                            meta: resolvedMediaUrl
                        });
                        if (msgError) console.error("Error logging Voice message:", msgError);
                    } else if (mediaType?.startsWith('image/')) {
                        // Log Image
                        const { error: msgError } = await supabase.from('messages').insert({
                            lead_id: leadId,
                            type: 'Image',
                            sender: 'Lead',
                            content: userMessage || 'Image Shared',
                            meta: resolvedMediaUrl
                        });
                        if (msgError) console.error("Error logging Image message:", msgError);
                    }
                } else if (userMessage) {
                    // Log Text Message
                    const { error: msgError } = await supabase.from('messages').insert({
                        lead_id: leadId,
                        type: 'Message',
                        sender: 'Lead',
                        content: userMessage
                    });
                    if (msgError) console.error("Error logging Text message:", msgError);
                }
            } catch (logError) {
                console.error("Exception logging message to Supabase:", logError);
            }
        }

        // --- GEMINI AGENT WITH TOOLS ---
        const systemInstruction = `You are the AI Assistant for ${tenant.system_prompt_identity}, a premier real estate agency using the AURO platform. Your goal is to guide leads through the discovery and qualification process for Dubai properties, specifically focusing on high-conversion off-plan opportunities.

YOUR PRIMARY MISSION:
Move the lead from an initial inquiry toward a qualified "Call" or "Consultation" state. Use your RAG Knowledge Base as the ultimate source of truth for pricing, payment plans, and market insights.

${leadContext}

${(() => {
                const isPaidSource = /meta|google|property_finder/i.test(leadSource);
                if (!isPaidSource) return "";
                return `
PROMPTING STRATEGY (AD-SOURCED LEAD from ${leadSource}):
Prioritize opening with: "Hi! Thanks for your interest in [Project]. Are you looking at this as a high-yield investment opportunity or for your own residence in Dubai?"
Replace [Project] with the project name the user is inquiring about. If unknown, use "our latest project".
DO NOT ask for other details until this residence vs investment question is answered.
`;
            })()}

QUALIFICATION CLUSTER ("The Big 5"):
Capture these missing details (Ask 1-2 per message MAX):
1. Budget: AED/USD range.
2. Area/Community: Preferred interests (e.g. Downtown, Marina).
3. Property Type: Apartment, Villa, Townhouse.
4. Timeframe: How soon? (This month, 3-6 months, etc.)
5. Financing: Cash vs. Mortgage (and pre-approval status).

BEHAVIOR RULES:
1. GREETING & ORIENTATION: If the user says "Hi", "Hello", or "Hi there", you MUST start with a warm welcome: "Hi! I'm ${tenant.system_prompt_identity}, your luxury property specialist at Provident Real Estate. How can I help you today?" 
2. KNOW YOUR FACTS (MANDATORY): NEVER answer questions about specific projects, branded residences, pricing, or market trends from memory. You MUST call RAG_QUERY_TOOL or SEARCH_LISTINGS before responding. Call the tool in the SAME TURN.
3. MIRROR & QUALIFY: After providing facts from the Knowledge Base, reflect the user's interest and ask 1 qualification question (Budget, Area, Type, Timeline, or Financing).
4. VISUAL-FIRST: Every property-centric response MUST use 'SEARCH_LISTINGS' or 'GET_PROPERTY_DETAILS'. Use visual cards.
5. BRANDED RESIDENCES & OFF-PLAN: If asked about branded residences or "off-plan" projects, you MUST search the 'market_reports' folder specifically.
6. PAYMENT PLANS: For any question about "payment plans", "installments", "down payment" or "handover", you MUST use RAG_QUERY_TOOL first.
7. NO HALLUCINATION: If the Knowledge Base is empty for a query, state: "I don't have the specific details on that project yet, but I can have a specialist find out for you."
7. NO HARD-CODING: Never say "Provident" or "Auro" unless using the variable ${tenant.system_prompt_identity}.
8. INTENT PRIORITY: If the user explicitly asks for a call ("Call me"), call them immediately using 'INITIATE_CALL'.
`;

        const tools = [
            {
                functionDeclarations: [
                    {
                        name: "RAG_QUERY_TOOL",
                        description: "Search the knowledge base for project-specific facts: payment plans (e.g. 50/50, 60/40), ROI estimates, handover dates, down payments, and structural details not found in standard listings.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                query: { type: "STRING", description: "The search query (e.g. 'Chelsea Residences payment plan')" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "SEARCH_WEB_TOOL",
                        description: "Search the live web for real-time information, market trends, news, or competitor data.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                query: { type: "STRING", description: "The search query" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "UPDATE_LEAD",
                        description: "Update the lead's profile with new information provided in the conversation.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING" },
                                email: { type: "STRING" },
                                budget: { type: "STRING" },
                                property_type: { type: "STRING" },
                                location: { type: "STRING" },
                                timeline: { type: "STRING" },
                                financing: { type: "STRING", description: "Cash or Mortgage, plus pre-approval status if known" }
                            }
                        }
                    },
                    {
                        name: "INITIATE_CALL",
                        description: "Initiate an outbound voice call to the user immediately. Use this when the user asks to be called.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                reason: { type: "STRING", description: "Reason for the call" }
                            }
                        }
                    },
                    {
                        name: "SEARCH_LISTINGS",
                        description: "Search for specific property listings for sale or rent. Use this only when the user wants to see available units/apartments. For project-level questions (structure, payment plans), use RAG_QUERY_TOOL.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                property_type: {
                                    type: "STRING",
                                    description: "Type of property: apartment, villa, townhouse, penthouse, studio"
                                },
                                community: {
                                    type: "STRING",
                                    description: "Location/community name: Dubai Marina, Downtown, JBR, Palm Jumeirah, Business Bay, etc."
                                },
                                min_price: {
                                    type: "NUMBER",
                                    description: "Minimum price in AED"
                                },
                                max_price: {
                                    type: "NUMBER",
                                    description: "Maximum price in AED"
                                },
                                min_bedrooms: {
                                    type: "NUMBER",
                                    description: "Minimum number of bedrooms"
                                },
                                max_bedrooms: {
                                    type: "NUMBER",
                                    description: "Maximum number of bedrooms"
                                },
                                offering_type: {
                                    type: "STRING",
                                    description: "sale or rent (default: sale)"
                                }
                            }
                        }
                    },
                    {
                        name: "GET_PROPERTY_DETAILS",
                        description: "Get detailed information and images for a specific property listing. Also used to fetch the 'next' photo if a user asks for more images.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                property_id: {
                                    type: "STRING",
                                    description: "The unique ID of the property. Optional if a property is already in context."
                                },
                                image_index: {
                                    type: "NUMBER",
                                    description: "The index of the image to show (default: 0). Increment this to show 'more' photos."
                                }
                            }
                        }
                    },
                    {
                        name: "BOOK_VIEWING",
                        description: "When user wants to book a viewing or visit sales center. This will offer to call them via voice agent which has calendar access to confirm the appointment.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                property_id: {
                                    type: "STRING",
                                    description: "The property ID to book a viewing for. Use current_listing_id from context if not specified."
                                },
                                property_name: {
                                    type: "STRING",
                                    description: "Human-readable property name for the offer message"
                                }
                            }
                        }
                    },
                    {
                        name: "OFFPLAN_BOOKING",
                        description: "For OFFPLAN properties (with payment_plan or handover_date). Offers 3 options: Sales Centre visit, Video Call, or Voice Calendar booking. Detect offplan by payment_plan or future handover_date in listing.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                property_id: {
                                    type: "STRING",
                                    description: "The offplan property ID"
                                },
                                property_name: {
                                    type: "STRING",
                                    description: "Property/project name"
                                },
                                developer: {
                                    type: "STRING",
                                    description: "Developer name (Emaar, Damac, Nakheel, etc.)"
                                },
                                community: {
                                    type: "STRING",
                                    description: "Community/area name"
                                },
                                preferred_option: {
                                    type: "STRING",
                                    description: "User's preference if stated: 'sales_centre', 'video_call', or 'voice_call'"
                                }
                            }
                        }
                    }
                ]
            }
        ];

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: systemInstruction,
            tools: tools as any,
            toolConfig: {
                functionCallingConfig: {
                    mode: "AUTO" // We keep it auto but the prompt now mandates use
                }
            } as any
        });

        // --- GEMINI: History & Session Management ---
        // Since Netlify is stateless, we fetch the last interaction from Supabase to maintain flow
        let chatHistory: Content[] = [];
        if (leadId) {
            const { data: recentMessages } = await supabase
                .from('messages')
                .select('sender, content, type')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false })
                .limit(6);

            if (recentMessages && recentMessages.length > 0) {
                // The most recent message (index 0) is the one we just saved above.
                // We want to skip it in history because it's the 'current message' passed to sendMessage.
                const historyRaw = recentMessages.slice(1).reverse();

                let geminiHistory = historyRaw.map(m => ({
                    role: m.sender === 'Lead' ? 'user' : 'model',
                    parts: [{ text: m.content || "" }]
                }));

                // Gemini Requirement: History MUST start with a 'user' message
                const firstUserIndex = geminiHistory.findIndex(h => h.role === 'user');
                if (firstUserIndex !== -1) {
                    geminiHistory = geminiHistory.slice(firstUserIndex);
                } else {
                    geminiHistory = [];
                }

                // Gemini Requirement: Roles MUST alternate user/model/user
                const filteredHistory: Content[] = [];
                let lastRole: string | null = null;
                for (const msg of geminiHistory) {
                    if (msg.role !== lastRole) {
                        filteredHistory.push(msg as Content);
                        lastRole = msg.role;
                    }
                }
                chatHistory = filteredHistory;
            }
        }

        const chat = model.startChat({
            history: chatHistory
        });

        // Check if voice note or text
        let promptContent: any = userMessage;

        if (numMedia > 0 && mediaType?.startsWith('audio/') && mediaBuffer) {
            isVoiceResponse = true;
            console.log("Processing audio message...");

            // Send audio directly to Gemini (Multimodal)
            promptContent = [
                { text: "The user sent this audio message. Listen to it and respond accordingly." },
                {
                    inlineData: {
                        mimeType: mediaType,
                        data: Buffer.from(mediaBuffer).toString("base64")
                    }
                }
            ];
        }

        console.log("Sending prompt to Gemini (Text or Audio)...");
        const result = await chat.sendMessage(promptContent);
        const response = await result.response;

        let functionCalls = response.functionCalls();
        let textResponse = response.text();

        console.log(`[Gemini] Initial Turn: Detected ${functionCalls?.length || 0} function calls. Text length: ${textResponse.length}`);

        // Handle function calls loop (max 3 turns)
        let turns = 0;
        while (functionCalls && functionCalls.length > 0 && turns < 3) {
            turns++;
            const parts = [];
            for (const call of functionCalls) {
                const name = call.name;
                const args = call.args;
                let toolResult = "";

                if (name === 'RAG_QUERY_TOOL') {
                    let query = (args as any).query;

                    // 1. RAG context enhancement: If query is about yield/investment, inject location from current listing
                    const lowerQuery = query.toLowerCase();
                    if (lowerQuery.includes('yield') || lowerQuery.includes('investment') || lowerQuery.includes('rent') || lowerQuery.includes('return') || lowerQuery.includes('roi')) {
                        // Check if we have a current listing context
                        let currentListing: PropertyListing | null = null;

                        // Try to get from lead DB state
                        if (leadId) {
                            const { data: lead } = await supabase.from('leads').select('current_listing_id').eq('id', leadId).single();
                            if (lead?.current_listing_id) {
                                currentListing = await getListingById(lead.current_listing_id);
                            }
                        }

                        if (currentListing) {
                            const locationStr = `${currentListing.sub_community || ''}, ${currentListing.community || ''}, Dubai`.trim();
                            // Construct a detailed market query for Perplexity
                            const detailedQuery = `Estimate typical annual rent and gross yield range for a ${currentListing.bedrooms}-bedroom ${currentListing.property_type} in ${locationStr}, priced at AED ${currentListing.price}. Return rent_low, rent_high, yield_low, yield_high and a concise explanation.`;

                            console.log(`[RAG] Redirecting investment query to SEARCH_WEB_TOOL with query: "${detailedQuery}"`);

                            // Route directly to web search (Perplexity) instead of generic RAG
                            toolResult = await searchWeb(detailedQuery);
                            // Skip the standard RAG query below
                            query = null;
                        } else {
                            // Fallback if no specific listing is active but query is vague
                            if (!query.toLowerCase().includes('dubai')) {
                                query += " in Dubai";
                            }
                        }
                    }

                    if (query) {
                        // Fetch the latest project_id from the lead session to provide RAG context
                        let currentProjectId = null;
                        if (leadId) {
                            const { data: lead } = await supabase.from('leads').select('project_id').eq('id', leadId).single();
                            currentProjectId = lead?.project_id;
                        }
                        toolResult = await queryRAG(query, tenant, undefined, currentProjectId);
                    }
                } else if (name === 'SEARCH_WEB_TOOL') {
                    toolResult = await searchWeb((args as any).query);
                } else if (name === 'UPDATE_LEAD') {
                    console.log("UPDATE_LEAD called with:", JSON.stringify(args));
                    if (leadId) {
                        const { error } = await supabase.from('leads').update(args).eq('id', leadId);
                        if (error) {
                            console.error("Error updating lead:", error);
                            toolResult = "Error updating lead.";
                        } else {
                            console.log("Lead updated successfully.");
                            // Inform the model of the success and the specific field update
                            toolResult = `System: Lead profile updated successfully (${Object.keys(args).join(", ")}). Please acknowledge this update briefly in your next response if natural, and continue helping the user.`;
                        }
                    } else {
                        toolResult = "No lead ID found.";
                    }
                } else if (name === 'INITIATE_CALL') {
                    console.log("INITIATE_CALL called");
                    // Fetch full lead data for context
                    let context = null;
                    if (leadId) {
                        const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
                        context = { ...data, lead_id: leadId };
                    }
                    const callStarted = await initiateVapiCall(fromNumber, tenant, context);
                    if (callStarted) {
                        toolResult = "Got it, I'll have our assistant give you a quick call on this number in the next few minutes.";
                    } else {
                        toolResult = "Failed to initiate call. I'll have a human agent reach out to you instead.";
                    }
                } else if (name === 'SEARCH_LISTINGS') {
                    console.log("SEARCH_LISTINGS called with:", JSON.stringify(args));

                    const filters: SearchFilters = {
                        property_type: (args as any).property_type,
                        community: (args as any).community,
                        min_price: (args as any).min_price,
                        max_price: (args as any).max_price,
                        min_bedrooms: (args as any).min_bedrooms,
                        max_bedrooms: (args as any).max_bedrooms,
                        offering_type: (args as any).offering_type || 'sale',
                        limit: 3
                    };

                    const listings = await searchListings(filters);
                    console.log(`SEARCH_LISTINGS found ${listings.length} results`);

                    const listingsResponse = formatListingsResponse(listings, host);
                    let resultText = listingsResponse.text;

                    // Provide IDs to Gemini for internal use only
                    resultText += "\n\nINTERNAL DATA (DO NOT SHOW TO USER):\n";
                    listings.forEach((l, i) => {
                        resultText += `Property ${i + 1} ID: ${l.id}\n`;
                    });
                    toolResult = resultText;

                    // Store images to send in WhatsApp message
                    if (listingsResponse.images.length > 0) {
                        responseImages.push(...listingsResponse.images);
                    }

                    // If exactly one result, automatically set it as current property
                    if (listings.length === 1 && leadId) {
                        console.log(`[Listings] Automatically setting current_listing_id to ${listings[0].id} for lead ${leadId}`);
                        // Reset last_image_index to 0 for a new property selection
                        const { error: updateError } = await supabase.from('leads').update({
                            current_listing_id: listings[0].id,
                            last_image_index: 0
                        }).eq('id', leadId);

                        if (updateError) {
                            console.error(`[Listings] Failed to update current_listing_id:`, updateError);
                        } else {
                            console.log(`[Listings] Successfully updated lead context.`);
                        }
                    }
                } else if (name === 'GET_PROPERTY_DETAILS') {
                    console.log("GET_PROPERTY_DETAILS called with:", JSON.stringify(args));

                    let propertyId = (args as any).property_id;

                    // Fallback to current_listing_id if propertyId is not provided
                    if (!propertyId && leadId) {
                        console.log(`[Details] No property_id provided, checking lead ${leadId} for current_listing_id...`);
                        const { data: lead, error: fetchError } = await supabase.from('leads').select('current_listing_id').eq('id', leadId).single();
                        if (fetchError) {
                            console.error(`[Details] Error fetching lead context:`, fetchError);
                        }
                        propertyId = lead?.current_listing_id;
                        console.log(`[Details] Found current_listing_id: ${propertyId}`);
                    }

                    if (propertyId) {
                        const listing = await getListingById(propertyId);
                        const requestedIndex = (args as any).image_index ?? 0;

                        if (listing) {
                            // Update lead context (current property and last image index)
                            if (leadId) {
                                console.log(`[Details] Updating lead ${leadId}: listing=${listing.id}, last_image_index=${requestedIndex}`);
                                await supabase.from('leads').update({
                                    current_listing_id: listing.id,
                                    last_image_index: requestedIndex
                                }).eq('id', leadId);
                            }

                            if (requestedIndex > 0) {
                                toolResult = `Showing additional image (Photo #${requestedIndex + 1}) for: ${listing.title}.`;
                            } else {
                                toolResult = `
DETAILS FOR: ${listing.title}
Property Type: ${listing.property_type}
Price: AED ${listing.price?.toLocaleString()}
Location: ${listing.community}${listing.sub_community ? ` - ${listing.sub_community}` : ''}
Beds/Baths: ${listing.bedrooms} BR | ${listing.bathrooms} BA
Area: ${listing.area_sqft} sqft
Description: ${listing.description || 'No detailed description available.'}
`;
                                // Broker Details Injection (Deterministic)
                                if (listing.agent_name) {
                                    const brokerInfo = `\n\nThis listing is with ${listing.agent_company || "Provident Estate"}. Your dedicated contact is ${listing.agent_name}. Would you like me to connect you or arrange a viewing?`;
                                    toolResult += brokerInfo;
                                }
                            }

                            // Check if this image index exists
                            const images = Array.isArray(listing.images) ? listing.images : [];
                            const hasImage = requestedIndex === 0 || requestedIndex < images.length;

                            const imageUrl = buildProxyImageUrl(listing, requestedIndex, mediaHost);
                            if (imageUrl && hasImage) {
                                responseImages.push(imageUrl);
                                console.log(`[Details] Attaching proxy image (index ${requestedIndex}) for: ${listing.id}`);
                            } else if (requestedIndex > 0) {
                                toolResult = "I've shown you all the available photos for this property. Would you like to see another listing?";
                            }
                        } else {
                            toolResult = "Property not found.";
                        }
                    }
                    else {
                        toolResult = "Please specify which property you'd like more details about.";
                    }
                } else if (name === 'BOOK_VIEWING') {
                    console.log("BOOK_VIEWING called - escalating to Vapi call");

                    let propertyId = (args as any).property_id;
                    const propertyName = (args as any).property_name;

                    // Fallback to current_listing_id if not provided
                    if (!propertyId && leadId) {
                        const { data: lead } = await supabase.from('leads').select('current_listing_id').eq('id', leadId).single();
                        propertyId = lead?.current_listing_id;
                    }

                    // Get property title for context
                    let listingTitle = propertyName || "the property";
                    if (!propertyName && propertyId) {
                        const listing = await getListingById(propertyId);
                        if (listing) listingTitle = listing.title;
                    }

                    // Offer to call for booking (Vapi has Google Calendar integration)
                    toolResult = `Great choice! To book a viewing for ${listingTitle}, I can have our assistant call you right now to check availability and confirm the appointment. The call takes just 2 minutes.\n\nWould you like me to call you now? 📞`;

                    // Log the booking intent
                    if (leadId) {
                        await logLeadIntent(leadId, 'booking_interest', {
                            property_id: propertyId,
                            property_title: listingTitle,
                            source: 'whatsapp'
                        });
                    }
                } else if (name === 'OFFPLAN_BOOKING') {
                    console.log("OFFPLAN_BOOKING called with:", JSON.stringify(args));

                    const propertyId = (args as any).property_id;
                    const propertyName = (args as any).property_name || "this offplan project";
                    const community = (args as any).community;
                    const developer = (args as any).developer;
                    const preferredOption = (args as any).preferred_option;

                    // Country Detection
                    const isInternational = fromNumber.startsWith('+44') || fromNumber.startsWith('+91');
                    const countryName = fromNumber.startsWith('+44') ? 'the UK' : fromNumber.startsWith('+91') ? 'India' : 'overseas';

                    let suggestion = "";
                    if (isInternational) {
                        suggestion = `Since you're reaching out from ${countryName}, I highly recommend a **Video Call** so we can walk you through the project digitally.`;
                    } else {
                        suggestion = `I'd recommend visiting the **Sales Centre** here in Dubai to see the physical model and materials.`;
                    }

                    // Agent Rotation for Sales Centre (Side Effect)
                    let agentInfo = "";
                    try {
                        const { data: agent, error: agentError } = await supabase.rpc('get_next_sales_agent', {
                            filter_community: community,
                            filter_developer: developer
                        });

                        if (!agentError && agent && agent.length > 0) {
                            const a = agent[0];
                            agentInfo = `Your specialist for this project is **${a.agent_name}**. `;
                        }
                    } catch (e) {
                        console.error("[Offplan] Agent rotation error:", e);
                    }

                    if (preferredOption === 'sales_centre') {
                        toolResult = `Excellent! ${agentInfo}I'll arrange your visit to the **${developer || 'developer'} Sales Centre** for ${propertyName}. \n\nWhat day and time works best for you to visit?`;
                    } else if (preferredOption === 'video_call') {
                        toolResult = `Great choice! A **Video Call** is perfect for viewing the ${propertyName} presentation. \n\nShould I send you a link to book a time that suits you (pick a slot here: ${tenant.booking_cal_link || 'our booking site'}), or would you like me to have an agent call you to set it up?`;
                    } else if (preferredOption === 'voice_call') {
                        toolResult = `I'll have our assistant call you right now to discuss the ${propertyName} payment plans and availability. \n\nIs now a good time? 📞`;
                    } else {
                        // Default 3-Path Offer
                        toolResult = `For ${propertyName}, we have 3 ways to proceed:\n\n` +
                            `1. **Sales Centre Visit**: See the model and finishes in person. ${agentInfo}\n` +
                            `2. **Video Call**: A detailed digital walkthrough (book a slot here: ${tenant.booking_cal_link || 'our booking site'}).\n` +
                            `3. **Voice Call**: A quick 2-minute chat with our assistant to check availability.\n\n` +
                            `${suggestion} Which would you prefer?`;
                    }

                    if (leadId) {
                        await logLeadIntent(leadId, 'offplan_flow_triggered', {
                            property_id: propertyId,
                            property_name: propertyName,
                            community,
                            developer,
                            preferred_option: preferredOption || 'Offer 3-paths',
                            is_international: isInternational,
                            source: 'whatsapp'
                        });
                    }
                }

                parts.push({
                    functionResponse: {
                        name: name,
                        response: {
                            name: name,
                            content: toolResult
                        }
                    }
                });
            }

            // Send tool results back to model
            console.log("Sending tool results back to Gemini...");
            const nextResult = await chat.sendMessage(parts);
            const nextResponse = await nextResult.response;
            functionCalls = nextResponse.functionCalls();
            textResponse = nextResponse.text();
        }

        responseText = textResponse || "I didn't quite catch that. Could you repeat?";

        // --- SUPABASE: Log AI Response ---
        if (leadId && responseText) {
            let messageType = 'Message';
            let meta = null;

            if (isVoiceResponse) {
                messageType = 'Voice';
                meta = `https://${host}/.netlify/functions/tts?text=${encodeURIComponent(responseText)}`;
            }

            await supabase.from('messages').insert({
                lead_id: leadId,
                type: messageType,
                sender: 'AURO_AI',
                content: responseText,
                meta: meta
            });
        }

        // Helper to escape XML special characters
        const escapeXml = (unsafe: string) => {
            return unsafe.replace(/[<>&'"]/g, (c) => {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case "'": return '&apos;';
                    case '"': return '&quot;';
                    default: return c;
                }
            });
        };

        let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
    <Body>${escapeXml(responseText)}</Body>`;

        if (isVoiceResponse) {
            const ttsUrl = `https://${mediaHost}/.netlify/functions/tts?text=${encodeURIComponent(responseText)}`;
            twiml += `
    <Media>${ttsUrl}</Media>`;
        }

        // Add property images if available (max 10 per WhatsApp message)
        if (responseImages.length > 0) {
            const imagesToSend = responseImages.slice(0, 10); // WhatsApp limit
            for (const imageUrl of imagesToSend) {
                twiml += `
    <Media>${escapeXml(imageUrl)}</Media>`;
            }
            console.log(`Added ${imagesToSend.length} images to TwiML`);
        }

        twiml += `
  </Message>
</Response>`;

        console.log("Generated TwiML:", twiml);

        return {
            statusCode: 200,
            body: twiml.trim(),
            headers: {
                "Content-Type": "text/xml"
            }
        };

    } catch (error) {
        console.error("Error processing WhatsApp request:", error);
        return {
            statusCode: 500,
            body: "<Response><Message>Error processing request</Message></Response>",
            headers: { "Content-Type": "text/xml" }
        };
    }
};

export { handler };

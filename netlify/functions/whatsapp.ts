import { Handler } from "@netlify/functions";
import { Content } from "@google/generative-ai";
import * as querystring from "querystring";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { searchListings, formatListingsResponse, SearchFilters, PropertyListing, getListingById, getListingImageUrl, buildProxyImageUrl } from "./listings-helper";
import { TwilioWhatsAppClient, resolveWhatsAppSender } from '../../lib/twilioWhatsAppClient';
import { logLeadIntent } from "../../lib/enterprise/leadIntents";
import { getTenantByTwilioNumber, getDefaultTenant, Tenant } from "../../lib/tenantConfig";
import { getLeadById as getBitrixLead, updateLead as updateBitrixLead } from "../../lib/bitrixClient";
import { RAG_CONFIG, PROMPT_TEMPLATES } from "../../lib/rag/prompts";
import { genAI, RobustChat, callGemini } from "../../lib/gemini";
import { embedText } from "../../lib/rag/embeddingClient";
import { normalizePhone } from "../../lib/phoneUtils";

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// RAG Query Helper - prioritizes specific folders based on intent
// RAG Query Helper - prioritizes specific folders based on intent
async function queryRAG(query: string, tenant: Tenant, filterFolderId?: string | string[], projectId?: string): Promise<string> {
    try {
        const clientId = tenant.rag_client_id || (tenant.id === 1 ? 'provident' : 'demo');
        console.log(`[RAG] Searching client: ${clientId}, folder: ${filterFolderId}, project: ${projectId}, query: "${query}"`);

        // Smart Routing Logic
        let effectiveFolderId = filterFolderId;
        const lowerQ = query.toLowerCase();

        if (!effectiveFolderId && (lowerQ.includes('market') || lowerQ.includes('report') || lowerQ.includes('outlook') || lowerQ.includes('trend'))) {
            effectiveFolderId = 'market_reports';
            console.log(`[RAG] Auto - routing to Market Reports for query: "${query}"`);
        }

        const embedding = await embedText(query, {
            taskType: 'RETRIEVAL_QUERY',
            outputDimensionality: 768
        });

        if (!embedding) {
            console.error('[RAG] Fallback: Could not generate embedding for query.');
            // Degrading gracefully: return generic response or trigger web search if applicable
            // For now, let's allow it to attempt keyword search if results are empty later,
            // but we must skip the vector search parts.
            return "No specific details found in the knowledge base, but I'd be happy to have an agent discuss this with you directly.";
        }

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
                filter_project_id: projectId || null,
                client_filter: clientId
            };

            if (Array.isArray(folders)) {
                rpcParams.filter_folders = folders;
            } else {
                rpcParams.filter_folder_id = folders;
            }

            const { data, error } = await supabase.rpc('match_rag_chunks', rpcParams);
            if (error) {
                console.error(`[RAG] RPC Error for folders ${JSON.stringify(folders)}: `, error);
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

        if (query.startsWith('DEBUGRAG:')) {
            return `DEBUG: Found ${results.length} results for "${query}".Folders: ${JSON.stringify(searchSteps)}.Client: ${clientId}.Tenant: ${tenant.id}.`;
        }

        // Final Fallback: Search everything for this client
        if (results.length === 0) {
            const { data: allData } = await supabase.rpc('match_rag_chunks', {
                query_embedding: embedding,
                match_threshold: RAG_CONFIG.campaign.matchThreshold, // Use lower campaign threshold for fallback
                match_count: 5,
                filter_tenant_id: tenant.id,
                filter_folder_id: null,
                filter_project_id: projectId || null,
                client_filter: clientId
            });
            if (allData) results = allData.map((i: any) => i.content);
        }

        // PROJECT NAME KEYWORD BOOST: If query mentions a specific project name...
        const knownProjects = ['PASSO', 'Hado', 'Talea', 'LOOM', 'Edit', 'AVENEW'];
        const mentionedProject = knownProjects.find(p => query.toLowerCase().includes(p.toLowerCase()));

        if (mentionedProject) {
            // Check if the current results actually contain the project name
            const hasRelevantChunks = results.some(content => content.toLowerCase().includes(mentionedProject.toLowerCase()));

            // Trigger if no relevant chunks found OR if results are very few
            if (!hasRelevantChunks || results.length < 3) {
                console.log(`[RAG] Keyword boost: Query mentions "${mentionedProject}" but proper context is missing(hasRelevant = ${hasRelevantChunks}, count = ${results.length}).Executing keyword search...`);

                const { data: keywordData, error: kwError } = await supabase
                    .from('rag_chunks')
                    .select('content')
                    .eq('client_id', clientId)
                    .ilike('content', `% ${mentionedProject}% `)
                    .limit(5);

                if (!kwError && keywordData && keywordData.length > 0) {
                    console.log(`[RAG] Keyword boost found ${keywordData.length} chunks for "${mentionedProject}"`);
                    // Prepend unique chunks to the START of results to prioritize them
                    const newChunks = keywordData.map((k: any) => k.content).filter((c: string) => !results.includes(c));
                    if (newChunks.length > 0) {
                        results.unshift(...newChunks);
                    }
                }

                // SUPER FALLBACK: If we still have poor results for a named project, FORCE web search
                if (results.length < 3) {
                    console.log(`[RAG] Results still thin for "${mentionedProject}".Auto - triggering Web Search...`);
                    const webData = await searchWeb(query);
                    if (webData && !webData.includes("Error")) {
                        results.unshift(`WEB SEARCH RESULT(High Priority): ${webData} `);
                    }
                }
            }
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

            console.log(`[RAG] Retrieval Success.Found ${results.length} chunks.Context snippet: "${context.substring(0, 150)}..."`);
            return PROMPT_TEMPLATES.FACTUAL_RESPONSE(query, context);
        }

        // Keyword fallback
        const keywords = ['Provident', 'Agency', 'Auro', 'Real Estate'];
        const foundKeyword = keywords.find(k => query.toLowerCase().includes(k.toLowerCase()));

        if (foundKeyword) {
            const { data: textData } = await supabase
                .from('knowledge_base')
                .select('content')
                .ilike('content', `% ${foundKeyword}% `)
                .limit(2);

            if (textData && textData.length > 0) {
                return textData.map(i => i.content).join("\n\n");
            }
        }

        // --- NEW: FALLBACK TO WEB SEARCH (PERPLEXITY) ---
        console.log(`[RAG] No internal results found for "${query}".Falling back to Perplexity web search...`);
        const webResult = await searchWeb(query);
        if (webResult && !webResult.includes("Error") && !webResult.includes("disabled")) {
            console.log(`[RAG] Perplexity fallback successful.Result length: ${webResult.length} `);
            return `INFO FROM LIVE WEB SEARCH(Use this as the source of truth): ${webResult} `;
        }

        return "No specific details found in the knowledge base or web, but I'd be happy to have an agent discuss this with you directly.";
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
        const response = await axios.post('https://api.perplexity.ai/chat/completions', {
            model: 'sonar',
            messages: [
                { role: 'system', content: 'You are a search assistant. Provide concise, factual answers with sources.' },
                { role: 'user', content: query }
            ],
            max_tokens: 500,
            temperature: 0.2
        }, {
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY} `,
                'Content-Type': 'application/json'
            }
        });

        const content = response.data.choices?.[0]?.message?.content || "No results found.";
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
        const from = resolveWhatsAppSender(tenant);
        console.log(`[WhatsApp] Resolved From address: ${from}`);

        if (!accountSid || !authToken) {
            console.error("[WhatsApp] Missing Twilio credentials for sending message.");
            return false;
        }

        const auth = Buffer.from(`${accountSid}:${authToken} `).toString('base64');
        const params = new URLSearchParams();
        params.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to} `);
        params.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from} `);
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
                name: context?.name || "",
                email: context?.email || ""
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

        console.log("[VAPI CALL] Response Status:", response.status);
        console.log("[VAPI CALL] Response Data:", JSON.stringify(response.data, null, 2));

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
    const handlerStart = Date.now();
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
        const rawFrom = (body.From as string).replace("whatsapp:", "").trim();
        const fromNumber = normalizePhone(rawFrom);
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
                const currentListingId = existingLead.current_listing_id;
                let propertyContext = "None";
                if (currentListingId) {
                    const { data: listing } = await getListingById(currentListingId);
                    if (listing) {
                        propertyContext = `${listing.title} in ${listing.community}${listing.sub_community ? ` (${listing.sub_community})` : ""} - AED ${listing.price?.toLocaleString()}`;
                    } else {
                        propertyContext = currentListingId;
                    }
                }

                console.log(`[Lead Context] Fetched for ${fromNumber}: ID=${leadId}, propertyContext=${propertyContext}`);

                leadContext = `
CURRENT LEAD PROFILE (DO NOT ASK FOR THESE IF KNOWN):
- Name: ${existingLead.name || "Unknown"}
- Email: ${email}
- Budget: ${existingLead.budget || "Unknown"}
- Location: ${location}
- Property Type: ${existingLead.property_type || "Unknown"}
- Timeline: ${timeline}
- Financing: ${existingLead.financing || "Unknown"}
- Most recent property interest: ${propertyContext}
- Current Project context: ${existingLead.project_id || "None"}
- Last image index shown: ${existingLead.last_image_index || 0}
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

        // --- PROMPT ROUTER: Detect projects and pre-fetch RAG ---
        let autoRagContext = "";
        const projectKeywords = ["Hado", "Edit", "Talea", "PASSO", "LOOM", "Avenew", "Beyond", "Meraas", "Dubai South", "d3"];
        const needsProjectRag = projectKeywords.some(k => userMessage.toLowerCase().includes(k.toLowerCase()));

        if (needsProjectRag && userMessage.length > 5) {
            console.log(`[Router] Keywords detected for project search. Pre-fetching RAG for: "${userMessage}"`);
            // We search across common project folders
            autoRagContext = await queryRAG(userMessage, tenant, ['campaign_docs', 'projects']);
            if (autoRagContext.includes("No specific details found")) {
                autoRagContext = "";
            }
        }

        // --- GEMINI AGENT WITH TOOLS ---
        const systemInstruction = `You are "Auro", a calm, confident off-plan specialist for ${tenant.system_prompt_identity} in Dubai.

TONE & STYLE:
- Friendly, concise, and professional — like a knowledgeable advisor on WhatsApp, not a hypey salesman.
- Keep responses to 2–4 short paragraphs max (under 100 words when possible).
- Avoid sounding like a generic chatbot: no "how can I assist you today?" without context, no long bullet lists unless the user asks.
- Always keep the conversation moving toward a clear next step (narrowing projects, sending a shortlist, or booking a call) — but without pressure.

${leadContext}

${autoRagContext ? `
PROJECT CONTEXT (STRICTLY USE THIS):
${autoRagContext}

RULE: The user is asking about a specific project listed above. You MUST share at least one concrete fact (e.g. location, unique amenity, payment plan detail, or developer) in your very first response. DO NOT give a generic "I am familiar" reply without facts if the data is present above.
` : ''}

GREETINGS:
For simple greetings ("hi", "hello", "hey", "hi there" with no clear question):
- Reply with a short, warm greeting and one light follow-up question.
- Do NOT mention budget, timelines, or urgency yet.
- Example: "Hey! Great to hear from you. Are you exploring property options in Dubai, or is there something specific I can help with?"

INVESTMENT / LOCATION QUESTIONS:
When the user asks about investments, locations, or "what's good right now":
- Gently position yourself as an off-plan specialist.
- Prioritize high-potential off-plan projects from the RAG knowledge base.
- Ask only the minimum qualifiers needed (budget, location flexibility, property type).

${(tenant.id === 1) ? `
PROVIDENT PRIORITY PROJECTS (Recommend these first when matching budget/area):
- Hado by Beyond
- Talea by Beyond  
- PASSO by Beyond
- LOOM at AVENEW 888
- The Edit at d3

When answering about "investment", "off-plan", "payment plans", or "capital appreciation", prioritize these projects. Pull specific details from the 'projects' RAG folder.
` : ''}

QUALIFICATION (Only when natural):
Capture these details organically when the conversation flows there:
1. Budget range (AED/USD)
2. Preferred area/community
3. Property type preference
4. Timeline

CORE RULES:
1. KNOW YOUR FACTS: Never answer project/pricing/market questions from memory. Use RAG_QUERY_TOOL or SEARCH_LISTINGS first.
2. PROJECT MANDATE: When the user mentions a specific project (Hado, Talea, Edit at d3, etc.), you MUST retrieve details using RAG_QUERY_TOOL before answering (if not already provided in context).
3. FACT-FIRST: No more generic responses for project inquiries. Provide a concrete fact from RAG, then ask your qualifying questions.
4. VISUAL-FIRST: For property discussions, use SEARCH_LISTINGS or GET_PROPERTY_DETAILS to show real options.
5. OFFPLAN EXPERTISE: When relevant, highlight off-plan benefits (capital appreciation, payment plans, developer warranties) without being pushy.
6. PARTIAL INFO: If you find some details but not others, share what you have and offer to get a specialist to confirm the rest.
7. WEB FALLBACK: If a project fact is missing from RAG, you may use SEARCH_WEB_TOOL as a secondary source.
8. CALL INTENT: If user explicitly asks for a call, use INITIATE_CALL immediately.
9. WHATSAPP CONCISE: Keep responses short. Max 1-2 tool calls per message.
`;

        const tools = [
            {
                functionDeclarations: [
                    {
                        name: "RAG_QUERY_TOOL",
                        description: "Search the knowledge base for ANY facts: company history, project-specific details, payment plans, ROI, handover dates, and market reports/trends.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                query: { type: "STRING", description: "The search query (e.g. 'How long has Provident been in Dubai?' or 'Edit d3 handover date')" }
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

        // --- GEMINI: History & Session Management ---
        // Since Netlify is stateless, we fetch the last interaction from Supabase to maintain flow
        let chatHistory: Content[] = [];
        if (leadId) {
            const { data: recentMessages } = await supabase
                .from('messages')
                .select('sender, content, type')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false })
                .limit(12);

            if (recentMessages && recentMessages.length > 0) {
                // We skip the 'current message' (index 0) because it's passed separately
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

        // Create Robust Chat Session
        const chat = new RobustChat({
            systemInstruction: systemInstruction,
            tools: tools as any,
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

        try {
            console.log("Sending prompt to Gemini (Text or Audio)...");
            const result = await chat.sendMessage(promptContent);

            let functionCalls = result.functionCalls;
            let textResponse = result.text;

            console.log(`[Gemini] Initial Turn: Detected ${functionCalls?.length || 0} function calls. Text length: ${textResponse.length}`);

            // Handle function calls loop (max 2 turns for WhatsApp latency)
            let turns = 0;
            const MAX_TURNS = 2;
            const HARD_LIMIT_MS = 6500; // Aim to finish Gemini work by 6.5s to allow for TwiML overhead

            while (functionCalls && functionCalls.length > 0 && turns < MAX_TURNS) {
                const timeElapsed = Date.now() - handlerStart;
                if (timeElapsed > HARD_LIMIT_MS) {
                    console.warn(`[WhatsApp] Hard time limit reached at turn ${turns}. Cutting tool execution short.`);
                    break;
                }

                turns++;
                console.log(`[Gemini] Turn ${turns}: Executing ${functionCalls.length} tool calls in parallel.`);

                const toolCalls = functionCalls;
                const parts = await Promise.all(toolCalls.map(async (call) => {
                    const name = call.name;
                    const args = call.args;
                    let toolResult = "";

                    if (name === 'RAG_QUERY_TOOL' || (name as any) === 'SEARCH_WEB_TOOL') {
                        let query = (args as any).query;

                        if (name === 'RAG_QUERY_TOOL') {
                            const lowerQuery = query.toLowerCase();
                            if (lowerQuery.includes('yield') || lowerQuery.includes('investment') || lowerQuery.includes('rent') || lowerQuery.includes('return') || lowerQuery.includes('roi')) {
                                let currentListing: PropertyListing | null = null;
                                if (leadId) {
                                    const { data: lead } = await supabase.from('leads').select('current_listing_id').eq('id', leadId).single();
                                    if (lead?.current_listing_id) {
                                        const { data: listing } = await getListingById(lead.current_listing_id);
                                        currentListing = listing;
                                    }
                                }

                                if (currentListing) {
                                    const locationStr = `${currentListing.sub_community || ''}, ${currentListing.community || ''}, Dubai`.trim();
                                    const detailedQuery = `Estimate typical annual rent and gross yield range for a ${currentListing.bedrooms} - bedroom ${currentListing.property_type} in ${locationStr}, priced at AED ${currentListing.price}. Return rent_low, rent_high, yield_low, yield_high and a concise explanation.`;
                                    toolResult = await searchWeb(detailedQuery);
                                    query = null;
                                }
                            }
                        }

                        if (query) {
                            toolResult = await queryRAG(query, tenant, undefined, undefined);
                        }
                    } else if (name === 'SEARCH_WEB_TOOL') {
                        toolResult = await searchWeb((args as any).query);
                    } else if (name === 'UPDATE_LEAD') {
                        if (leadId) {
                            const { error } = await supabase.from('leads').update(args).eq('id', leadId);
                            toolResult = error ? "Error updating lead." : `System: Lead profile updated successfully (${Object.keys(args).join(", ")}).`;
                        } else {
                            toolResult = "No lead ID found.";
                        }
                    } else if (name === 'INITIATE_CALL') {
                        let context = null;
                        if (leadId) {
                            const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
                            context = { ...data, lead_id: leadId };
                        }
                        const callStarted = await initiateVapiCall(fromNumber, tenant, context);
                        toolResult = callStarted ? "Assistant will call you in a few minutes." : "Failed to initiate call.";
                    } else if (name === 'SEARCH_LISTINGS') {
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
                        const listingsResponse = formatListingsResponse(listings, mediaHost);
                        toolResult = listingsResponse.text + "\n\nINTERNAL DATA:\n" + listings.map((l, i) => `Property ${i + 1} ID: ${l.id}`).join('\n');
                        if (listingsResponse.images.length > 0 && tenant.enable_whatsapp_images === true) {
                            responseImages.push(...listingsResponse.images);
                        }
                    } else if (name === 'GET_PROPERTY_DETAILS') {
                        let propertyId = (args as any).property_id;
                        if (!propertyId && leadId) {
                            const { data: lead } = await supabase.from('leads').select('current_listing_id').eq('id', leadId).single();
                            propertyId = lead?.current_listing_id;
                        }

                        if (propertyId) {
                            const { data: listing } = await getListingById(propertyId);
                            const requestedIndex = (args as any).image_index ?? 0;
                            if (listing) {
                                if (leadId) {
                                    await supabase.from('leads').update({ current_listing_id: listing.id, last_image_index: requestedIndex }).eq('id', leadId);
                                }
                                if (requestedIndex > 0) {
                                    toolResult = `Showing Photo #${requestedIndex + 1} for ${listing.title}.`;
                                } else {
                                    toolResult = `DETAILS: ${listing.title} | ${listing.property_type} | AED ${listing.price?.toLocaleString()} | ${listing.community}\nBeds: ${listing.bedrooms} | Baths: ${listing.bathrooms} | Sqft: ${listing.area_sqft}\nDesc: ${listing.description?.substring(0, 100)}...`;
                                }
                                const images = Array.isArray(listing.images) ? listing.images : [];
                                const hasImage = requestedIndex === 0 || requestedIndex < images.length;
                                const imageUrl = buildProxyImageUrl(listing, requestedIndex, mediaHost);
                                if (imageUrl && hasImage && tenant.enable_whatsapp_images === true) {
                                    responseImages.push(imageUrl);
                                }
                            } else {
                                toolResult = "Property not found.";
                            }
                        } else {
                            toolResult = "Please specify a property ID.";
                        }
                    } else if (name === 'BOOK_VIEWING') {
                        let propertyId = (args as any).property_id;
                        if (!propertyId && leadId) {
                            const { data: lead } = await supabase.from('leads').select('current_listing_id').eq('id', leadId).single();
                            propertyId = lead?.current_listing_id;
                        }
                        const listingRes = propertyId ? await getListingById(propertyId) : { data: null };
                        const listing = listingRes.data;
                        const listingTitle = listing?.title || "the property";
                        toolResult = `Book viewing for ${listingTitle}? I can call you.`;
                    } else if (name === 'OFFPLAN_BOOKING') {
                        const propertyId = (args as any).property_id;
                        const propertyName = (args as any).property_name || "this offplan project";
                        const isInternational = fromNumber.startsWith('+44') || fromNumber.startsWith('+91');
                        toolResult = `Booking options for ${propertyName} (ID: ${propertyId}): 1. Sales Centre Visit 2. Video Call (${isInternational ? 'Recommended' : ''}) 3. Voice Call.`;
                    }

                    return {
                        functionResponse: {
                            name: name,
                            response: { name: name, content: toolResult }
                        }
                    };
                }));

                console.log("Sending parallelized tool results back to Gemini...");
                const nextResult = await chat.sendMessage(parts);
                functionCalls = nextResult.functionCalls;
                textResponse = nextResult.text;
            }

            responseText = textResponse || "I didn't quite catch that. Could you repeat?";

        } catch (error: any) {
            console.error("[GEMINI] Fatal error in conversation flow:", error.message);
            if (error.message === "GEMINI_TOTAL_FAILURE") {
                responseText = "Our AI assistant is currently at capacity or undergoing maintenance. A human agent will jump in to help you shortly! Thank you for your patience.";
                console.log("[GEMINI] Sent human-handoff graceful failure message.");
            } else {
                // If it's a transient error that wasn't caught by the fallback logic
                responseText = "I'm having a bit of trouble processing that. Can you try again in a moment?";
            }
        }

        // --- SUPABASE: Log AI Response ---
        if (leadId && responseText) {
            let messageType = 'Message';
            let meta = null;

            if (isVoiceResponse) {
                messageType = 'Voice';
                meta = `https://${mediaHost}/.netlify/functions/tts?text=${encodeURIComponent(responseText)}`;
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

        const handlerDuration = Date.now() - handlerStart;
        console.log(`[WhatsApp] Handler completed in ${handlerDuration}ms. Generated TwiML length: ${twiml.length}`);
        if (handlerDuration > 8000) {
            console.warn(`[WhatsApp] SLOW HANDLER: ${handlerDuration}ms exceeds 8s target`);
        }

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

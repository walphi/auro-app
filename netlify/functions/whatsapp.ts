import { Handler } from "@netlify/functions";
import { Content } from "@google/generative-ai";
import * as querystring from "querystring";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { searchListings, formatListingsResponse, SearchFilters, PropertyListing, getListingById, getListingImageUrl, buildProxyImageUrl } from "./listings-helper";
import { TwilioWhatsAppClient, resolveWhatsAppSender } from '../../lib/twilioWhatsAppClient';
import { logLeadIntent } from "../../lib/enterprise/leadIntents";
import { getTenantByTwilioNumber, getDefaultTenant, getTenantByShortName, Tenant } from "../../lib/tenantConfig";
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

/**
 * Help check if the user message shows "buying intent" or asks for deeper info.
 */
function hasBuyingIntent(message: string, lead: any): boolean {
    const lowerMessage = message.toLowerCase();

    // 1. Deeper info keywords
    const deepInfoKeywords = [
        "options", "tell me more", "roi", "payment plan",
        "price", "investment", "more details", "send details",
        "can you send", "is this a good", "what is the price"
    ];
    const asksDeeperInfo = deepInfoKeywords.some(k => lowerMessage.includes(k));

    // 2. Qualifiers collected (at least one)
    const hasQualifiers = !!(lead?.budget || lead?.property_type || lead?.location);

    console.log(`[IntentDetection] Qs: ${hasQualifiers}, Deeper: ${asksDeeperInfo} | Msg: "${message.substring(0, 30)}"`);
    return asksDeeperInfo || hasQualifiers;
}

/**
 * Check if the message is a simple affirmative to a call offer.
 * Augmented with hard-coded patterns for "Call me now".
 */
function isAffirmative(message: string): boolean {
    const clean = message.toLowerCase().trim().replace(/[👍!.?]/g, '');
    const affirmatives = [
        "yes", "sure", "okay", "ok", "yeah", "yup", "yep", "that's fine",
        "call me", "let's do it", "alright", "k", "do it", "fine", "pls", "please",
        "call me now", "call me now please", "yes call", "ok call", "please call",
        "now is fine", "yes now", "yes please call", "call now", "please call me",
        "yes call me", "ok call me"
    ];
    // Check for exact match or includes for the multi-word patterns
    return affirmatives.some(a => clean === a || (a.length > 5 && clean.includes(a)));
}

/**
 * Check for explicit requests for a phone call (bypasses offer window).
 */
function isExplicitCallRequest(message: string): boolean {
    const clean = message.toLowerCase().trim().replace(/[?.!]/g, '');
    const explicitPatterns = [
        "call me now",
        "could someone call me now",
        "can you call me now",
        "please call me now",
        "give me a call",
        "connect me with a specialist",
        "call me please",
        "i want a call",
        "phone me",
        "speak to a person",
        "can you call"
    ];
    return explicitPatterns.some(p => clean.includes(p));
}

/**
 * Check if the message is clearly negative or postponing.
 */
function isNegative(message: string): boolean {
    const clean = message.toLowerCase().trim().replace(/[!.?]/g, '');
    const negatives = [
        "not now", "maybe later", "just send info", "no thanks", "nope", "dont call", "don't call", "stop"
    ];

    // Exact match for "no" to avoid matching "now" or "know"
    if (clean === 'no' || clean.startsWith('no ') || clean.endsWith(' no') || clean.includes(' no ')) {
        return true;
    }

    return negatives.some(n => clean.includes(n));
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
        // Resolve current Dubai time for prompt injection
        const dubaiNow = new Intl.DateTimeFormat('en-GB', {
            dateStyle: 'full',
            timeStyle: 'long',
            timeZone: 'Asia/Dubai'
        }).format(new Date());

        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Dubai' }).format(new Date());

        const email = (context?.email || "").trim();
        const customer: any = {
            number: phoneNumber,
            name: context?.name || `WhatsApp Lead ${phoneNumber}`,
        };
        if (email) {
            customer.email = email;
        }

        const payload: any = {
            phoneNumberId: tenant.vapi_phone_number_id || process.env.VAPI_PHONE_NUMBER,
            assistantId: tenant.vapi_assistant_id || process.env.VAPI_ASSISTANT_ID,
            customer,
            assistantOverrides: {
                variableValues: {
                    lead_id: context?.lead_id || "",
                    tenant_id: tenant.id.toString(),
                    name: context?.name || "",
                    email: context?.email || "",
                    budget: context?.budget || "",
                    location: context?.location || "",
                    property_type: context?.property_type || "",
                    whatsapp_summary: context?.whatsapp_summary || "No prior WhatsApp conversation.",
                    date_rules: `
DATES AND TIMEZONE RULES (CRITICAL):
- This call is occurring on ${dubaiNow} (Day: ${dayName}).
- Timezone is Asia/Dubai (+04:00).
- When the caller says "today", "tomorrow", "next Monday", "Monday", "next week", etc., you MUST calculate the actual calendar date relative to today (${dubaiNow}).
- Output the 'meeting_start_iso' structured data field as a specific absolute ISO 8601 datetime in 2026 with +04:00 offset (e.g. 2026-02-16T14:00:00+04:00).
- Output the 'raw_time_phrase' structured data field exactly as the user said it.
`.trim()
                }
            }
        };

        // Guardrail: Only send model override if provider is explicitly known and valid
        const VAPI_PROVIDER = process.env.VAPI_MODEL_PROVIDER;
        const VAPI_MODEL = process.env.VAPI_MODEL_NAME;
        const ALLOWED_PROVIDERS = [
            'openai', 'azure-openai', 'together-ai', 'anyscale', 'openrouter', 'perplexity-ai',
            'deepinfra', 'custom-llm', 'baseten', 'runpod', 'groq', 'vapi', 'anthropic',
            'anthropic-bedrock', 'anthropic-vertex', 'google', 'xai', 'inflection-ai',
            'cerebras', 'deep-seek', 'mistral'
        ];

        if (VAPI_PROVIDER && ALLOWED_PROVIDERS.includes(VAPI_PROVIDER)) {
            console.log(`[VAPI] Applying model override for provider: ${VAPI_PROVIDER}`);
            payload.assistantOverrides.model = {
                provider: VAPI_PROVIDER,
                model: VAPI_MODEL || 'gpt-4o',
                messages: [
                    {
                        role: "system",
                        content: payload.assistantOverrides.variableValues.date_rules
                    }
                ]
            };
        } else if (VAPI_PROVIDER) {
            console.error(`[VAPI] ❌ Invalid VAPI_MODEL_PROVIDER: ${VAPI_PROVIDER}. Skipping model override.`);
        }

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

export const handler: Handler = async (event) => {
    const handlerStart = Date.now();
    
    // --- TRANSPORT RELIABILITY: Time budgets for Twilio 8s timeout ---
    const MAX_PROCESSING_MS = 7500;  // Hard limit: 7.5s (500ms buffer)
    const GEMINI_DEADLINE_MS = 6000; // Must start Gemini by 6s
    const getElapsedMs = () => Date.now() - handlerStart;
    
    // Safe fallback message - preserves escalation path via "call me"
    const TRANSPORT_FALLBACK_MESSAGE = 
        "Thanks for your message! I'm gathering the details and will respond shortly. " +
        "If urgent, just say 'call me' and I'll connect you immediately.";
    
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
        let tenant: Tenant | null = null;

        // Priority 1: Header-based override (for parallel entrypoints like eshel-whatsapp)
        const forcedTenantKey = (event.headers["x-aurora-tenant"] || event.headers["X-Aurora-Tenant"]) as string | undefined;
        if (forcedTenantKey) {
            console.log(`[WhatsApp] Forced tenant detected in headers: ${forcedTenantKey}`);
            tenant = await getTenantByShortName(forcedTenantKey);
        }

        // Priority 2: Standard Twilio "To" number resolution
        if (!tenant) {
            tenant = await getTenantByTwilioNumber(toNumber);
        }

        // Priority 3: Default fallback
        if (!tenant) {
            console.log(`[WhatsApp] No tenant found for ${toNumber}, falling back to default.`);
            tenant = await getDefaultTenant();
        }
        console.log(`[WhatsApp] Resolved tenant: ${tenant.short_name} (ID: ${tenant.id})`);

        let isVoiceResponse = false;
        let skipGemini = false;
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
        let existingLead: any = null;
        let recentMessages: any[] = [];

        if (supabaseUrl && supabaseKey) {
            const { data: lead, error: findError } = await supabase
                .from('leads')
                .select('*')
                .eq('phone', fromNumber)
                .eq('tenant_id', tenant.id)
                .single();
            existingLead = lead;

            if (existingLead) {
                leadId = existingLead.id;
                const { data: messages } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('lead_id', leadId)
                    .order('created_at', { ascending: false })
                    .limit(5);
                recentMessages = messages || [];

                const lastAiMessageObj = recentMessages.find(m => m.sender === 'AURO_AI');
                const lastAiText = lastAiMessageObj?.content || "";
                const lastAiTime = lastAiMessageObj?.created_at ? new Date(lastAiMessageObj.created_at).getTime() : 0;
                const diffMinutes = (Date.now() - lastAiTime) / (1000 * 60);

                const wasLastMessageOffer = (lastAiText.toLowerCase().includes("call you now") ||
                    lastAiText.includes("Would you like a call now?") ||
                    lastAiText.includes("Is now a good time?") ||
                    lastAiText.includes("schedule a time for later") ||
                    lastAiText.toLowerCase().includes("consultation") ||
                    lastAiText.toLowerCase().includes("specialist call")) 
                    && !lastAiText.includes("received your enquiry");  // Exclude initial template - it's a greeting, not a call offer

                const isRecentEnough = diffMinutes < 15;
                const callAffirmative = isAffirmative(userMessage);
                const explicitCallRequest = isExplicitCallRequest(userMessage);
                const negativeIntent = isNegative(userMessage);

                console.log(`[IntentDetection] msg="${userMessage.substring(0, 30)}", explicit=${explicitCallRequest}, offer=${wasLastMessageOffer}, recent=${isRecentEnough}, affir=${callAffirmative}, neg=${negativeIntent}`);

                const shouldEscalate = (explicitCallRequest || (wasLastMessageOffer && isRecentEnough && callAffirmative)) && !negativeIntent;

                if (shouldEscalate) {
                    console.log(`[IntentDetection] Escalating to Vapi call: positive call-confirmation detected.`);

                    // Build a WhatsApp conversation summary to give the voice agent full context
                    const recentForVapi = recentMessages.slice(0, 10).reverse();
                    const whatsapp_summary = recentForVapi.length > 0
                        ? recentForVapi
                            .filter(m => m.content && m.type !== 'Voice_Transcript')
                            .map(m => `${m.sender === 'Lead' ? 'Lead' : 'Auro'}: ${(m.content || '').substring(0, 120)}`)
                            .join('\n')
                        : 'No prior WhatsApp conversation.';

                    const context = {
                        ...existingLead,
                        lead_id: leadId,
                        name: existingLead.name || "Client",
                        whatsapp_summary
                    };

                    const callStarted = await initiateVapiCall(fromNumber, tenant, context);
                    if (callStarted) {
                        responseText = "Great! I'm connecting you with an off-plan specialist now. You'll receive a call in just a moment.";
                        skipGemini = true;
                    }
                }
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

            // --- CRM SYNC: Lead Inbound Sidecar ---
            if (tenant.id === 2 && tenant.crm_type === 'hubspot' && userMessage) {
                await triggerHubSpotSidecar(tenant, 'whatsapp_inbound', existingLead || { phone: fromNumber, name: `WhatsApp Lead ${fromNumber}` }, userMessage);
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
        const systemInstruction = `You are "Auro", a highly-skilled and calm Senior Off-plan Specialist for ${tenant.system_prompt_identity} in Dubai.

TONE & STYLE:
- **Calm, High-Status Expertise**: You are a private advisor, not a helpdesk. Avoid being overly eager.
- **Concise & Direct**: Keep responses to 2-3 short, impactful paragraphs. WhatsApp users dislike long blocks of text.
- **Zero Repetition**: Never start multiple sentences with the same phrase.
- **NO BANNED PHRASES**: NEVER use the following repetitive phrases:
    * "I can share more details here on WhatsApp, or we can jump on a quick call..."
    * "Would you like a call now, or schedule a time for later?"
    * "I'd be happy to assist you with that."
- **Mirroring**: Mirror the user's level of formality and brevity while maintaining professional authority.
- **FINAL OUTPUT ONLY**: Your response must be an actual message to the user. NEVER include internal notes, bracketed placeholders like "[Project Name]", or descriptions of what tools you need to call. 
- **NO SCAFFOLDING**: NEVER say "Requires RAG_QUERY_TOOL" or "Searching listings...". Just provide the answer or a professional follow-up.

${leadContext}

${autoRagContext ? `
PROJECT CONTEXT (STRICTLY USE THIS):
${autoRagContext}

RULE: The user is asking about a specific project listed above. You MUST share at least one concrete fact (e.g. location, unique amenity, payment plan detail, or developer) in your very first response. DO NOT give a generic "I am familiar" reply without facts.
` : ''}

${tenant.id === 2 || tenant.short_name === 'eshel' ? `
ESHEL PRIORITY PROJECTS & FOCUS:
- **Eshel Off-plan Projects**: Focus on the premium portfolio and high-yield investment opportunities.
- **Investor Tone**: Speak clearly about potential ROI and the strategic location of Eshel developments.
- **Brand Pride**: You represent Eshel Properties, known for excellence and personalized client service.
` : ''}

CORE STRATEGY: 
1. **Earn the Call**: Do NOT suggest a call or viewing until you have provided real value. Share a specific ROI estimate, a payment plan detail, or a project recommendation from your knowledge base first.
2. **Off-plan Dominance**: If a user asks for "ready properties", briefly acknowledge but steer them toward off-plan. Explain the 'Off-plan Edge': capital appreciation before handover, 10-year Golden Visa eligibility (if applicable), and interest-free developer payment plans.
3. **Dynamic Closers**: Variation is key. Do NOT end every message asking for a call.
    * Turn 1-2: End with a question about their interest or requirements.
    * Turn 3+: Suggest a consultation ONLY if they show strong intent or you've provided significant value.
    * Example CTAs: "Does that location match your portfolio goals?", "Should I send over the payment plan for this one?", "Is this a project you've looked into before?"

${tenant.id === 2 ? `
ESHEL CALL OFFER GUIDELINES:
After providing a concrete, RAG-backed project answer with clear investment context (yields, prices, payment plans, or handover dates), you MAY offer a brief specialist call.

ALLOWED ONLY when ALL criteria met:
1. The answer includes at least ONE concrete project detail (name, yield %, price range, payment plan, or handover date).
2. This is the 2nd or later meaningful turn (NOT the template reply or first substantive answer).
3. The user showed genuine intent: mentioned a project name PLUS a constraint (payment plan, budget, timeline, or handover date).

If criteria met, append ONE of these on-brand closers:
- "Would you like to speak with a specialist for 10–15 minutes so we can match you with the exact tower and payment plan that fits your budget and timeline?"
- "Shall I arrange a 10-minute call with our Eshel specialist to discuss which specific unit and payment structure works best for you?"

NEVER append a call offer:
- On the initial "Is now a good time?" template reply.
- On the very first project answer (wait for 2nd+ turn).
- Without concrete RAG facts in the answer.
` : ''}

GREETINGS:
For simple greetings ("hi", "hello"):
- Reply with a short, warm greeting and one question about their investment goals.
- Example: "Hey! Good to hear from you. Are you looking into the Dubai market for personal use or for a high-yield investment?"

${(tenant.id === 1) ? `
PROVIDENT PRIORITY PROJECTS (Pitched as the 'Gold Standard'):
- **Beyond Brand (Hado, Talea, PASSO)**: Known for ultra-luxury finishes and bespoke design.
- **AVENEW 888 (LOOM)**: High-growth potential area.
- **The Edit at d3**: Perfect for short-term rental yields due to its location in Design District.

Pitch these projects by name using specific details from RAG. 
` : ''}

QUALIFICATION (Organically):
Only once the user is engaged, capture:
1. Budget range (e.g. "To give you the best options, what's your target budget?")
2. Preferred area
3. Timeline (Serious vs. Browsing)

CORE RULES (HARD CONSTRAINTS):
1. **MUST CALL RAG_QUERY_TOOL**: You MUST call RAG_QUERY_TOOL before you answer ANY question about:
   - projects, areas, communities, or developers,
   - prices, budgets, payment plans,
   - yields, ROI, rental returns, or investment performance.
   If you answer any of these from memory without calling RAG_QUERY_TOOL first, you FAIL.
2. **STRICT: NO PLACEHOLDERS**: You are NOT allowed to invent placeholder content like "[Project Name 1]", "[Area]", "around AED X", or generic 6–8% ROI ranges. Every specific detail MUST come from RAG_QUERY_TOOL or SEARCH_LISTINGS results. 
3. **NO FABRICATION**: If RAG_QUERY_TOOL returns "No specific details found..." or empty context, you MUST say you don't have that data and either ask a clarifying question or offer to connect them to a human specialist. Do NOT fabricate projects, prices, or ROI.
4. **NO MEMORY ANSWERS**: For any project/market questions, use RAG_QUERY_TOOL or SEARCH_LISTINGS. Never guess.
5. **RECOMMENDATION ENGINE**: If the user asks "what's good?", use RAG_QUERY_TOOL with query "best investment projects Dubai 2026" or "top projects in [Area]" to find real winners.
6. **VISUALS**: For listings, use SEARCH_LISTINGS. For projects, describe them vividly using RAG data.
7. **CALL INTENT**: Use INITIATE_CALL immediately if they ask for it.
8. **WHATSAPP CONSTRAINTS**: Max 2 tool calls per turn to keep latency low.
9. **STRICT: NO INTERNAL META**: NEVER mention tool names (e.g., RAG_QUERY_TOOL, SEARCH_LISTINGS) or internal requirements to the user. Only output the final, professional response. If you don't have a piece of info, tell the user politely rather than using a placeholder.
10. **STRICT: NO REFUSALS OR LIMITATIONS**: NEVER tell the user "I do not have access to real-time data" or "I am an AI and cannot skip searches." You are a Senior Advisor. If you need info, USE YOUR TOOLS (RAG_QUERY_TOOL or SEARCH_WEB_TOOL). If info is truly missing, say: "I'll double-check the latest [fact] with the developer's portal for you now..." and use SEARCH_WEB_TOOL. Never explain your AI nature or technical constraints.
11. **ACT AS THE EXPERT**: If the user asks for "availability", search your RAG. The files you have (Fairmont Al Marjan, etc.) contain the core data you need. Do NOT give a generic refusal.
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
                        description: "Initiate an outbound voice call to the user immediately. ONLY use this when the user EXPLICITLY asks to be called (e.g. 'call me', 'give me a call', 'can someone call me'). NEVER use this tool in response to a simple greeting like 'hi', 'hello', or any first message. For greetings, respond with a friendly question about their goals instead.",
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
            const { data } = await supabase
                .from('messages')
                .select('sender, content, type, created_at')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false })
                .limit(12);
            recentMessages = data || [];

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

        // --- TRANSPORT RELIABILITY: Time-guarded Gemini processing ---
        try {
            // Check time budget before expensive operations
            if (getElapsedMs() > GEMINI_DEADLINE_MS && !skipGemini) {
                console.warn(`[WhatsApp] Time budget exceeded (${getElapsedMs()}ms > ${GEMINI_DEADLINE_MS}ms). Using fallback message.`);
                responseText = TRANSPORT_FALLBACK_MESSAGE;
                skipGemini = true;
            }
            
            if (!skipGemini) {
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
                            // Guard: Don't fire on the very first message or unless the user explicitly asked for a call
                            const isFirstMessage = chatHistory.length === 0;
                            const userExplicitlyWantsCall = isExplicitCallRequest(userMessage) || isAffirmative(userMessage);
                            if (isFirstMessage && !userExplicitlyWantsCall) {
                                console.log('[INITIATE_CALL] Blocked: First message and no explicit call request. Returning greeting prompt.');
                                toolResult = "SYSTEM: Do not initiate a call. This is the user's first message. Reply with a warm greeting and ask about their investment goals instead.";
                            } else {
                                let context = null;
                                if (leadId) {
                                    const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
                                    context = { ...data, lead_id: leadId };
                                    
                                    // Build eager WhatsApp summary for voice continuity
                                    if (leadId) {
                                        const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
                                        context = { ...data, lead_id: leadId };
                                        
                                        // Include history + current message
                                        let summaryLines: string[] = [];
                                        if (chatHistory && chatHistory.length > 0) {
                                            const recent = chatHistory.slice(-9); // last 9 history items
                                            summaryLines = recent.map(m => `${m.role === 'user' || m.role === 'model' ? (m.role === 'user' ? 'Lead' : 'Auro') : 'Auro'}: ${m.parts?.[0]?.text || ''}`);
                                        }
                                        summaryLines.push(`Lead: ${userMessage}`); // The message that just came in
                                        
                                        context.whatsapp_summary = summaryLines.join('\n');
                                        console.log(`[INITIATE_CALL] Attached context (total ${summaryLines.length} lines) for lead ${leadId}`);
                                    }
                                }
                                const callStarted = await initiateVapiCall(fromNumber, tenant, context);
                                toolResult = callStarted ? "Assistant will call you in a few minutes." : "Failed to initiate call.";
                            }
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

                // --- ESHEL CALL OFFER: Append polite specialist offer when criteria met ---
                // Only in happy path (normal Gemini response), never in fallback/timeout path
                if (responseText && leadId && !skipGemini && tenant.id === 2) {
                    const intentReached = hasBuyingIntent(userMessage, existingLead);

                    // Check if already offered in this session
                    const alreadyOfferedInHistory = chatHistory.some(h =>
                        h.role === 'model' && (
                            h.parts?.[0]?.text?.includes("Would you like to speak with a specialist") ||
                            h.parts?.[0]?.text?.includes("Shall I arrange a 10-minute call")
                        )
                    );
                    const alreadyOfferedInResponse = responseText.includes("Would you like to speak with a specialist") ||
                                                      responseText.includes("Shall I arrange a 10-minute call");

                    // Guard: Must be 2nd+ meaningful turn
                    const isSecondPlusTurn = chatHistory.filter(h => h.role === 'user').length >= 2;

                    // Guard: Response must have concrete details (numbers, percentages, dates)
                    const hasConcreteDetails = responseText.includes("AED") || 
                                              responseText.includes("%") || 
                                              responseText.includes("handover") ||
                                              responseText.includes("payment plan");

                    // Guard: Last user message must contain project keyword + constraint
                    const projectKeywords = ["emaar", "beachfront", "marina", "south", "downtown", "hills", "creek", "palm", "jumeirah", "d3", "hado", "talea", "passo", "loom", "avenew", "beyond", "edit", "pulse", "havens"];
                    const constraintKeywords = ["payment plan", "handover", "before", "budget", "roi", "yield", "return", "price", "cost", "afford", "timeline", "when", "date"];
                    
                    const userMsgLower = userMessage.toLowerCase();
                    const hasProjectKeyword = projectKeywords.some(kw => userMsgLower.includes(kw));
                    const hasConstraintKeyword = constraintKeywords.some(kw => userMsgLower.includes(kw));

                    // All conditions must be met to append call offer
                    if (intentReached && 
                        isSecondPlusTurn && 
                        hasConcreteDetails && 
                        hasProjectKeyword && 
                        hasConstraintKeyword &&
                        !alreadyOfferedInHistory && 
                        !alreadyOfferedInResponse && 
                        !isNegative(userMessage)) {
                        
                        responseText += "\n\nWould you like to speak with a specialist for 10–15 minutes so we can match you with the exact tower and payment plan that fits your budget and timeline?";
                        console.log("[CallPrompt] Appended Eshel specialist call offer to response");
                    }
                }
            }
        } catch (error: any) {
            console.error("[GEMINI] Fatal error in conversation flow:", error.message);
            // TRANSPORT RELIABILITY: Use fallback message for any Gemini/RAG failure
            // This ensures Twilio always gets a valid response within the timeout window
            responseText = TRANSPORT_FALLBACK_MESSAGE;
            console.log("[WhatsApp] Using transport fallback message due to error/timeout");
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

        // --- TRANSPORT RELIABILITY: Return TwiML immediately ---
        // Fire-and-forget: Logging and sidecar happen AFTER HTTP response
        const response = {
            statusCode: 200,
            body: twiml.trim(),
            headers: {
                "Content-Type": "text/xml",
                "X-Response-Time": handlerDuration.toString()
            }
        };

        // Fire-and-forget: Supabase logging (don't await before returning)
        if (leadId && responseText) {
            let messageType = 'Message';
            let meta = null;

            if (isVoiceResponse) {
                messageType = 'Voice';
                meta = `https://${mediaHost}/.netlify/functions/tts?text=${encodeURIComponent(responseText)}`;
            }

            // Fire-and-forget: Supabase logging (wrap in async IIFE to handle PromiseLike)
            (async () => {
                try {
                    await supabase.from('messages').insert({
                        lead_id: leadId,
                        type: messageType,
                        sender: 'AURO_AI',
                        content: responseText,
                        meta: meta
                    });
                    console.log(`[WhatsApp] Message logged to Supabase (async)`);
                } catch (err: any) {
                    console.error('[WhatsApp] Failed to log message (async):', err.message);
                }
            })();

            // Fire-and-forget: CRM sidecar (don't block the response)
            if (tenant.id === 2 && tenant.crm_type === 'hubspot' && responseText) {
                (async () => {
                    try {
                        await triggerHubSpotSidecar(tenant, 'whatsapp_outbound', existingLead || { phone: fromNumber, name: `WhatsApp Lead ${fromNumber}` }, responseText);
                        console.log(`[WhatsApp] Sidecar triggered (async)`);
                    } catch (err: any) {
                        console.error('[WhatsApp] Failed to trigger sidecar (async):', err.message);
                    }
                })();
            }
        }

        return response;

    } catch (error: any) {
        console.error("Error processing WhatsApp request:", error);
        return {
            statusCode: 500,
            body: "<Response><Message>Error processing request</Message></Response>",
            headers: { "Content-Type": "text/xml" }
        };
    }
};

/**
 * Triggers the Eshel CRM sidecar to log info to HubSpot.
 * Only runs if tenant.id === 2 (Eshel) and crm_type is hubspot.
 */
async function triggerHubSpotSidecar(tenant: Tenant, eventType: string, lead: any, noteText: string, hsTimestamp?: string) {
    if (tenant.id !== 2 || tenant.crm_type !== 'hubspot') return;

    const sidecarUrl = `https://${process.env.MEDIA_HOST || 'auro-app.netlify.app'}/.netlify/functions/eshel-hubspot-crm-sync`;
    const sidecarKey = process.env.AURO_SIDECAR_KEY;

    if (!sidecarKey) {
        console.warn("[Sidecar] AURO_SIDECAR_KEY missing. Skipping sync.");
        return;
    }

    try {
        await axios.post(sidecarUrl, {
            eventType,
            tenantId: tenant.id,
            phone: lead.phone,
            name: lead.name,
            email: lead.email,
            noteText,
            hsTimestamp: hsTimestamp || new Date().toISOString()
        }, {
            headers: { 'x-auro-sidecar-key': sidecarKey }
        });
        console.log(`[Sidecar] Triggered ${eventType} for ${lead.phone}`);
    } catch (err: any) {
        console.error(`[Sidecar] Failed to trigger ${eventType}:`, err.response?.data || err.message);
    }
}


import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { getListingById } from "./listings-helper";
import axios from "axios";
import { logLeadIntent } from "../../lib/enterprise/leadIntents";
import { getTenantByVapiId, getTenantById, getDefaultTenant, Tenant } from "../../lib/tenantConfig";
import { RAG_CONFIG, PROMPT_TEMPLATES } from "../../lib/rag/prompts";

async function sendWhatsAppMessage(to: string, text: string, tenant: Tenant): Promise<boolean> {
    try {
        const accountSid = tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
        const from = tenant.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';

        if (!accountSid || !authToken) return false;

        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);
        params.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
        params.append('Body', text);

        const response = await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            params,
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return response.status === 201 || response.status === 200;
    } catch (error: any) {
        console.error("[VAPI WhatsApp Error]:", error.message);
        return false;
    }
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);
const VAPI_SECRET = process.env.VAPI_SECRET;

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
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
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

// RAG Query with Vapi Priority Boost - prioritizes voice patterns over static uploads
async function queryRAGForVoice(query: string, tenant: Tenant, filterFolderId?: string | string[], projectId?: string): Promise<string> {
    try {
        const clientId = tenant.rag_client_id || (tenant.id === 1 ? 'provident' : 'demo');
        console.log(`[VAPI-LLM RAG] Querying client: ${clientId}, folder: ${filterFolderId}, project: ${projectId}, query: "${query}"`);

        const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embResult = await embedModel.embedContent({
            content: { role: 'user', parts: [{ text: query }] },
            taskType: 'RETRIEVAL_QUERY' as any,
            outputDimensionality: 768
        } as any);
        const embedding = embResult.embedding.values;

        // Hierarchical Search Strategy (Voice Optimized)
        const searchSteps = [];
        const lowerQ = query.toLowerCase();

        // Auto-route to market reports
        if (!filterFolderId && (lowerQ.includes('market') || lowerQ.includes('report') || lowerQ.includes('outlook') || lowerQ.includes('trend'))) {
            searchSteps.push('market_reports');
        }

        if (filterFolderId) {
            searchSteps.push(filterFolderId);
        } else {
            if (projectId) searchSteps.push('campaign_docs');

            const isBrandQuery = /provident|history|founded|ceo|office|founder|opened|since|awards|loai|who (are|is)|about/i.test(lowerQ);
            if (isBrandQuery || (tenant.id === 1 && !projectId)) {
                searchSteps.push('agency_history');
            }

            searchSteps.push('conversation_learning');
            searchSteps.push(['campaign_docs', 'projects', 'website', 'market_reports']);
        }

        let results: string[] = [];

        // Execute searches in order
        for (const folders of searchSteps) {
            if (results.length >= 3) break;

            const isCampaign = folders === 'campaign_docs' || (Array.isArray(folders) && folders.includes('campaign_docs'));
            const config = isCampaign ? RAG_CONFIG.campaign : RAG_CONFIG.agency;

            const { data } = await supabase.rpc('match_rag_chunks_weighted', {
                query_embedding: embedding,
                match_threshold: config.matchThreshold,
                match_count: config.matchCount,
                filter_tenant_id: tenant.id,
                filter_folder_id: Array.isArray(folders) ? null : folders,
                filter_project_id: projectId || null,
                filter_source_types: ['conversation_learning', 'winning_script', 'hot_topic', 'upload']
            });

            if (data && data.length > 0) {
                data.forEach((i: any) => {
                    if (results.length < 5 && !results.some(existing => existing.substring(0, 50) === i.content.substring(0, 50))) {
                        results.push(i.content);
                    }
                });
            }
        }

        // Fallback to standard search if weighted/hierarchical found nothing
        if (results.length === 0) {
            const { data: ragData } = await supabase.rpc('match_rag_chunks', {
                query_embedding: embedding,
                match_threshold: RAG_CONFIG.campaign.matchThreshold,
                match_count: 5,
                filter_tenant_id: tenant.id,
                filter_folder_id: null,
                filter_project_id: projectId || null,
                client_filter: clientId
            });
            if (ragData) results = ragData.map((i: any) => i.content);
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

            // If query is brand-related and we have results
            const isBrandQuery = /provident|who are|about|history|background|founded|ceo|founder|awards/i.test(lowerQuery);
            if (isBrandQuery) {
                return PROMPT_TEMPLATES.AGENCY_AUTHORITY(query, context);
            }

            return PROMPT_TEMPLATES.FACTUAL_RESPONSE(query, context);
        }

        // --- NEW: FALLBACK TO WEB SEARCH (PERPLEXITY) ---
        console.log(`[VAPI-LLM RAG] No internal results found for "${query}". Falling back to Perplexity web search...`);
        const webResult = await searchWeb(query); // We need to define or import searchWeb in vapi-llm
        if (webResult && !webResult.includes("Error") && !webResult.includes("disabled")) {
            return `INFO FROM LIVE WEB SEARCH (Use this as the source of truth): ${webResult}`;
        }

        return "I couldn't find specific details on that in my knowledge base. Let me look it up or connect you with an expert.";
    } catch (e: any) {
        console.error('[VAPI-LLM RAG] Error:', e.message);
        return "Error searching knowledge base.";
    }
}

// Trigger RAG learning for booking confirmations
async function triggerRAGLearning(leadId: string, outcome: string, tenant: Tenant): Promise<void> {
    try {
        const host = process.env.URL || 'https://auro-app.netlify.app';
        await axios.post(`${host}/.netlify/functions/rag-learn`, {
            action: 'process_lead',
            lead_id: leadId,
            outcome: outcome,
            client_id: tenant.rag_client_id
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[VAPI-LLM] RAG learning triggered for lead ${leadId} with outcome ${outcome}`);
    } catch (e: any) {
        console.error('[VAPI-LLM] RAG learning trigger failed:', e.message);
    }
}

const handler: Handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

        const secret = event.headers["x-vapi-secret"];
        if (VAPI_SECRET && secret !== VAPI_SECRET) {
            console.error("[VAPI-LLM] Unauthorized");
            return { statusCode: 401, body: "Unauthorized" };
        }

        const body = JSON.parse(event.body || "{}");
        const { messages, call } = body;
        console.log(`[VAPI-LLM] Request for SID: ${call?.id}`);

        // --- TENANT RESOLUTION ---
        let tenant: Tenant | null = null;
        const vapiAssistantId = call?.assistantId;
        const tenantIdFromVars = call?.assistantOverrides?.variableValues?.tenant_id;

        if (tenantIdFromVars) {
            tenant = await getTenantById(parseInt(tenantIdFromVars));
            console.log(`[VAPI-LLM] Resolved tenant from variableValues: ${tenant?.short_name} (ID: ${tenant?.id})`);
        }

        if (!tenant && vapiAssistantId) {
            tenant = await getTenantByVapiId(vapiAssistantId);
            console.log(`[VAPI-LLM] Resolved tenant from Assistant ID: ${tenant?.short_name} (ID: ${tenant?.id})`);
        }

        if (!tenant) {
            console.log("[VAPI-LLM] No tenant found in payload, falling back to default.");
            tenant = await getDefaultTenant();
        }

        // 1. Context Loading
        let phoneNumber = call?.customer?.number;
        let leadId = call?.extra?.lead_id || call?.metadata?.lead_id || call?.assistantOverrides?.variableValues?.lead_id;
        let leadData: any = null;

        if (phoneNumber) {
            phoneNumber = phoneNumber.replace('whatsapp:', '').trim();
            if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;
        }

        if (leadId) {
            const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
            leadData = data;
        } else if (phoneNumber) {
            const { data } = await supabase.from('leads').select('*').eq('phone', phoneNumber).single();
            leadData = data;
        }
        leadId = leadData?.id;

        // Fallback for name and email from Vapi variables if missing in DB
        const nameFromVars = call?.assistantOverrides?.variableValues?.name;
        const emailFromVars = call?.assistantOverrides?.variableValues?.email;

        if (leadData) {
            if (!leadData.name && nameFromVars) leadData.name = nameFromVars;
            if (!leadData.email && emailFromVars) leadData.email = emailFromVars;
        }

        let propertyContext = "None";
        if (leadData?.current_listing_id) {
            const listing = await getListingById(leadData.current_listing_id);
            if (listing) {
                propertyContext = `${listing.title} in ${listing.community}${listing.sub_community ? ` (${listing.sub_community})` : ""} - AED ${listing.price?.toLocaleString()}`;
            } else {
                propertyContext = leadData.current_listing_id;
            }
        }

        const contextString = (leadData || nameFromVars || emailFromVars) ? `
CURRENT LEAD PROFILE:
- Name: ${leadData?.name || nameFromVars || "Unknown"}
- Phone: ${leadData?.phone || phoneNumber || "Unknown"}
- Email: ${leadData?.email || emailFromVars || "Unknown"}
- Budget: ${leadData?.budget || "Unknown"}
- Location: ${leadData?.location || "Unknown"}
- Property Type: ${leadData?.property_type || "Unknown"}
- Timeline: ${leadData?.timeline || "Unknown"}
- Financing: ${leadData?.financing || "Unknown"}
- Most recent property interest: ${propertyContext}
- Project context: ${leadData?.project_id || "None"}
- Booking: ${leadData?.viewing_datetime || "None"}
` : "NEW LEAD - No context.";

        let dubaiTime = "";
        try {
            dubaiTime = new Intl.DateTimeFormat('en-GB', {
                dateStyle: 'full',
                timeStyle: 'long',
                timeZone: 'Asia/Dubai'
            }).format(new Date());
        } catch (e) {
            dubaiTime = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });
        }

        const systemInstruction = `You are Morgan, a Senior Offplan Specialist for ${tenant.system_prompt_identity}.
Goal: Qualify lead and sell high-yield off-plan property investment opportunities.

TODAY IS: ${dubaiTime} (Use this for relative date resolution like "tomorrow").

${contextString}

RULES & BEHAVIOR:
1. CONTACT VALIDATION & BACKGROUND NOISE:
   - If Name, Email, or Phone are provided in the CURRENT LEAD PROFILE above, DO NOT ask for them from scratch.
   - Instead, simply verify them early in the call: "I have your contact as ${leadData?.name || "the name on record"} and email as ${leadData?.email || "the one on file"}, is that still correct?"
   - This is especially important for noisy environments - confirm what you know, don't make them repeat it.

2. VOICE-ADAPTED VISUALS:
   - You are a VOICE agent. You cannot "send" cards directly, but you can describe images I am sending via WhatsApp.
   - When discussing a property, say: "I've just sent a photo to your WhatsApp properly. It's a [describe based on type]..."
   - Use 'SEARCH_LISTINGS' to finding matching properties, then describe the top 1-2 options verbally while I send the full list to WhatsApp.
 
2. SEQUENTIAL GALLERY:
   - If the user asks for "more photos" or "what does the kitchen look like?":
   - Say: "Let me send you an interior shot on WhatsApp now." (Then trigger the system to send it if possible, or just describe it from the data).
   - "Does that style match what you're looking for?"
 
3. CONTEXTUAL ANSWERS & SOFT SELL OFFPLAN:
   - Project: "Yes, that's in [Community], [Sub-community]. It's a great location."
   - Offplan Detection: If you see 'payment_plan' or 'handover_date' in the listing, treat it as OFFPLAN.
   - Investment: If asked about returns, provide *estimates* based on Dubai market data. "Typically, units like this in [Area] yield around [X]% gross. This is the beauty of off-plan—you lock in the price now for future gains."
   - SOFT SELL OFFPLAN: Even if the user has objections (e.g., "market is too high"), soft-sell off-plan benefits like tax-free returns, flexible payment plans, and capital appreciation before handover.
   - OFFPLAN STEERING: If asked for ready properties, steer them to off-plan. "While ready units are available, the real value right now is in the new launches where we can get you a 5-year payment plan. Should I show you those first?"
 
4. OFFPLAN FLOW (3-Path Options):
   - Use 'OFFPLAN_BOOKING' for offplan projects.
   - Detect Lead Country: If number starts with +44(UK) or +91(India), prioritize offering a **Video Call**.
   - If Local (+971), prioritize **Sales Centre Visit**.
   - ALWAYS offer the 3-path option: 1. Sales Centre Visit, 2. Video Call, 3. Quick Voice Booking.
 
5. KNOW YOUR FACTS (MANDATORY):
   - NEVER answer questions about specific projects, branded residences, pricing, payment plans, market trends, or agency history from memory.
   - You MUST call RAG_QUERY_TOOL or SEARCH_LISTINGS before responding to any factual inquiry.
   - FALLBACK SEARCH: If the Knowledge Base is empty or missing specific details (like exact price/location) for a named project, you MUST use 'SEARCH_WEB_TOOL' to find the answer.
 
6. TONE:
   - Warm, expert, professional, and investment-focused.
   - Do not read long lists. Summarize. "I found a few apartments in Creek Beach starting around 3.4 million."
   - Always end with a question to keep the conversation moving.
`;

        // 2. Call Gemini
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: systemInstruction,
            tools: [
                {
                    functionDeclarations: [
                        {
                            name: "SEARCH_LISTINGS",
                            description: "Search for available property listings in Dubai.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    property_type: { type: "STRING" },
                                    community: { type: "STRING" },
                                    min_price: { type: "NUMBER" },
                                    max_price: { type: "NUMBER" },
                                    min_bedrooms: { type: "NUMBER" }
                                }
                            }
                        },
                        {
                            name: "RAG_QUERY_TOOL",
                            description: "Search the knowledge base for pricing, payment plans, project details, investment yields, and market data.",
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
                            description: "Update lead profile with qualification details.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    email: { type: "STRING" },
                                    budget: { type: "STRING" },
                                    location: { type: "STRING" },
                                    property_type: { type: "STRING" },
                                    timeline: { type: "STRING" }
                                }
                            }
                        },
                        {
                            name: "BOOK_VIEWING",
                            description: "Book a property viewing appointment. Requires a resolved ISO 8601 datetime.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    property_id: { type: "STRING" },
                                    resolved_datetime: { type: "STRING", description: "ISO 8601 string with timezone offset, e.g., 2025-12-23T16:00:00+04:00" },
                                    property_name: { type: "STRING" }
                                },
                                required: ["resolved_datetime", "property_id"]
                            }
                        },
                        {
                            name: "OFFPLAN_BOOKING",
                            description: "Trigger the offplan booking flow with 3-path options.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    property_id: { type: "STRING" },
                                    property_name: { type: "STRING" },
                                    community: { type: "STRING" },
                                    developer: { type: "STRING" },
                                    preferred_option: { type: "STRING", enum: ["sales_centre", "video_call", "voice_call"] }
                                }
                            }
                        }
                    ]
                }
            ] as any
        });
        const chat = model.startChat({
            history: messages.slice(0, -1).map((m: any) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content || "" }]
            }))
        });

        const lastMsg = messages[messages.length - 1]?.content || "Hello";
        const result = await chat.sendMessage(lastMsg);
        const response = await result.response;

        // 3. Process Response
        let text = response.text();
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            console.log(`[VAPI-LLM] Processing ${functionCalls.length} tool calls...`);
            const responses: any[] = [];

            for (const call of functionCalls) {
                let toolResult = "";

                if (call.name === 'BOOK_VIEWING') {
                    const { property_id, resolved_datetime, property_name } = call.args as any;
                    if (property_id && resolved_datetime && leadId) {
                        await supabase.from('leads').update({
                            viewing_datetime: resolved_datetime,
                            booking_status: 'confirmed',
                            current_listing_id: property_id
                        }).eq('id', leadId);

                        let listingTitle = property_name || "Property";
                        if (!property_name && property_id) {
                            const listing = await getListingById(property_id);
                            if (listing) listingTitle = listing.title;
                        }

                        const dateObj = new Date(resolved_datetime);
                        const formattedDate = dateObj.toLocaleString('en-US', {
                            weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai'
                        }) + " Dubai time";

                        const emailParam = leadData?.email ? `&email=${encodeURIComponent(leadData.email)}` : '';
                        const calLink = `${tenant.booking_cal_link}?date=${encodeURIComponent(resolved_datetime)}&property=${encodeURIComponent(property_id)}${emailParam}`;
                        const messageText = `✅ Booking Confirmed!\n\nProperty: ${listingTitle}\nDate: ${formattedDate}\n\nOur agent will meet you at the location. You can manage your booking here: ${calLink}`;

                        if (phoneNumber) {
                            await sendWhatsAppMessage(phoneNumber, messageText, tenant);
                        }

                        await logLeadIntent(leadId, 'booking_confirmed', {
                            property_id,
                            property_title: listingTitle,
                            datetime: resolved_datetime,
                            formatted_date: formattedDate,
                            source: 'vapi-llm'
                        });

                        await triggerRAGLearning(leadId, 'booking_confirmed', tenant);
                        toolResult = "Booking confirmed and notification sent via WhatsApp.";
                    }
                } else if (call.name === 'RAG_QUERY_TOOL') {
                    const query = (call.args as any).query;
                    if (query) {
                        const currentProjectId = leadData?.project_id || body.call?.extra?.project_id || body.call?.metadata?.project_id;
                        toolResult = await queryRAGForVoice(query, tenant, undefined, currentProjectId);
                    }
                } else if (call.name === 'OFFPLAN_BOOKING') {
                    const { property_id, property_name, community, developer, preferred_option } = call.args as any;
                    if (leadId) {
                        await logLeadIntent(leadId, 'offplan_flow_triggered', {
                            property_id, property_name, community, developer, preferred_option, source: 'vapi-llm'
                        });
                        toolResult = "Offplan booking flow initiated.";
                    }
                } else if (call.name === 'UPDATE_LEAD') {
                    const args = call.args as any;
                    if (leadId) {
                        await supabase.from('leads').update(args).eq('id', leadId);
                        toolResult = "Lead updated.";
                    }
                }

                responses.push({
                    functionResponse: {
                        name: call.name,
                        response: { result: toolResult }
                    }
                });
                console.log(`[VAPI-LLM] Tool ${call.name} result:`, toolResult.substring(0, 100) + '...');
            }

            // Call model again with tool results
            const result2 = await chat.sendMessage(responses);
            text = (await result2.response).text();
            console.log(`[VAPI-LLM] Final response after tools:`, text.substring(0, 100) + '...');
        }

        // 4. Stream Response
        const createdTimestamp = Math.floor(Date.now() / 1000);
        const chunk = {
            id: "chatcmpl-" + (body.call?.id ?? Date.now()),
            object: "chat.completion.chunk",
            created: createdTimestamp,
            model: "gpt-4.1-mini",
            choices: [{
                index: 0,
                delta: { role: "assistant", content: text || "I'm listening." },
                finish_reason: null
            }]
        };

        const sseBody = `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            },
            body: sseBody
        };

    } catch (error: any) {
        console.error("[VAPI-LLM] Global Error:", error);
        console.error("[VAPI-LLM] Error Message:", error.message);
        if (error.stack) console.error("[VAPI-LLM] Stack trace:", error.stack);

        const fallbackChunk = {
            id: "err-" + Date.now(),
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            choices: [{ delta: { content: "Sorry, I encountered an internal error. Please try again or ask for a specialist." }, finish_reason: "error" }]
        };
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            },
            body: `data: ${JSON.stringify(fallbackChunk)}\n\ndata: [DONE]\n\n`
        };
    }
};

export { handler };

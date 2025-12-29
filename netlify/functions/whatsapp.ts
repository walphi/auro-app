import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as querystring from "querystring";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { searchListings, formatListingsResponse, SearchFilters, PropertyListing, getListingById, getListingImageUrl, buildProxyImageUrl } from "./listings-helper";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// RAG Query Helper - prioritizes rag_chunks (hot topics), supplements with knowledge_base
async function queryRAG(query: string): Promise<string> {
    try {
        console.log('[RAG] Querying:', query);
        const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embResult = await embedModel.embedContent(query);
        const embedding = embResult.embedding.values;

        let results: string[] = [];

        // Primary: Get from rag_chunks (hot topics, recent content)
        console.log('[RAG] Searching rag_chunks (client: demo)...');
        let { data: ragData, error: ragError } = await supabase.rpc('match_rag_chunks', {
            query_embedding: embedding,
            match_threshold: 0.3,  // Lowered for better recall in demo
            match_count: 5,
            filter_client_id: 'demo',
            filter_folder_id: null
        });

        // Fallback: If nothing in demo, search across all clients (useful if Provident info was uploaded globally)
        if (!ragData || ragData.length === 0) {
            console.log('[RAG] No results for client: demo, trying global search...');
            const { data: globalData, error: globalError } = await supabase.rpc('match_rag_chunks', {
                query_embedding: embedding,
                match_threshold: 0.3,
                match_count: 5,
                filter_client_id: null,
                filter_folder_id: null
            });
            if (!globalError && globalData) ragData = globalData;
        }

        if (!ragError && ragData && ragData.length > 0) {
            console.log('[RAG] rag_chunks:', ragData.length, 'results');
            results = ragData.map((i: any) => i.content);
        }

        // Supplement: Get from knowledge_base if needed
        if (results.length < 3) {
            console.log('[RAG] Searching knowledge_base...');
            const { data: kbData, error: kbError } = await supabase.rpc('match_knowledge', {
                query_embedding: embedding,
                match_threshold: 0.3, // Lowered for better recall
                match_count: 5,
                filter_project_id: null
            });

            if (!kbError && kbData && kbData.length > 0) {
                console.log('[RAG] knowledge_base:', kbData.length, 'results');
                // Add only if not already included (avoid duplicates)
                kbData.forEach((i: any) => {
                    if (!results.some(existing => existing.substring(0, 100) === i.content.substring(0, 100))) {
                        results.push(i.content);
                    }
                });
            }
        }

        if (results.length > 0) {
            console.log('[RAG] Total results:', results.length);
            return results.slice(0, 3).join("\n\n");  // Max 3 results
        } else {
            // SECONDARY FALLBACK: Simple text search (fail-safe for demo)
            console.log('[RAG] Vector search failed, trying keyword fallback...');

            // Extract potential agency name or subject
            const keywords = ['Provident', 'Agency', 'Auro', 'Real Estate'];
            const foundKeyword = keywords.find(k => query.toLowerCase().includes(k.toLowerCase()));

            if (foundKeyword) {
                const { data: textData } = await supabase
                    .from('knowledge_base')
                    .select('content')
                    .ilike('content', `%${foundKeyword}%`)
                    .limit(2);

                if (textData && textData.length > 0) {
                    console.log(`[RAG] Found ${textData.length} results via keyword search for: ${foundKeyword}`);
                    return textData.map(i => i.content).join("\n\n");
                }
            }

            return "No relevant information found in knowledge base.";
        }
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

async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886'; // Default sandbox

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

async function initiateVapiCall(phoneNumber: string, context?: any): Promise<boolean> {
    try {
        const payload: any = {
            phoneNumberId: process.env.VAPI_PHONE_NUMBER,
            assistantId: process.env.VAPI_ASSISTANT_ID,
            customer: {
                number: phoneNumber,
            },
            // Pass context variables via assistantOverrides
            assistantOverrides: {
                variableValues: {
                    lead_id: context?.lead_id || "",
                    name: context?.name || "",
                    budget: context?.budget || "",
                    location: context?.location || "",
                    current_listing_id: context?.current_listing_id || "",
                    property_type: context?.property_type || "",
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
                    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
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
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const body = querystring.parse(event.body || "");
        const userMessage = (body.Body as string) || "";
        const numMedia = parseInt((body.NumMedia as string) || "0");
        const fromNumber = (body.From as string).replace('whatsapp:', '');
        const host = event.headers.host || "auro-app.netlify.app";

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
- Currently interested in Property ID: ${currentListingId}
- Last image index shown: ${lastImageIndex}
`;
            } else {
                console.log("Creating new lead for", fromNumber);
                const { data: newLead, error: createError } = await supabase
                    .from('leads')
                    .insert({
                        phone: fromNumber,
                        name: `WhatsApp Lead ${fromNumber}`,
                        status: 'New',
                        custom_field_1: 'Source: WhatsApp'
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
        const systemInstruction = `You are the AI Assistant for Provident Real Estate, a premier Dubai real estate agency using the AURO platform. Your primary and most reliable source of information is your RAG Knowledge Base (specifically the Provident Real Estate folder).

YOUR GOAL:
Qualify the lead by naturally asking for missing details, and help them find properties.
${leadContext}

REQUIRED DETAILS (Ask only if "Unknown" above):
1. Name
2. Email Address
3. Budget
4. Property Type
5. Preferred Location
6. Timeline

RULES & BEHAVIOR:
1. ALWAYS VISUAL (Card Style):
   - Every property-centric response MUST be visual.
   - Use 'SEARCH_LISTINGS' to show a list (3-5 items) for generic queries ("What do you have?").
   - Use 'GET_PROPERTY_DETAILS' (with image_index=0) for single property focus.
   - Present each result as a cleaner card with: Hero Image, Title, Location, Beds/Baths/Size, Price.
   - Do NOT send text-only property descriptions.

2. SEQUENTIAL GALLERY ("More Photos"):
   - If the user asks for "more photos", "another angle", "interior", etc.:
     - Call 'GET_PROPERTY_DETAILS' with 'image_index' = 'last_image_index' + 1.
     - Rely on the tool to fetch the next image. Do NOT manually increment context in text.
     - If the tool says "no more images", offer to show other similar properties.
   - When a *NEW* property is selected, the system resets the index to 0.

3. CONTEXTUAL ANSWERS:
   - Community/Project: Use the 'community' and 'sub_community' fields. 
   - Broker Identity: Use 'agent_name', 'agent_phone', and 'agent_company' fields. "This listing is with Provident. Your agent is [Name]..."
   - Investment/Yields: YOU MUST USE 'RAG_QUERY_TOOL' which will fetch live market data. Do NOT guess. Use the data returned to give a range (e.g. "Similar units in [Community] typically yield X-Y%").
     - Follow up with: "Are you focused on yield or personal use?"

4. ALTERNATIVES & PORTFOLIO:
   - If asked "What else?", "Anything in Marina?", etc.:
     - Call 'SEARCH_LISTINGS' with broader filters.
     - Show 3-5 visual cards. "Here are a few options that might suit you..."

5. APPOINTMENTS & FOLLOW-UP:
   - If asked to change appointment/time without calendar access:
     - "I don't have direct access to the live calendar yet, but I'll pass this request to your agent immediately."
     - Ask for their preferred new time.
   - If calendar is available (future), use it.

6. TONE & STRUCTURE:
   - Be concise, friendly, and professional.
   - Use short paragraphs or bullets.
   - NEVER include internal IDs (like 023b... or PS-...) or external URLs in your messages. Use human-readable titles/locations only.
   - END EVERY MESSAGE with a clear next step:
     - "Would you like to see more options in [Area]?"
     - "Should I connect you to [Agent Name]?"
     - "Do you want to book a viewing?"
`;

        const tools = [
            {
                functionDeclarations: [
                    {
                        name: "RAG_QUERY_TOOL",
                        description: "Search the knowledge base for specific factual information about projects, pricing, payment plans, etc.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                query: { type: "STRING", description: "The search query" }
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
                                timeline: { type: "STRING" }
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
                        description: "Search for property listings based on user criteria. Use this when the user asks about available properties, apartments, villas, or any real estate listings for sale or rent.",
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
            tools: tools as any
        });

        const chat = model.startChat();

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
                        toolResult = await queryRAG(query);
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
                            // Explicitly tell the model what it now knows to prevent loops
                            const updatedFields = Object.keys(args).join(", ");
                            toolResult = `Lead updated successfully. You now KNOW the following details: ${updatedFields}. DO NOT ask for them again. Proceed to the next missing qualification criteria.`;
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
                    const callStarted = await initiateVapiCall(fromNumber, context);
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

                            const imageUrl = buildProxyImageUrl(listing, requestedIndex, host);
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
                        await supabase.from('messages').insert({
                            lead_id: leadId,
                            type: 'System_Note',
                            sender: 'System',
                            content: `Booking intent detected for: ${listingTitle}. Offered Vapi call escalation.`
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
                        toolResult = `Great choice! A **Video Call** is perfect for viewing the ${propertyName} presentation. \n\nShould I send you a link to book a time that suits you, or would you like me to have an agent call you to set it up?`;
                    } else if (preferredOption === 'voice_call') {
                        toolResult = `I'll have our assistant call you right now to discuss the ${propertyName} payment plans and availability. \n\nIs now a good time? 📞`;
                    } else {
                        // Default 3-Path Offer
                        toolResult = `For ${propertyName}, we have 3 ways to proceed:\n\n` +
                            `1. **Sales Centre Visit**: See the model and finishes in person. ${agentInfo}\n` +
                            `2. **Video Call**: A detailed digital walkthrough (highly recommended for investors in ${countryName}).\n` +
                            `3. **Voice Call**: A quick 2-minute chat with our assistant to check availability.\n\n` +
                            `${suggestion} Which would you prefer?`;
                    }

                    if (leadId) {
                        await supabase.from('messages').insert({
                            lead_id: leadId,
                            type: 'System_Note',
                            sender: 'System',
                            content: `Offplan flow triggered for ${propertyName}. Country detected: ${isInternational ? 'International' : 'Local'}. Option: ${preferredOption || 'Offer 3-paths'}`
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
                    case '<': return '<';
                    case '>': return '>';
                    case '&': return '&';
                    case "'": return "'";
                    case '"': return '"';
                    default: return c;
                }
            });
        };

        let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
    <Body>${escapeXml(responseText)}</Body>`;

        if (isVoiceResponse) {
            const ttsUrl = `https://${host}/.netlify/functions/tts?text=${encodeURIComponent(responseText)}`;
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
            headers: { "Content-Type": "text/xml" }
        };

    } catch (error) {
        console.error("Error processing WhatsApp request:", error);
        return { statusCode: 500, body: "<Response><Message>Error processing request</Message></Response>", headers: { "Content-Type": "text/xml" } };
    }
};

export { handler };

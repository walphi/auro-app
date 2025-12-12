import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { searchListings, formatListingsSummary, SearchFilters } from "./listings-helper";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    console.log("[VAPI] Received payload:", JSON.stringify(body, null, 2));

    const messageType = body.message?.type;
    const toolCalls = body.message?.toolCalls || [];

    // Try to extract phone number to identify lead
    // VAPI payload structure: body.message.call.customer.number or body.call.customer.number
    let phoneNumber = body.message?.call?.customer?.number || body.call?.customer?.number;

    // Normalize phone number (remove 'whatsapp:' prefix if present, ensure + prefix)
    if (phoneNumber) {
      phoneNumber = phoneNumber.replace('whatsapp:', '').trim();
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+' + phoneNumber;
      }
      console.log("[VAPI] Normalized phone number:", phoneNumber);
    } else {
      console.log("[VAPI] No phone number found in payload");
    }

    let leadId: string | null = null;

    if (phoneNumber && supabaseUrl && supabaseKey) {
      const { data: existingLead, error: findError } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', phoneNumber)
        .single();

      if (findError) {
        console.log("[VAPI] Lead lookup error:", findError.message);
      }

      if (existingLead) {
        leadId = existingLead.id;
        console.log("[VAPI] Found existing lead:", leadId);
      } else {
        console.log("[VAPI] Creating new lead for:", phoneNumber);
        const { data: newLead, error: createError } = await supabase
          .from('leads')
          .insert({
            phone: phoneNumber,
            name: `Voice User ${phoneNumber.slice(-4)}`,
            status: 'New',
            custom_field_1: 'Source: VAPI Voice Call'
          })
          .select('id')
          .single();

        if (createError) {
          console.error("[VAPI] Error creating lead:", createError);
        }

        if (newLead) {
          leadId = newLead.id;
          console.log("[VAPI] Created new lead:", leadId);
        }
      }
    } else {
      console.log("[VAPI] Missing phone number or Supabase credentials");
    }

    // Handle conversation-update messages to log transcripts
    if (messageType === 'conversation-update' && leadId) {
      console.log("[VAPI] Processing conversation-update message");
      const conversation = body.message?.conversation || [];

      // Get the last message in the conversation
      if (conversation.length > 0) {
        const lastMessage = conversation[conversation.length - 1];
        const role = lastMessage.role; // 'user' or 'assistant'
        const content = lastMessage.content;

        if (content && role !== 'system') {
          const sender = role === 'user' ? 'Lead' : 'AURO_AI';
          console.log(`[VAPI] Logging ${role} message:`, content.substring(0, 50) + '...');

          const { error: logError } = await supabase.from('messages').insert({
            lead_id: leadId,
            type: 'Voice_Transcript',
            sender: sender,
            content: content
          });

          if (logError) {
            console.error("[VAPI] Error logging conversation message:", logError);
          } else {
            console.log("[VAPI] Conversation message logged successfully");
          }
        }
      }
    }

    // If no tool calls, return early
    if (!toolCalls.length) {
      return { statusCode: 200, body: JSON.stringify({ results: [] }) };
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const results = await Promise.all(toolCalls.map(async (call: any) => {
      const name = call.function?.name;
      const args = call.function?.arguments || {};

      console.log(`[VAPI] Handling Tool Call: ${name}`, args);

      // 1. RAG_QUERY_TOOL
      if (name === 'RAG_QUERY_TOOL') {
        const query = args.query;
        if (!query) return { toolCallId: call.id, result: "Error: Missing query" };

        try {
          const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
          const result = await model.embedContent(query);
          const embedding = result.embedding.values;

          const { data, error } = await supabase.rpc('match_knowledge', {
            query_embedding: embedding,
            match_threshold: 0.5,
            match_count: 5,
            filter_project_id: null
          });

          if (error) throw error;

          const knowledge = data.map((item: any) => item.content).join("\n\n");
          return { toolCallId: call.id, result: knowledge || "No relevant information found in knowledge base." };
        } catch (err: any) {
          console.error("RAG Error:", err);
          return { toolCallId: call.id, result: "Error retrieving knowledge." };
        }
      }

      // 2. UPDATE_LEAD
      if (name === 'UPDATE_LEAD') {
        if (!leadId) return { toolCallId: call.id, result: "Error: No Lead ID identified" };

        try {
          const { error } = await supabase.from('leads').update(args).eq('id', leadId);
          if (error) throw error;
          return { toolCallId: call.id, result: "Lead updated successfully." };
        } catch (err: any) {
          console.error("Update Lead Error:", err);
          return { toolCallId: call.id, result: "Error updating lead." };
        }
      }

      // 3. LOG_ACTIVITY
      if (name === 'LOG_ACTIVITY') {
        if (!leadId) return { toolCallId: call.id, result: "Error: No Lead ID identified" };

        try {
          const { error } = await supabase.from('messages').insert({
            lead_id: leadId,
            type: 'System_Note',
            sender: 'System',
            content: args.content || "Activity Logged",
            metadata: args
          });
          if (error) throw error;
          return { toolCallId: call.id, result: "Activity logged successfully." };
        } catch (err: any) {
          console.error("Log Activity Error:", err);
          return { toolCallId: call.id, result: "Error logging activity." };
        }
      }

      // 4. SEARCH_LISTINGS - Search available property listings
      if (name === 'SEARCH_LISTINGS') {
        console.log("[VAPI] SEARCH_LISTINGS called with:", JSON.stringify(args));
        try {
          const filters: SearchFilters = {
            property_type: args.property_type,
            min_bedrooms: args.min_bedrooms,
            max_bedrooms: args.max_bedrooms,
            min_price: args.min_price,
            max_price: args.max_price,
            community: args.community,
            limit: args.limit || 3
          };
          const listings = await searchListings(filters);
          
          if (listings.length === 0) {
            return { toolCallId: call.id, result: "No matching properties found in our current listings. I can take note of your preferences and have our team follow up with suitable options." };
          }
          
          // Format listings concisely for voice
          const voiceSummary = listings.map((l, i) => {
            const parts = [];
            parts.push(`Option ${i + 1}: ${l.property_title}`);
            if (l.bedrooms) parts.push(`${l.bedrooms} bedrooms`);
            if (l.price_aed) parts.push(`priced at ${(l.price_aed / 1000000).toFixed(1)} million AED`);
            if (l.community) parts.push(`in ${l.community}`);
            return parts.join(', ');
          }).join('. ');
          
          console.log(`[VAPI] SEARCH_LISTINGS found ${listings.length} results`);
          return { toolCallId: call.id, result: `Found ${listings.length} matching properties. ${voiceSummary}. Would you like more details on any of these, or shall I send the full listings to your WhatsApp?` };
        } catch (err: any) {
          console.error("[VAPI] SEARCH_LISTINGS error:", err.message);
          return { toolCallId: call.id, result: "I'm having trouble searching our listings right now. Let me take note of your requirements and have our team send you suitable options." };
        }
      }

      // Default / Fallback (Chat)
      const userMessage = args.transcript || args.query || "Hello";

      // Log User Message
      if (leadId) {
        console.log("[VAPI] Logging user message for lead:", leadId);
        const { error: userMsgError } = await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'Lead',
          content: userMessage
        });

        if (userMsgError) {
          console.error("[VAPI] Error logging user message:", userMsgError);
        } else {
          console.log("[VAPI] User message logged successfully");
        }
      } else {
        console.log("[VAPI] No leadId, skipping user message log");
      }

      const systemInstruction = `You are Morgan, an AI-first Lead Qualification Agent for a premier Dubai real estate agency using the AURO platform. Your goal is to qualify the lead and book a meeting. Your primary and most reliable source of information is your RAG Knowledge Base, which contains the latest, client-approved details on Project Brochures, Pricing Sheets, Payment Plans, and Community Regulations specific to Dubai (DLD, Service Fees, etc.).

PROPERTY LISTINGS:
You have access to live property listings via the SEARCH_LISTINGS tool.
- Proactively suggest listings when lead preferences are known (budget, location, bedrooms, property type).
- Keep verbal descriptions concise - property type, location, price, one key feature.
- Offer to send full details via WhatsApp: "I can send you the full details and photos on WhatsApp."

CRITICAL RULES:
ALWAYS ground your answers in the RAG data or live listings, especially for figures like pricing and payment plans.
NEVER invent information. If the RAG data does not contain the answer, state professionally: 'That specific detail is currently with our sales team; I will ensure the human agent follows up with the exact information.'
Maintain a professional, knowledgeable, and polite tone, recognizing the high-value nature of the Dubai real estate market.`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemInstruction + "\n\nUser: " + userMessage }] }
        ]
      });

      const responseText = result.response.text();

      // Log AI Response
      if (leadId) {
        console.log("[VAPI] Logging AI response for lead:", leadId);
        const { error: aiMsgError } = await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'AURO_AI',
          content: responseText
        });

        if (aiMsgError) {
          console.error("[VAPI] Error logging AI message:", aiMsgError);
        } else {
          console.log("[VAPI] AI message logged successfully");
        }
      } else {
        console.log("[VAPI] No leadId, skipping AI message log");
      }

      return {
        toolCallId: call.id,
        result: responseText
      };
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ results }),
      headers: { "Content-Type": "application/json" }
    };

  } catch (error) {
    console.error("Error processing VAPI request:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

export { handler };

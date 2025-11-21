import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

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
    const toolCalls = body.message?.toolCalls || [];

    if (!toolCalls.length) {
      return { statusCode: 200, body: JSON.stringify({ results: [] }) };
    }

    // Try to extract phone number to identify lead
    // VAPI payload structure: body.message.call.customer.number or body.call.customer.number
    const phoneNumber = body.message?.call?.customer?.number || body.call?.customer?.number;

    let leadId: string | null = null;

    if (phoneNumber && supabaseUrl && supabaseKey) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', phoneNumber)
        .single();

      if (existingLead) {
        leadId = existingLead.id;
      } else {
        const { data: newLead } = await supabase
          .from('leads')
          .insert({
            phone: phoneNumber,
            name: `Voice User ${phoneNumber.slice(-4)}`,
            status: 'New',
            custom_field_1: 'Source: VAPI Voice Call'
          })
          .select('id')
          .single();
        if (newLead) leadId = newLead.id;
      }
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

      // Default / Fallback (Chat)
      const userMessage = args.transcript || args.query || "Hello";

      // Log User Message
      if (leadId) {
        await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'Lead',
          content: userMessage
        });
      }

      const systemInstruction = `You are an AI-first Lead Qualification Agent for a premier Dubai real estate agency using the AURO platform. Your primary and most reliable source of information is your RAG Knowledge Base, which contains the latest, client-approved details on Project Brochures, Pricing Sheets, Payment Plans, and Community Regulations specific to Dubai (DLD, Service Fees, etc.).

CRITICAL RULE:
ALWAYS ground your answers in the RAG data, especially for figures like pricing and payment plans.
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
        await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'AURO_AI',
          content: responseText
        });
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

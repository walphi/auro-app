import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
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
      const userMessage = call.function?.arguments?.transcript || call.function?.arguments?.query || "Hello";

      // Log User Message
      if (leadId) {
        await supabase.from('messages').insert({
          lead_id: leadId,
          type: 'Voice_Transcript',
          sender: 'Lead',
          content: userMessage
        });
      }

      const systemInstruction = `You are AURO, a Senior Sales Associate for [Developer Name] in Dubai. You are selling the 'Marina Zenith' off-plan project. Pitch the 20% down payment plan. If asked about ROI, explain it depends on market conditions but historically averages 7-8% in this area. Be professional, concise, and authoritative.`;

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

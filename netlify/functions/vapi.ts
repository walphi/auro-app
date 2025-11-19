import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const results = await Promise.all(toolCalls.map(async (call: any) => {
      // Extract transcript from the tool call arguments or context if available
      // Note: VAPI payload structure varies, assuming 'input' or similar contains the user text
      // For this MVP we'll assume the prompt comes in the arguments or we treat it as a general generation request
      // Adjusting logic to match VAPI's typical "say" or "generate" tool pattern

      // Simplified VAPI logic: We are acting as the brain.
      // VAPI sends the conversation history or the last user message.
      // For this MVP, let's assume we get a 'transcript' or 'messages' in the payload.
      // If strictly following "tool-calls" webhook, we respond to a specific function call.
      // However, the prompt implies we are generating the RESPONSE to what the user said.

      // Let's construct the prompt based on the user request:
      // "Receive the transcript from VAPI."

      // In a real VAPI tool call, the arguments would contain the parameters for the function.
      // If VAPI is configured to call this endpoint to get a response, it might pass the user's query.
      // Let's assume the argument contains a 'query' or 'transcript'.
      const userMessage = call.function?.arguments?.transcript || call.function?.arguments?.query || "Hello";

      const systemInstruction = `You are AURO, a Senior Sales Associate for [Developer Name] in Dubai. You are selling the 'Marina Zenith' off-plan project. Pitch the 20% down payment plan. If asked about ROI, explain it depends on market conditions but historically averages 7-8% in this area. Be professional, concise, and authoritative.`;

      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemInstruction + "\n\nUser: " + userMessage }] }
        ]
      });

      const responseText = result.response.text();

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

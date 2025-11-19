import { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as querystring from "querystring";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const handler: Handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const body = querystring.parse(event.body || "");
        const userMessage = (body.Body as string) || "";

        let responseText = "";

        const numMedia = parseInt((body.NumMedia as string) || "0");

        if (numMedia > 0) {
            responseText = "I received your voice note, but I can only process text messages at the moment. Please type your query.";
        } else if (userMessage.toLowerCase().includes("pictures") || userMessage.toLowerCase().includes("brochure")) {
            responseText = "Here is the brochure: https://example.com/marina-zenith-brochure.pdf";
        } else {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `You are AURO, a Dubai real estate assistant. The user asked: "${userMessage}". 
      Provide a short answer (under 20 words) and end with a qualifying question.`;

            const result = await model.generateContent(prompt);
            responseText = result.response.text();
        }

        const twiml = `
      <Response>
        <Message>${responseText}</Message>
      </Response>
    `;

        return {
            statusCode: 200,
            body: twiml,
            headers: { "Content-Type": "text/xml" }
        };

    } catch (error) {
        console.error("Error processing WhatsApp request:", error);
        return { statusCode: 500, body: "<Response><Message>Error processing request</Message></Response>", headers: { "Content-Type": "text/xml" } };
    }
};

export { handler };

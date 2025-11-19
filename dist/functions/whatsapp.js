"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const generative_ai_1 = require("@google/generative-ai");
const querystring = __importStar(require("querystring"));
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const handler = async (event) => {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }
        const body = querystring.parse(event.body || "");
        const userMessage = body.Body || "";
        let responseText = "";
        if (userMessage.toLowerCase().includes("pictures") || userMessage.toLowerCase().includes("brochure")) {
            responseText = "Here is the brochure: https://example.com/marina-zenith-brochure.pdf";
        }
        else {
            const model = genAI.getGenerativeModel({ model: "gemini-3.0-pro-preview" });
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
    }
    catch (error) {
        console.error("Error processing WhatsApp request:", error);
        return { statusCode: 500, body: "<Response><Message>Error processing request</Message></Response>", headers: { "Content-Type": "text/xml" } };
    }
};
exports.handler = handler;
//# sourceMappingURL=whatsapp.js.map
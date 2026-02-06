import * as dotenv from "dotenv";
import fs from "fs";

// Load env vars manually to handle multiple files
const envLocal = dotenv.parse(fs.readFileSync(".env.local"));
const envDefault = dotenv.parse(fs.readFileSync(".env"));

// Merge: favor .env for Gemini if it might be working, or vice versa
process.env = { ...process.env, ...envLocal, ...envDefault };

// If both fail, let's try to detect if one is specifically working
console.log("Using Gemini Key:", process.env.GEMINI_API_KEY?.substring(0, 10) + "...");

async function runTest() {
    console.log("=== Running /test-flow Simulation ===");

    // Dynamically import handler
    const { handler } = await import("../netlify/functions/whatsapp");

    const mockPayload = {
        Body: "Tell me about off-plan apartments in Emaar Beachfront. What's the budget like?",
        From: "whatsapp:+971501234567",
        To: "whatsapp:+971565203832", // UAE Number for Provident
        NumMedia: "0"
    };

    const event = {
        httpMethod: "POST",
        headers: {
            host: "localhost:8888"
        },
        body: new URLSearchParams(mockPayload).toString()
    };

    console.log("1. Sending off-plan inquiry to Provident...");
    try {
        // @ts-ignore
        const response = await handler(event, {});

        if (!response || typeof response !== 'object') {
            throw new Error("Invalid response from handler");
        }

        console.log("\n2. Response Status:", response.statusCode);

        const body = response.body || "";
        const match = body.match(/<Body>(.*?)<\/Body>/s);
        const replyText = match ? match[1] : "No body found";

        console.log("\n3. AI Reply Content:");
        console.log("--------------------------------------------------");
        console.log(replyText);
        console.log("--------------------------------------------------");

        const checks = {
            mentionsBranding: replyText.toLowerCase().includes("provident"),
            isVisual: body.includes("<Media>"),
            asksQualification: replyText.toLowerCase().includes("budget") || replyText.toLowerCase().includes("invest") || replyText.toLowerCase().includes("residence"),
            noHardcodedAuro: !replyText.toLowerCase().includes("auro")
        };

        console.log("\n4. Validation Results:");
        console.log(`- Mentions Branding: ${checks.mentionsBranding ? "✅" : "❌"}`);
        console.log(`- Includes Media/Cards: ${checks.isVisual ? "✅" : "❌"}`);
        console.log(`- Asks Qual/Off-plan ques: ${checks.asksQualification ? "✅" : "❌"}`);
        console.log(`- No Hardcoded 'Auro': ${checks.noHardcodedAuro ? "✅" : "❌"}`);

    } catch (error) {
        console.error("Test failed with error:", error);
    }
}

runTest();

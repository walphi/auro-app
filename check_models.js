import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API key found in .env");
        return;
    }

    console.log("Checking models with key ending in:", key.slice(-4));

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(`- ${m.name}`));
            const names = data.models.map(m => m.name).join("\n");
            fs.writeFileSync("model_names.txt", names);
        } else {
            console.log("No models found or error:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();

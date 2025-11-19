import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API key found");
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            const names = data.models.map((m: any) => m.name).join("\n");
            fs.writeFileSync("model_names.txt", names);
            console.log("Wrote models to model_names.txt");
        } else {
            console.log("No models found or error:", JSON.stringify(data));
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();

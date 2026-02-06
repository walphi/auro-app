import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from '@google/generative-ai';

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const modelId = "models/gemini-embedding-001";
    console.log(`Testing model: ${modelId} with outputDimensionality: 768`);
    try {
        const model = genAI.getGenerativeModel({ model: modelId });
        const result = await model.embedContent({
            content: { parts: [{ text: "test" }] },
            outputDimensionality: 768
        } as any);
        console.log(`✅ Success! Length: ${result.embedding.values.length}`);
    } catch (err: any) {
        console.log(`❌ Failed: ${err.message}`);
    }
}

test();

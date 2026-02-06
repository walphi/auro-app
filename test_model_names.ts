import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from '@google/generative-ai';

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const modelId = "models/embedding-001";
    console.log(`Testing model: ${modelId}`);
    try {
        const model = genAI.getGenerativeModel({ model: modelId });
        const result = await model.embedContent("test");
        console.log(`✅ Success! Length: ${result.embedding.values.length}`);
    } catch (err: any) {
        console.log(`❌ Failed: ${err.message}`);
    }

    const modelId2 = "models/gemini-embedding-001";
    console.log(`\nTesting model: ${modelId2}`);
    try {
        const model = genAI.getGenerativeModel({ model: modelId2 });
        const result = await model.embedContent("test");
        console.log(`✅ Success! Length: ${result.embedding.values.length}`);
    } catch (err: any) {
        console.log(`❌ Failed: ${err.message}`);
    }
}

test();

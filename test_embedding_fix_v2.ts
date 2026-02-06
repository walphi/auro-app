import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { embedText, listAvailableEmbeddingModels } from './lib/rag/embeddingClient';

async function test() {
    console.log("--- RAG Embedding Discovery ---");
    await listAvailableEmbeddingModels();

    console.log("\n--- Testing 'The Edit at d3' ---");
    const embedding = await embedText("The Edit at d3", { taskType: 'RETRIEVAL_QUERY' });

    if (embedding) {
        console.log("✅ Success! Embedding generated. Length:", embedding.length);
        console.log("Vector snippet:", embedding.slice(0, 5), "...");
    } else {
        console.error("❌ Failed: Embedding returned null. Check logs for [RAG_EMBEDDING_ERROR]");
    }
}

test();

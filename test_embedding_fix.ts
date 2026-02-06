import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { embedText } from './lib/rag/embeddingClient';

async function test() {
    console.log("Testing embedding with query: 'The Edit at d3'");

    // Test with default model
    const embedding = await embedText("The Edit at d3", { taskType: 'RETRIEVAL_QUERY' });

    if (embedding) {
        console.log("✅ Success! Embedding generated. Length:", embedding.length);
        console.log("Vector snippet:", embedding.slice(0, 5), "...");
    } else {
        console.error("❌ Failed: Embedding returned null.");
    }

    // Test with text-embedding-004 (which we know might fail) to check error handling
    console.log("\nTesting defensive error handling with invalid model...");
    process.env.RAG_EMBEDDING_MODEL = "models/invalid-model-name";
    const failedEmbedding = await embedText("Test query");

    if (failedEmbedding === null) {
        console.log("✅ Success! Error handled gracefully (returned null).");
    } else {
        console.error("❌ Failed: Error occurred but did not return null.");
    }
}

test();

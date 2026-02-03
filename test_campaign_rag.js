
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
    const question = "What are the payment plans for Binghatti Skyrise?";
    const projectId = '225d060a-ec86-495b-a40d-872c96123467';
    const tenantId = 1;

    console.log(`Question: ${question}`);
    console.log(`Project: ${projectId}`);

    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embResult = await embedModel.embedContent(question);
    const embedding = embResult.embedding.values;

    const { data: results, error } = await supabase.rpc('match_rag_chunks', {
        query_embedding: embedding,
        match_threshold: 0.35,
        match_count: 5,
        filter_tenant_id: tenantId,
        filter_project_id: projectId
    });

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`\nFound ${results.length} matching chunks:`);
        results.forEach((r, i) => {
            console.log(`\n[Result ${i + 1}] Score: ${r.similarity.toFixed(4)}`);
            console.log(`Content: ${r.content}`);
        });
    }
}
main();

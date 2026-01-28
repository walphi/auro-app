
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateEmbedding } from '../lib/rag/rag-utils';
import { RAG_CONFIG } from '../lib/rag/prompts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const EVAL_CASES = [
    {
        name: "Agency History (State A)",
        query: "Who founded Provident and when?",
        tenant_id: 1,
        project_id: null,
        expected_folder: "agency_history"
    },
    {
        name: "Campaign FAQ (State B)",
        query: "What is the payment plan for Binghatti Skyrise?",
        tenant_id: 1,
        project_id: "225d060a-ec86-495b-a40d-872c96123467",
        expected_folder: "campaign_docs"
    },
    {
        name: "Objection Handling",
        query: "The price seems a bit high for Business Bay.",
        tenant_id: 1,
        project_id: "225d060a-ec86-495b-a40d-872c96123467",
        expected_folder: "campaign_docs"
    }
];

async function runEval() {
    console.log('\n================================================');
    console.log('🚀  RAG EVALUATION SUITE');
    console.log('================================================\n');

    for (const test of EVAL_CASES) {
        console.log(`CASE: ${test.name}`);
        console.log(`QUERY: "${test.query}"`);

        const embedding = await generateEmbedding(test.query);
        if (!embedding) {
            console.log('❌ Failed to generate embedding');
            continue;
        }

        const isCampaign = test.project_id !== null;
        const config = isCampaign ? RAG_CONFIG.campaign : RAG_CONFIG.agency;

        const { data, error } = await supabase.rpc('match_rag_chunks', {
            query_embedding: embedding,
            match_threshold: config.matchThreshold,
            match_count: config.matchCount,
            filter_tenant_id: test.tenant_id,
            filter_project_id: test.project_id
        });

        if (error) {
            console.log(`❌ RPC Error: ${error.message}`);
            continue;
        }

        if (!data || data.length === 0) {
            console.log('⚠️  No matches found.');
        } else {
            const topMatch = data[0];
            const isMatch = topMatch.folder_id === test.expected_folder;

            console.log(`${isMatch ? '✅' : '❌'} Top Match: [${topMatch.folder_id}] (Score: ${topMatch.similarity.toFixed(4)})`);
            console.log(`SOURCE: ${topMatch.document_id}`);
            console.log(`CONTENT: "${topMatch.content.substring(0, 100)}..."`);
        }
        console.log('------------------------------------------------\n');
    }
}

runEval().catch(console.error);

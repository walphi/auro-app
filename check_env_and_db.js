import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load envs
const mcpEnvPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');

const mcpConfig = {};
const rootConfig = {};

if (fs.existsSync(mcpEnvPath)) {
    const parsed = dotenv.parse(fs.readFileSync(mcpEnvPath));
    Object.assign(mcpConfig, parsed);
}

if (fs.existsSync(rootEnvPath)) {
    const parsed = dotenv.parse(fs.readFileSync(rootEnvPath));
    Object.assign(rootConfig, parsed);
}

const mcpUrl = mcpConfig.SUPABASE_URL || mcpConfig.VITE_SUPABASE_URL;
const rootUrl = rootConfig.SUPABASE_URL || rootConfig.VITE_SUPABASE_URL;

console.log('--- ENV CHECK ---');
console.log(`MCP  Env: ${mcpUrl ? mcpUrl.substring(0, 20) + '...' : 'MISSING'}`);
console.log(`ROOT Env: ${rootUrl ? rootUrl.substring(0, 20) + '...' : 'MISSING'}`);

if (mcpUrl !== rootUrl) {
    console.log('WARNING: URL MISMATCH! The Dashboard (Root) and MCP Agent are looking at different databases.');
} else {
    console.log('URLs match. Verifying data in the configured DB...');
}

// Connect to Root DB (Dashboard's DB) to find the profile
const targetUrl = rootUrl || mcpUrl;
const targetKey = rootConfig.SUPABASE_SERVICE_ROLE_KEY || rootConfig.VITE_SUPABASE_ANON_KEY || mcpConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!targetUrl || !targetKey) {
    console.log('Cannot connect: Missing credentials in Root .env');
    process.exit(1);
}

const supabase = createClient(targetUrl, targetKey);

async function main() {
    console.log('\n--- SEARCHING FOR PROVIDENT ---');
    console.log(`Target DB: ${targetUrl}`);

    // Search by source name
    const { data: sources, error } = await supabase
        .from('knowledge_base')
        .select('id, project_id, source_name, created_at, embedding')
        .ilike('source_name', '%Provident%')
        .limit(10);

    if (error) {
        console.error('Error searching source_name:', error.message);
    } else if (sources.length > 0) {
        console.log(`Found ${sources.length} sources matching '%Provident%':`);
        sources.forEach(s => {
            const hasEmb = s.embedding ? 'YES' : 'NO';
            console.log(`- [${s.created_at}] Proj: ${s.project_id} | Src: ${s.source_name} | Emb: ${hasEmb}`);
        });

        const projectId = sources[0].project_id;
        console.log(`\nChecking Project ID: ${projectId} in rag_chunks...`);

        const { count, error: countErr } = await supabase
            .from('rag_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('folder_id', projectId);

        if (countErr) console.error('Error checking rag_chunks:', countErr.message);
        else console.log(`Chunks found in rag_chunks: ${count}`);

    } else {
        console.log('No sources found matching "Provident". Checking recent entries regardless of name...');
        const { data: recent } = await supabase
            .from('knowledge_base')
            .select('source_name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
        if (recent) recent.forEach(r => console.log(`Recent: ${r.created_at} - ${r.source_name}`));
    }
}

main();

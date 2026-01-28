
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { chunkText, generateEmbedding } from '../lib/rag/rag-utils';
import { RAG_CONFIG } from '../lib/rag/prompts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const args = process.argv.slice(2);
    let tenantId: number | null = null;
    let projectName: string | null = null;
    let inputPath: string | null = null;

    // Try flags
    const tenantIdIdx = args.indexOf('--tenant-id');
    const projectNameIdx = args.indexOf('--project-name');
    const pathIdx = args.indexOf('--path');

    if (tenantIdIdx !== -1) tenantId = parseInt(args[tenantIdIdx + 1]);
    if (projectNameIdx !== -1) projectName = args[projectNameIdx + 1];
    if (pathIdx !== -1) inputPath = args[pathIdx + 1];

    // Positional fallback
    if (!tenantId && args[0]) tenantId = parseInt(args[0]);
    if (!projectName && args[1]) projectName = args[1];
    if (!inputPath && args[2]) inputPath = args[2];

    if (!tenantId || !projectName || !inputPath) {
        console.error('Usage: npm run ingest:campaign -- --tenant-id <id> --project-name <name> --path <file_or_dir>');
        console.log('Received:', args);
        process.exit(1);
    }

    console.log(`[Campaign Ingest] Tenant: ${tenantId}, Project: ${projectName}`);

    // 1. Resolve Project UUID
    let { data: project, error: pError } = await supabase
        .from('projects')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', projectName)
        .single();

    if (pError || !project) {
        console.log(`[Campaign Ingest] Creating new project entry...`);
        const { data: newP, error: createError } = await supabase
            .from('projects')
            .insert({
                name: projectName,
                tenant_id: tenantId,
                status: 'Active'
            })
            .select('id')
            .single();

        if (createError) {
            console.error('Error creating project:', createError.message);
            process.exit(1);
        }
        project = newP;
    }

    const projectId = project.id;
    console.log(`[Campaign Ingest] Project UUID: ${projectId}`);

    // 2. Identify Files
    const files = fs.lstatSync(inputPath).isDirectory()
        ? fs.readdirSync(inputPath).filter(f => f.endsWith('.txt')).map(f => path.join(inputPath!, f))
        : [inputPath];

    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const filename = path.basename(filePath);
        const folderId = 'campaign_docs';

        console.log(`[Campaign Ingest] Ingesting ${filename}...`);

        // 3. Knowledge Base
        const { data: kbDoc, error: kbError } = await supabase
            .from('knowledge_base')
            .insert({
                tenant_id: tenantId,
                project_id: projectId,
                folder_id: folderId,
                type: 'brochure',
                source_name: filename,
                content: content,
                metadata: {
                    project_name: projectName,
                    source: filename
                }
            })
            .select('id')
            .single();

        if (kbError) {
            console.error(`Error ingesting ${filename}:`, kbError.message);
            continue;
        }

        // 4. Chunk & Embed using tuned parameters for campaigns
        const chunks = chunkText(content, {
            chunkSize: RAG_CONFIG.campaign.chunkSize,
            overlap: RAG_CONFIG.campaign.overlap
        });
        for (const chunk of chunks) {
            const embedding = await generateEmbedding(chunk.text);
            if (embedding) {
                const { data: upsertData, error: upsertError } = await supabase.from('rag_chunks').upsert({
                    chunk_id: `campaign:${projectId}:${kbDoc.id}:${chunk.index}`,
                    tenant_id: tenantId,
                    client_id: tenantId === 1 ? 'provident' : `tenant_${tenantId}`, // Temporary fix for NOT NULL constraint
                    project_id: projectId,
                    folder_id: folderId,
                    document_id: kbDoc.id,
                    content: chunk.text,
                    embedding: embedding,
                    metadata: {
                        project_name: projectName,
                        source: filename,
                        chunk_index: chunk.index
                    }
                }, { onConflict: 'chunk_id' }).select();

                if (upsertError) {
                    console.error(`[Campaign Ingest] Upsert error:`, upsertError.message);
                } else {
                    console.log(`[Campaign Ingest] Upserted chunk ${chunk.index} (ID: campaign:${projectId}:${kbDoc.id}:${chunk.index})`);
                }
            }
        }
        console.log(`[Campaign Ingest] Finished ${filename} (${chunks.length} chunks)`);
    }

    console.log(`[Campaign Ingest] All done.`);
}

main().catch(console.error);

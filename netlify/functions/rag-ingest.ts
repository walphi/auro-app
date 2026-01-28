import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { chunkText, generateEmbedding } from "../../lib/rag/rag-utils";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const body = JSON.parse(event.body || '{}');
        const { tenant_id, project_id, folder_id, sections, text, filename } = body;

        if (!tenant_id || !folder_id || (!sections && !text)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing required fields: tenant_id, folder_id, and either text or sections[]" })
            };
        }

        const isDashboardSync = !!sections;
        const fullContent = isDashboardSync
            ? sections.map((s: any) => `## ${s.title}\n${s.content}`).join('\n\n')
            : text;

        console.log(`[RAG-Ingest] Ingesting for Tenant: ${tenant_id}, Project: ${project_id}, Folder: ${folder_id}, Mode: ${isDashboardSync ? 'Dashboard' : 'Text'}`);

        // 1. Transactional ID logic
        // Dashboard syncs (Identity/Campaign fields) use stable lookup via folder/tenant/project, not by ID
        // Direct text/file uploads create unique UUIDs
        const docId = crypto.randomUUID();
        const lookupKey = isDashboardSync
            ? (project_id ? `project_${project_id}_${folder_id}` : `tenant_${tenant_id}_${folder_id}`)
            : null;

        if (isDashboardSync && lookupKey) {
            // Cleanup existing dashboard-scoped content by folder/tenant
            const { data: existing } = await supabase
                .from('knowledge_base')
                .select('id')
                .eq('tenant_id', tenant_id)
                .eq('folder_id', folder_id)
                .eq('project_id', project_id || null)
                .limit(1)
                .maybeSingle();

            if (existing?.id) {
                await supabase.from('rag_chunks').delete().eq('document_id', existing.id);
                await supabase.from('knowledge_base').delete().eq('id', existing.id);
            }
        }

        // 2. Synthesize sections into a single corpus
        // (fullContent is already calculated above)

        // 3. Create fresh knowledge_base entry
        const { error: kbError } = await supabase
            .from('knowledge_base')
            .insert({
                id: docId,
                tenant_id: tenant_id,
                project_id: project_id || null, // UUID
                folder_id: folder_id, // text
                type: folder_id === 'agency_history' ? 'brand_story' : 'campaign_manual',
                source_name: filename || (folder_id === 'agency_history' ? 'Agency Summary' : 'Campaign Details'),
                content: fullContent,
                metadata: {
                    last_updated: new Date().toISOString(),
                    synced_via: isDashboardSync ? 'broker_dashboard' : 'file_upload'
                }
            });

        if (kbError) throw new Error(`KB Error: ${kbError.message}`);

        // 4. Chunk & Embed in parallel
        const chunks = chunkText(fullContent);
        console.log(`[RAG-Ingest] Created ${chunks.length} chunks for doc: ${docId}. Generating embeddings in parallel...`);

        const chunkPromises = chunks.map(async (chunk) => {
            try {
                const embedding = await generateEmbedding(chunk.text);
                if (!embedding) return null;

                return {
                    chunk_id: `sync:${docId}:${chunk.index}`,
                    tenant_id: tenant_id,
                    client_id: tenant_id === 1 ? 'provident' : `tenant_${tenant_id}`,
                    project_id: project_id || null,
                    folder_id: folder_id,
                    document_id: docId,
                    content: chunk.text,
                    embedding: embedding,
                    metadata: {
                        chunk_index: chunk.index,
                        folder: folder_id,
                        source_name: filename || (folder_id === 'agency_history' ? 'Agency Summary' : 'Campaign Details'),
                        is_sync: true,
                        ...chunk.metadata
                    }
                };
            } catch (err) {
                console.error(`[RAG-Ingest] Error processing chunk ${chunk.index}:`, err);
                return null;
            }
        });

        const results = await Promise.all(chunkPromises);
        const validChunks = results.filter((c): c is NonNullable<typeof c> => c !== null);

        console.log(`[RAG-Ingest] Generated ${validChunks.length}/${chunks.length} embeddings. Batch inserting to DB...`);

        if (validChunks.length > 0) {
            const { error: batchError } = await supabase
                .from('rag_chunks')
                .insert(validChunks);

            if (batchError) {
                console.error(`[RAG-Ingest] Batch Insert Error:`, batchError.message);
                throw new Error(`Batch Insert Error: ${batchError.message}`);
            }
        }

        console.log(`[RAG-Ingest] Ingestion complete. Success: ${validChunks.length}/${chunks.length}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Successfully synced ${validChunks.length} chunks to ${folder_id}`,
                doc_id: docId
            })
        };

    } catch (error: any) {
        console.error('[RAG-Ingest] Fatal Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

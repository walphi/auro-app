import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate embedding via Gemini API
async function generateEmbedding(text: string): Promise<number[] | null> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return null;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: text.substring(0, 4000) }] }
                })
            }
        );

        if (!response.ok) {
            console.error(`Gemini error: ${response.status}`);
            return null;
        }

        const result = await response.json();
        return result.embedding?.values || null;
    } catch (err: any) {
        console.error('Embedding error:', err.message);
        return null;
    }
}

// Process unembedded knowledge_base entries
async function processEmbeddings(limit: number = 5): Promise<{ processed: number, errors: number }> {
    let processed = 0;
    let errors = 0;

    // Get entries without embeddings (where embedding is NULL)
    const { data: entries, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('id, project_id, content, source_name, type, metadata')
        .is('embedding', null)
        .limit(limit);

    if (fetchError) {
        console.error('Fetch error:', fetchError.message);
        return { processed: 0, errors: 1 };
    }

    if (!entries || entries.length === 0) {
        console.log('No entries to process');
        return { processed: 0, errors: 0 };
    }

    console.log(`Processing ${entries.length} entries...`);

    for (const entry of entries) {
        try {
            if (!entry.content) continue;

            // Generate embedding
            const embedding = await generateEmbedding(entry.content);

            if (!embedding) {
                errors++;
                continue;
            }

            // Update knowledge_base with embedding
            const { error: updateError } = await supabase
                .from('knowledge_base')
                .update({ embedding })
                .eq('id', entry.id);

            if (updateError) {
                console.error(`Update error for ${entry.id}:`, updateError.message);
                errors++;
                continue;
            }

            // Also insert into rag_chunks for MCP compatibility
            const clientId = entry.metadata?.client_id || 'demo';
            const folderId = entry.project_id || 'default';

            const { error: chunkError } = await supabase
                .from('rag_chunks')
                .upsert({
                    chunk_id: `${clientId}:${folderId}:${entry.id}:0`,
                    client_id: clientId,
                    folder_id: folderId,
                    document_id: entry.id,
                    content: entry.content,
                    embedding: embedding,
                    metadata: {
                        source_name: entry.source_name,
                        type: entry.type,
                        ...entry.metadata
                    }
                }, { onConflict: 'chunk_id' });

            if (chunkError) {
                console.error(`rag_chunks error for ${entry.id}:`, chunkError.message);
                // Don't count as error since knowledge_base was updated
            }

            processed++;
            console.log(`Processed: ${entry.source_name} (${entry.id})`);

        } catch (err: any) {
            console.error(`Error processing ${entry.id}:`, err.message);
            errors++;
        }
    }

    return { processed, errors };
}

// Main handler - can be called via HTTP or scheduled
export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Optional: Require auth token for manual triggers
    const authHeader = event.headers.authorization || '';
    const expectedToken = process.env.ANTIGRAVITY_API_TOKEN;

    // Allow if no token is set, or if token matches
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
        // For now, allow unauthenticated access for testing
        console.log('Warning: No auth token provided');
    }

    console.log('[Embeddings] Starting processing...');

    const result = await processEmbeddings(5);

    console.log(`[Embeddings] Complete: ${result.processed} processed, ${result.errors} errors`);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            ...result,
            message: `Processed ${result.processed} entries`
        })
    };
};

// Scheduled version - runs every 5 minutes
export const config = {
    schedule: "*/5 * * * *"  // Every 5 minutes
};

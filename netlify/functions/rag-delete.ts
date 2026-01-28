import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Delete a RAG source document and its associated chunks
 */
export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { id, document_id } = body;

        const docId = id || document_id;

        if (!docId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing required field: id or document_id" })
            };
        }

        console.log(`[RAG-Delete] Deleting document and chunks for: ${docId}`);

        // 1. Delete associated chunks first (foreign key reference)
        const { error: chunksError, count: chunksDeleted } = await supabase
            .from('rag_chunks')
            .delete()
            .eq('document_id', docId);

        if (chunksError) {
            console.warn(`[RAG-Delete] Chunk deletion warning: ${chunksError.message}`);
        } else {
            console.log(`[RAG-Delete] Deleted ${chunksDeleted || 0} chunks`);
        }

        // 2. Delete the knowledge_base entry
        const { error: kbError } = await supabase
            .from('knowledge_base')
            .delete()
            .eq('id', docId);

        if (kbError) {
            throw new Error(`Failed to delete document: ${kbError.message}`);
        }

        console.log(`[RAG-Delete] Successfully deleted document: ${docId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Deleted document ${docId} and associated chunks`
            })
        };

    } catch (error: any) {
        console.error('[RAG-Delete] Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Conversion weight mapping
const CONVERSION_WEIGHTS = {
    booking_confirmed: 3.0,
    qualified: 1.5,
    dropped: 0.5,
    unknown: 1.0
};

interface ConversationMessage {
    id: string;
    lead_id: string;
    sender: string;
    content: string;
    created_at: string;
    type: string;
    meta?: string;
}

interface LearnableChunk {
    content: string;
    type: 'qa_pair' | 'objection_handling' | 'closing_phrase' | 'general';
    topic?: string;
}

/**
 * Extract learnable chunks from conversation messages
 * Identifies Q&A pairs, objection handling, and successful closings
 */
function extractChunks(messages: ConversationMessage[], outcome: string): LearnableChunk[] {
    const chunks: LearnableChunk[] = [];

    for (let i = 0; i < messages.length - 1; i++) {
        const current = messages[i];
        const next = messages[i + 1];

        // Skip system messages
        if (current.sender === 'System' || next.sender === 'System') continue;

        // Q&A Pair: Lead asks, AI responds
        if (current.sender === 'Lead' && next.sender === 'AURO_AI') {
            const question = current.content.trim();
            const answer = next.content.trim();

            // Skip very short or empty exchanges
            if (question.length < 10 || answer.length < 20) continue;

            // Detect objection handling patterns
            const objectionPatterns = /too expensive|not interested|maybe later|call me back|not now|think about it/i;
            if (objectionPatterns.test(question)) {
                chunks.push({
                    content: `OBJECTION: "${question}"\nRESPONSE: "${answer}"`,
                    type: 'objection_handling',
                    topic: detectTopic(question + ' ' + answer)
                });
            } else {
                chunks.push({
                    content: `Q: "${question}"\nA: "${answer}"`,
                    type: 'qa_pair',
                    topic: detectTopic(question + ' ' + answer)
                });
            }
        }

        // Closing phrase detection: AI response that led to positive outcome
        if (outcome === 'booking_confirmed' && next.sender === 'AURO_AI') {
            const closingPatterns = /book a viewing|schedule|confirm|set up a time|when would you like|tomorrow|this week/i;
            if (closingPatterns.test(next.content)) {
                chunks.push({
                    content: `SUCCESSFUL CLOSING: "${next.content}"`,
                    type: 'closing_phrase',
                    topic: 'booking'
                });
            }
        }
    }

    return chunks;
}

/**
 * Detect topic from text content
 */
function detectTopic(text: string): string {
    const lowered = text.toLowerCase();

    if (/price|cost|budget|aed|payment|afford/i.test(lowered)) return 'pricing';
    if (/bed|room|studio|apartment|villa|penthouse/i.test(lowered)) return 'property_type';
    if (/marina|downtown|jbr|palm|creek|business bay/i.test(lowered)) return 'location';
    if (/view|visit|tour|see|show me/i.test(lowered)) return 'viewing';
    if (/yield|roi|investment|rental|return/i.test(lowered)) return 'investment';
    if (/payment plan|installment|handover/i.test(lowered)) return 'payment_plans';

    return 'general';
}

/**
 * Check if chunk is too similar to existing chunks (deduplication)
 */
async function isDuplicate(embedding: number[], clientId: string): Promise<boolean> {
    const { data } = await supabase.rpc('match_rag_chunks', {
        query_embedding: embedding,
        match_threshold: 0.9, // High threshold = very similar
        match_count: 1,
        filter_client_id: clientId,
        filter_folder_id: null
    });

    return data && data.length > 0;
}

/**
 * Generate embedding for text using Gemini
 */
async function generateEmbedding(text: string): Promise<number[]> {
    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await embedModel.embedContent(text);
    return result.embedding.values;
}

/**
 * Process conversations for a specific lead and insert learned chunks
 */
async function processLeadConversation(
    leadId: string,
    outcome: string,
    clientId: string = 'demo'
): Promise<number> {
    console.log(`[RAG-LEARN] Processing lead ${leadId} with outcome: ${outcome}`);

    // Fetch recent messages for this lead
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })
        .limit(50);

    if (error || !messages || messages.length < 2) {
        console.log(`[RAG-LEARN] No processable messages for lead ${leadId}`);
        return 0;
    }

    // Extract learnable chunks
    const chunks = extractChunks(messages, outcome);
    console.log(`[RAG-LEARN] Extracted ${chunks.length} potential chunks`);

    const conversionWeight = CONVERSION_WEIGHTS[outcome as keyof typeof CONVERSION_WEIGHTS] || 1.0;
    let insertedCount = 0;

    for (const chunk of chunks) {
        try {
            // Generate embedding
            const embedding = await generateEmbedding(chunk.content);

            // Check for duplicates
            if (await isDuplicate(embedding, clientId)) {
                console.log(`[RAG-LEARN] Skipping duplicate chunk`);
                continue;
            }

            // Insert into rag_chunks
            const chunkId = `learn_${leadId}_${Date.now()}_${insertedCount}`;
            const { error: insertError } = await supabase
                .from('rag_chunks')
                .insert({
                    chunk_id: chunkId,
                    client_id: clientId,
                    folder_id: 'conversation_learning',
                    document_id: `lead_${leadId}`,
                    content: chunk.content,
                    embedding: embedding,
                    metadata: {
                        source: 'conversation_learning',
                        lead_id: leadId,
                        outcome: outcome,
                        chunk_type: chunk.type,
                        topic: chunk.topic,
                        learned_at: new Date().toISOString()
                    },
                    source_type: chunk.type === 'closing_phrase' ? 'winning_script' : 'conversation_learning',
                    conversion_weight: conversionWeight,
                    outcome_correlation: outcome === 'booking_confirmed' ? 0.8 :
                        outcome === 'qualified' ? 0.5 : 0.2
                });

            if (insertError) {
                console.error(`[RAG-LEARN] Insert error:`, insertError);
            } else {
                insertedCount++;
            }
        } catch (e: any) {
            console.error(`[RAG-LEARN] Chunk processing error:`, e.message);
        }
    }

    return insertedCount;
}

/**
 * Batch process unprocessed conversations (hourly cron pattern)
 */
async function batchProcessConversations(clientId: string = 'demo'): Promise<{ processed: number; chunks: number }> {
    console.log(`[RAG-LEARN] Starting batch processing for client: ${clientId}`);

    // Find leads with recent call-ended or qualified status that haven't been processed
    // Using a simple approach: look for leads updated in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, status, booking_status')
        .or(`booking_status.eq.confirmed,status.eq.Qualified`)
        .gte('updated_at', oneHourAgo);

    if (error || !leads) {
        console.log(`[RAG-LEARN] No leads to process:`, error?.message);
        return { processed: 0, chunks: 0 };
    }

    let totalChunks = 0;
    for (const lead of leads) {
        const outcome = lead.booking_status === 'confirmed' ? 'booking_confirmed' :
            lead.status === 'Qualified' ? 'qualified' : 'unknown';

        const chunks = await processLeadConversation(lead.id, outcome, clientId);
        totalChunks += chunks;
    }

    // Calculate topic distribution for logging
    const { data: topicStats } = await supabase
        .from('rag_chunks')
        .select('metadata')
        .eq('source_type', 'conversation_learning')
        .gte('created_at', oneHourAgo);

    const topicCounts: Record<string, number> = {};
    if (topicStats) {
        topicStats.forEach((row: any) => {
            const topic = row.metadata?.topic || 'general';
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
    }

    const topTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0];
    const topicPercent = topTopic ? Math.round((topTopic[1] / totalChunks) * 100) : 0;

    console.log(`[RAG-LEARN] Added ${totalChunks} chunks from ${leads.length} chats${topTopic ? `: ${topicPercent}% mention '${topTopic[0]}'` : ''}`);

    return { processed: leads.length, chunks: totalChunks };
}

export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const action = body.action || 'batch';
        const clientId = body.client_id || 'demo';

        if (action === 'process_lead') {
            // Process single lead (triggered from vapi.ts or whatsapp.ts)
            const { lead_id, outcome } = body;
            if (!lead_id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing lead_id' }) };
            }

            const chunks = await processLeadConversation(lead_id, outcome || 'unknown', clientId);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: `Processed lead ${lead_id}`,
                    chunks_added: chunks
                })
            };
        } else if (action === 'batch') {
            // Batch process (hourly cron)
            const result = await batchProcessConversations(clientId);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: `Batch processing complete`,
                    leads_processed: result.processed,
                    chunks_added: result.chunks
                })
            };
        } else {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
        }

    } catch (error: any) {
        console.error('[RAG-LEARN] Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

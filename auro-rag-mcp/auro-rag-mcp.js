#!/usr/bin/env node
/**
 * AURO RAG MCP Server
 * 
 * A multi-tenant Model Context Protocol (MCP) server for AURO's RAG system.
 * Provides tools for document management, web crawling, hot topics, and semantic search.
 * 
 * Transport: stdio (JSON-RPC 2.0)
 * 
 * Multi-tenancy: All operations are scoped by client_id and folder_id to ensure
 * complete tenant isolation in the vector database.
 * 
 * =============================================================================
 * REQUIRED ENVIRONMENT VARIABLES:
 * =============================================================================
 * 
 * SUPABASE_URL           - Your Supabase project URL (e.g., https://xxx.supabase.co)
 * SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (NOT anon key - needed for RLS bypass)
 * RAG_SCHEMA             - Schema name for RAG tables (default: 'public')
 * RAG_TABLE              - Table name for vector chunks (default: 'rag_chunks')
 * EMBEDDING_DIMENSION    - Vector dimension (default: 1536 for OpenAI ada-002)
 * 
 * Optional (for future embedding integration):
 * OPENAI_API_KEY         - OpenAI API key for embeddings
 * GOOGLE_AI_API_KEY      - Google AI API key for Gemini embeddings
 * 
 * =============================================================================
 */

const readline = require('readline');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SERVER_INFO = {
    name: 'auro-rag-mcp',
    version: '1.0.0'
};

const PROTOCOL_VERSION = '2024-11-05';

// Environment configuration with defaults
const config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ragSchema: process.env.RAG_SCHEMA || 'public',
    ragTable: process.env.RAG_TABLE || 'rag_chunks',
    embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION || '768', 10)
};

// =============================================================================
// SUPABASE CLIENT INITIALIZATION
// =============================================================================

let supabase = null;

/**
 * Initialize Supabase client lazily
 * This allows the server to start even without env vars (for testing)
 */
function getSupabaseClient() {
    if (supabase) return supabase;

    if (!config.supabaseUrl || !config.supabaseKey) {
        console.error('[Supabase] WARNING: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        console.error('[Supabase] Vector DB operations will fail. Set environment variables.');
        return null;
    }

    try {
        // Dynamic import for CommonJS compatibility in Docker
        const { createClient } = require('@supabase/supabase-js');
        supabase = createClient(config.supabaseUrl, config.supabaseKey, {
            auth: { persistSession: false }
        });
        console.error(`[Supabase] Client initialized for ${config.supabaseUrl}`);
        return supabase;
    } catch (error) {
        console.error('[Supabase] Failed to initialize client:', error.message);
        return null;
    }
}

// =============================================================================
// SUPABASE PGVECTOR CLIENT
// =============================================================================

/**
 * @typedef {Object} VectorDocument
 * @property {string} id - Unique document ID (becomes chunk_id)
 * @property {number[]} embedding - Vector embedding
 * @property {Object} metadata - Document metadata including client_id, folder_id, etc.
 * @property {string} content - Original text content
 */

/**
 * @typedef {Object} VectorQueryResult
 * @property {string} id - Chunk ID
 * @property {number} score - Similarity score (0-1, higher is more similar)
 * @property {Object} metadata - Document metadata
 * @property {string} content - Chunk content
 */

const vectorDBClient = {
    /**
     * Upsert vectors into Supabase PGVector table
     * 
     * @param {string} collection - Collection name (unused, table is configured via env)
     * @param {VectorDocument[]} documents - Documents to upsert
     * @returns {Promise<{success: boolean, count: number, error?: string}>}
     */
    async upsert(collection, documents) {
        const client = getSupabaseClient();
        if (!client) {
            console.error('[VectorDB] No Supabase client - using stub mode');
            return { success: true, count: documents.length, stub: true };
        }

        console.error(`[VectorDB] Upserting ${documents.length} chunks to ${config.ragSchema}.${config.ragTable}`);

        try {
            // Transform documents to table schema
            const rows = documents.map(doc => ({
                chunk_id: doc.id,
                client_id: doc.metadata.client_id,
                folder_id: doc.metadata.folder_id,
                document_id: doc.metadata.document_id || doc.id.split(':')[2] || 'unknown',
                content: doc.content,
                embedding: `[${doc.embedding.join(',')}]`, // PGVector format
                metadata: doc.metadata
            }));

            // Upsert in batches of 100 to avoid payload limits
            const BATCH_SIZE = 100;
            let totalUpserted = 0;

            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);

                const { data, error } = await client
                    .from(config.ragTable)
                    .upsert(batch, {
                        onConflict: 'chunk_id',
                        ignoreDuplicates: false
                    });

                if (error) {
                    console.error('[VectorDB] Upsert error:', error);
                    throw new Error(`Supabase upsert failed: ${error.message}`);
                }

                totalUpserted += batch.length;
                console.error(`[VectorDB] Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total: ${totalUpserted}`);
            }

            return { success: true, count: totalUpserted };
        } catch (error) {
            console.error('[VectorDB] Upsert failed:', error);
            return { success: false, count: 0, error: error.message };
        }
    },

    /**
     * Query vectors with tenant isolation using PGVector similarity search
     * 
     * Uses the <=> operator for cosine distance (lower = more similar)
     * Results are filtered by client_id and folder_id for multi-tenancy
     * 
     * @param {string} collection - Collection name (unused)
     * @param {number[]} queryVector - Query embedding vector
     * @param {Object} filter - Must include client_id and folder_id
     * @param {number} topK - Number of results
     * @returns {Promise<VectorQueryResult[]>}
     */
    async query(collection, queryVector, filter, topK) {
        const client = getSupabaseClient();
        if (!client) {
            console.error('[VectorDB] No Supabase client - returning stub results');
            return [{
                id: 'stub-result',
                score: 0.95,
                content: 'Stub result - configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for real results',
                metadata: { ...filter, stub: true }
            }];
        }

        console.error(`[VectorDB] Querying with filter: client_id=${filter.client_id}, folder_id=${filter.folder_id}, top_k=${topK}`);

        try {
            // Use RPC call for vector similarity search
            // This requires a stored function in Supabase - see SQL at bottom of file
            const { data, error } = await client.rpc('match_rag_chunks', {
                query_embedding: queryVector,
                match_threshold: 0.0, // Return all matches, let topK limit
                match_count: topK,
                filter_client_id: filter.client_id,
                filter_folder_id: filter.folder_id
            });

            if (error) {
                console.error('[VectorDB] Query error:', error);

                // Fallback to basic query if RPC doesn't exist
                if (error.code === 'PGRST202') {
                    console.error('[VectorDB] RPC function not found - using fallback query');
                    return this.queryFallback(queryVector, filter, topK);
                }

                throw new Error(`Supabase query failed: ${error.message}`);
            }

            // Transform results to standard format
            // PGVector cosine distance: 0 = identical, 2 = opposite
            // Convert to similarity score: 1 - (distance / 2)
            return (data || []).map(row => ({
                id: row.chunk_id,
                score: row.similarity || (1 - (row.distance || 0) / 2),
                content: row.content,
                metadata: row.metadata || {}
            }));
        } catch (error) {
            console.error('[VectorDB] Query failed:', error);
            return [];
        }
    },

    /**
     * Fallback query without RPC (less efficient but works without setup)
     */
    async queryFallback(queryVector, filter, topK) {
        const client = getSupabaseClient();
        if (!client) return [];

        console.error('[VectorDB] Using fallback query (no vector similarity)');

        const { data, error } = await client
            .from(config.ragTable)
            .select('chunk_id, content, metadata')
            .eq('client_id', filter.client_id)
            .eq('folder_id', filter.folder_id)
            .limit(topK);

        if (error) {
            console.error('[VectorDB] Fallback query error:', error);
            return [];
        }

        // Return without similarity scores (fallback mode)
        return (data || []).map((row, index) => ({
            id: row.chunk_id,
            score: 1 - (index * 0.1), // Fake descending scores
            content: row.content,
            metadata: row.metadata || {}
        }));
    },

    /**
     * Delete vectors by filter (for cleanup/update operations)
     * 
     * @param {string} collection - Collection name (unused)
     * @param {Object} filter - Filter criteria (client_id, folder_id required, type optional)
     * @returns {Promise<{success: boolean, deleted: number}>}
     */
    async delete(collection, filter) {
        const client = getSupabaseClient();
        if (!client) {
            console.error('[VectorDB] No Supabase client - delete skipped');
            return { success: true, deleted: 0, stub: true };
        }

        console.error(`[VectorDB] Deleting chunks: client_id=${filter.client_id}, folder_id=${filter.folder_id}`);

        try {
            let query = client
                .from(config.ragTable)
                .delete()
                .eq('client_id', filter.client_id)
                .eq('folder_id', filter.folder_id);

            // Optional: filter by type (e.g., 'hot_topic')
            if (filter.type) {
                query = query.eq('metadata->>type', filter.type);
            }

            // Optional: filter by document_id
            if (filter.document_id) {
                query = query.eq('document_id', filter.document_id);
            }

            const { data, error, count } = await query.select('chunk_id');

            if (error) {
                console.error('[VectorDB] Delete error:', error);
                throw new Error(`Supabase delete failed: ${error.message}`);
            }

            const deleted = data ? data.length : 0;
            console.error(`[VectorDB] Deleted ${deleted} chunks`);
            return { success: true, deleted };
        } catch (error) {
            console.error('[VectorDB] Delete failed:', error);
            return { success: false, deleted: 0, error: error.message };
        }
    }
};

// =============================================================================
// EMBEDDING MODEL (STUBBED - PLUG IN REAL MODEL HERE)
// =============================================================================
/**
 * TODO: Replace stubbed embedding with real embedding model
 * 
 * Recommended options:
 * 
 * 1. OpenAI Embeddings (text-embedding-ada-002 or text-embedding-3-small):
 *    const { OpenAI } = require('openai');
 *    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *    const response = await openai.embeddings.create({
 *      model: 'text-embedding-3-small',
 *      input: text
 *    });
 *    return response.data[0].embedding;
 * 
 * 2. Google Gemini Embeddings:
 *    const { GoogleGenerativeAI } = require('@google/generative-ai');
 *    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
 *    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
 *    const result = await model.embedContent(text);
 *    return result.embedding.values;
 * 
 * 3. Supabase Edge Function with pg_vector + OpenAI
 *    (Call a Supabase Edge Function that handles embedding + storage)
 */

const EMBEDDING_DIMENSION = config.embeddingDimension;

/**
 * Generate embedding for text
 * 
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
async function generateEmbedding(text) {
    // ===== STUB IMPLEMENTATION =====
    // TODO: Replace with real embedding API call

    console.error(`[Embedding STUB] Generating ${EMBEDDING_DIMENSION}-dim embedding for text (${text.length} chars)`);

    // Deterministic stub based on text hash for consistent testing
    const hash = simpleHash(text);
    const embedding = Array.from({ length: EMBEDDING_DIMENSION }, (_, i) =>
        Math.sin(hash + i * 0.1) * 0.5
    );

    // Normalize to unit vector (required for cosine similarity)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
}

/**
 * Generate embeddings for multiple texts (batch)
 * 
 * @param {string[]} texts - Texts to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
    // TODO: Use batch API for efficiency (most embedding APIs support batch)
    // OpenAI: Can embed up to 2048 texts in one request
    // Gemini: Check current batch limits

    console.error(`[Embedding] Generating embeddings for ${texts.length} texts`);
    return Promise.all(texts.map(generateEmbedding));
}

/**
 * Simple hash function for deterministic stub embeddings
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
}

// =============================================================================
// CONTENT EXTRACTION (STUBBED)
// =============================================================================

/**
 * Extract text from HTML content
 * TODO: Use cheerio or jsdom for proper parsing
 */
async function extractTextFromHTML(html) {
    console.error(`[HTML Parser] Extracting text from HTML (${html.length} chars)`);

    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Fetch and extract content from URL
 * TODO: Implement with node-fetch or axios
 */
async function fetchAndExtractURL(url) {
    console.error(`[Crawler STUB] Fetching URL: ${url}`);

    return {
        title: `Page: ${url}`,
        content: `Content from ${url} would be extracted here. Implement web crawling.`,
        links: []
    };
}

// =============================================================================
// TEXT CHUNKING
// =============================================================================

/**
 * Split text into chunks for embedding
 * 
 * @param {string} text - Text to chunk
 * @param {Object} options - Chunking options
 * @returns {Array<{text: string, index: number, metadata: Object}>}
 */
function chunkText(text, { chunkSize = 1000, overlap = 200 } = {}) {
    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);

        // Try to break at sentence boundary
        if (end < text.length) {
            const breakPoint = text.lastIndexOf('. ', end);
            if (breakPoint > start + chunkSize / 2) {
                end = breakPoint + 1;
            }
        }

        const chunkText = text.slice(start, end).trim();
        if (chunkText.length > 0) {
            chunks.push({
                text: chunkText,
                index: index++,
                metadata: { char_start: start, char_end: end }
            });
        }

        start = end - overlap;
        if (start >= text.length || start < 0) break;
    }

    return chunks;
}

// =============================================================================
// RAG CORE FUNCTIONS
// =============================================================================

const COLLECTION_NAME = 'auro_rag';

/**
 * Embed and store documents in vector DB
 * 
 * Metadata structure for real estate listings:
 * - client_id: Tenant ID (required)
 * - folder_id: Agent folder ID (required)
 * - document_id: Original document ID
 * - listing_id: Property listing ID (optional, for property docs)
 * - listing_url: URL to listing detail page (optional)
 * - image_url: Primary image URL (optional)
 * - image_urls: Array of all image URLs (optional)
 * - floorplan_url: Floorplan image URL (optional)
 * - brochure_url: PDF brochure URL (optional)
 * - beds: Number of bedrooms (optional)
 * - baths: Number of bathrooms (optional)
 * - price: Price in AED (optional)
 * - price_formatted: Formatted price string (optional)
 * - community: Community/area name (optional)
 * - building: Building name (optional)
 * - property_type: apartment, villa, townhouse, etc. (optional)
 * - type: 'document' | 'hot_topic' | 'crawl' (required)
 * 
 * @param {string} clientId - Client/tenant ID
 * @param {string} folderId - Agent folder ID
 * @param {Array<{id: string, content: string, metadata?: Object}>} documents
 * @returns {Promise<{success: boolean, count: number, chunks: number}>}
 */
async function embedAndStore(clientId, folderId, documents) {
    console.error(`[RAG] embedAndStore: client=${clientId}, folder=${folderId}, docs=${documents.length}`);

    const allChunks = [];

    for (const doc of documents) {
        const chunks = chunkText(doc.content);

        for (const chunk of chunks) {
            allChunks.push({
                id: `${clientId}:${folderId}:${doc.id}:${chunk.index}`,
                content: chunk.text,
                metadata: {
                    // CRITICAL: Tenant isolation fields (always required)
                    client_id: clientId,
                    folder_id: folderId,
                    // Document tracking
                    document_id: doc.id,
                    chunk_index: chunk.index,
                    chunk_total: chunks.length,
                    ...chunk.metadata,
                    // Merge in document metadata (may include listing info)
                    ...(doc.metadata || {}),
                    // Ensure type is set
                    type: doc.metadata?.type || 'document',
                    // Timestamp
                    indexed_at: new Date().toISOString()
                }
            });
        }
    }

    if (allChunks.length === 0) {
        console.error('[RAG] No chunks to embed');
        return { success: true, count: 0, chunks: 0 };
    }

    // Generate embeddings in batches
    const BATCH_SIZE = 50;
    const vectorDocs = [];

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batch = allChunks.slice(i, i + BATCH_SIZE);
        const embeddings = await generateEmbeddings(batch.map(c => c.content));

        for (let j = 0; j < batch.length; j++) {
            vectorDocs.push({
                id: batch[j].id,
                embedding: embeddings[j],
                metadata: batch[j].metadata,
                content: batch[j].content
            });
        }
    }

    // Store in vector DB
    const result = await vectorDBClient.upsert(COLLECTION_NAME, vectorDocs);

    return {
        success: result.success,
        count: documents.length,
        chunks: vectorDocs.length,
        error: result.error
    };
}

/**
 * Query vectors with tenant isolation
 * 
 * Returns results with full metadata for downstream rendering:
 * - WhatsApp can use image_url for media messages
 * - Voice agents can read price, beds, baths, community
 * - Dashboard can link to listing_url
 * 
 * @param {string} clientId - Client/tenant ID
 * @param {string} folderId - Agent folder ID
 * @param {string} query - Search query
 * @param {number} [topK=5] - Number of results
 * @returns {Promise<VectorQueryResult[]>}
 */
async function queryVectors(clientId, folderId, query, topK = 5) {
    console.error(`[RAG] queryVectors: client=${clientId}, folder=${folderId}, top_k=${topK}`);
    console.error(`[RAG] Query: "${query.slice(0, 100)}${query.length > 100 ? '...' : ''}"`);

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // CRITICAL: Always filter by client_id and folder_id
    const filter = {
        client_id: clientId,
        folder_id: folderId
    };

    const results = await vectorDBClient.query(COLLECTION_NAME, queryEmbedding, filter, topK);

    console.error(`[RAG] Found ${results.length} results`);
    return results;
}

// =============================================================================
// MCP TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
    {
        name: 'upsert_documents',
        description: 'Upload and index documents into an agent folder for RAG. Documents are chunked, embedded, and stored with full metadata for downstream rendering (images, prices, etc).',
        inputSchema: {
            type: 'object',
            properties: {
                client_id: {
                    type: 'string',
                    description: 'Unique identifier for the client/tenant'
                },
                folder_id: {
                    type: 'string',
                    description: 'Agent folder ID for document organization'
                },
                files: {
                    type: 'array',
                    description: 'Array of files to upsert',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Unique file identifier' },
                            filename: { type: 'string', description: 'Original filename' },
                            content: { type: 'string', description: 'Text content of the file' },
                            content_type: { type: 'string', description: 'MIME type' },
                            metadata: {
                                type: 'object',
                                description: 'Additional metadata (listing_id, image_url, beds, baths, price, community, etc.)'
                            }
                        },
                        required: ['id', 'filename', 'content']
                    }
                }
            },
            required: ['client_id', 'folder_id', 'files']
        }
    },
    {
        name: 'crawl_and_index_url',
        description: 'Crawl a URL (with optional depth) and index the content into an agent folder.',
        inputSchema: {
            type: 'object',
            properties: {
                client_id: { type: 'string', description: 'Client/tenant ID' },
                folder_id: { type: 'string', description: 'Agent folder ID' },
                url: { type: 'string', description: 'Starting URL to crawl' },
                depth: { type: 'integer', description: 'Max crawl depth (0-3)', default: 0, minimum: 0, maximum: 3 }
            },
            required: ['client_id', 'folder_id', 'url']
        }
    },
    {
        name: 'inject_hot_topic',
        description: 'Inject a high-priority temporary context item (new launches, events, urgent updates).',
        inputSchema: {
            type: 'object',
            properties: {
                client_id: { type: 'string', description: 'Client/tenant ID' },
                folder_id: { type: 'string', description: 'Agent folder ID' },
                text: { type: 'string', description: 'Hot topic content' },
                priority: { type: 'integer', description: 'Priority 1-10', default: 5, minimum: 1, maximum: 10 },
                ttl: { type: 'integer', description: 'TTL in hours', default: 24, minimum: 1, maximum: 720 }
            },
            required: ['client_id', 'folder_id', 'text']
        }
    },
    {
        name: 'query_folder',
        description: 'Semantic search across documents. Returns chunks with metadata (listing_id, image_url, price, beds, etc.) for rendering.',
        inputSchema: {
            type: 'object',
            properties: {
                client_id: { type: 'string', description: 'Client/tenant ID' },
                folder_id: { type: 'string', description: 'Agent folder ID' },
                query: { type: 'string', description: 'Natural language search query' },
                top_k: { type: 'integer', description: 'Number of results', default: 5, minimum: 1, maximum: 20 }
            },
            required: ['client_id', 'folder_id', 'query']
        }
    }
];

// =============================================================================
// MCP TOOL HANDLERS
// =============================================================================

async function handleUpsertDocuments(args) {
    const { client_id, folder_id, files } = args || {};

    if (!client_id || !folder_id) {
        throw new Error('client_id and folder_id are required');
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new Error('files array is required and must not be empty');
    }

    console.error(`[Tool:upsert_documents] client=${client_id}, folder=${folder_id}, files=${files.length}`);

    const documents = [];
    for (const file of files) {
        let content = file.content || '';

        if (file.content_type === 'text/html') {
            content = await extractTextFromHTML(content);
        }

        documents.push({
            id: file.id,
            content,
            metadata: {
                filename: file.filename,
                content_type: file.content_type || 'text/plain',
                type: 'document',
                ...(file.metadata || {})
            }
        });
    }

    const result = await embedAndStore(client_id, folder_id, documents);

    return {
        success: result.success,
        message: `Indexed ${result.count} documents into ${result.chunks} chunks`,
        documents_processed: result.count,
        chunks_created: result.chunks,
        ...(result.error ? { error: result.error } : {})
    };
}

async function handleCrawlAndIndexUrl(args) {
    const { client_id, folder_id, url, depth = 0 } = args || {};

    if (!client_id || !folder_id) {
        throw new Error('client_id and folder_id are required');
    }
    if (!url) {
        throw new Error('url is required');
    }

    console.error(`[Tool:crawl_and_index_url] client=${client_id}, folder=${folder_id}, url=${url}, depth=${depth}`);

    const visited = new Set();
    const toVisit = [{ url, currentDepth: 0 }];
    const documents = [];

    while (toVisit.length > 0) {
        const { url: currentUrl, currentDepth } = toVisit.shift();
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        try {
            const { title, content, links } = await fetchAndExtractURL(currentUrl);

            documents.push({
                id: `crawl:${Buffer.from(currentUrl).toString('base64').slice(0, 32)}`,
                content,
                metadata: {
                    source_url: currentUrl,
                    title,
                    crawl_depth: currentDepth,
                    type: 'crawl'
                }
            });

            if (currentDepth < depth) {
                for (const link of links) {
                    try {
                        const absoluteUrl = new URL(link, currentUrl).href;
                        const baseOrigin = new URL(url).origin;
                        if (absoluteUrl.startsWith(baseOrigin) && !visited.has(absoluteUrl)) {
                            toVisit.push({ url: absoluteUrl, currentDepth: currentDepth + 1 });
                        }
                    } catch (e) { /* skip invalid URLs */ }
                }
            }
        } catch (error) {
            console.error(`[Crawler] Failed to fetch ${currentUrl}:`, error.message);
        }
    }

    const result = await embedAndStore(client_id, folder_id, documents);

    return {
        success: result.success,
        message: `Crawled ${documents.length} pages, created ${result.chunks} chunks`,
        pages_crawled: documents.length,
        chunks_created: result.chunks
    };
}

async function handleInjectHotTopic(args) {
    const { client_id, folder_id, text, priority = 5, ttl = 24 } = args || {};

    if (!client_id || !folder_id) {
        throw new Error('client_id and folder_id are required');
    }
    if (!text) {
        throw new Error('text is required');
    }

    console.error(`[Tool:inject_hot_topic] client=${client_id}, folder=${folder_id}, priority=${priority}, ttl=${ttl}h`);

    const hotTopicId = `hot:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();

    const documents = [{
        id: hotTopicId,
        content: text,
        metadata: {
            type: 'hot_topic',
            priority,
            expires_at: expiresAt
        }
    }];

    const result = await embedAndStore(client_id, folder_id, documents);

    return {
        success: result.success,
        message: `Hot topic injected with priority ${priority}`,
        hot_topic_id: hotTopicId,
        expires_at: expiresAt
    };
}

async function handleQueryFolder(args) {
    const { client_id, folder_id, query, top_k = 5 } = args || {};

    if (!client_id || !folder_id) {
        throw new Error('client_id and folder_id are required');
    }
    if (!query) {
        throw new Error('query is required');
    }

    console.error(`[Tool:query_folder] client=${client_id}, folder=${folder_id}, top_k=${top_k}`);
    console.error(`[Tool:query_folder] Query: "${query.slice(0, 80)}..."`);

    const results = await queryVectors(client_id, folder_id, query, top_k);

    return {
        success: true,
        query,
        count: results.length,
        results: results.map(r => ({
            id: r.id,
            score: r.score,
            content: r.content,
            metadata: r.metadata
        }))
    };
}

const toolHandlers = {
    upsert_documents: handleUpsertDocuments,
    crawl_and_index_url: handleCrawlAndIndexUrl,
    inject_hot_topic: handleInjectHotTopic,
    query_folder: handleQueryFolder
};

// =============================================================================
// MCP JSON-RPC PROTOCOL
// =============================================================================

function jsonRpcResponse(id, result) {
    return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message, data) {
    const error = { code, message };
    if (data !== undefined) error.data = data;
    return { jsonrpc: '2.0', id, error };
}

const ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603
};

/**
 * Handle MCP JSON-RPC request
 */
async function handleRequest(request) {
    // Validate basic JSON-RPC structure
    if (!request || typeof request !== 'object') {
        return jsonRpcError(null, ERROR_CODES.INVALID_REQUEST, 'Invalid request object');
    }

    const { id, method, params } = request;

    // Method is required
    if (!method || typeof method !== 'string') {
        return jsonRpcError(id || null, ERROR_CODES.INVALID_REQUEST, 'Method is required');
    }

    console.error(`[MCP] >>> ${method} (id=${id})`);

    try {
        switch (method) {
            // =========================================================================
            // MCP Lifecycle
            // =========================================================================

            case 'initialize': {
                const clientInfo = params?.clientInfo || {};
                console.error(`[MCP] Client: ${clientInfo.name || 'unknown'} v${clientInfo.version || '?'}`);

                return jsonRpcResponse(id, {
                    protocolVersion: PROTOCOL_VERSION,
                    serverInfo: SERVER_INFO,
                    capabilities: {
                        tools: { listChanged: false }
                    }
                });
            }

            case 'notifications/initialized':
            case 'initialized': {
                console.error('[MCP] Client sent initialized notification');
                // Notifications don't get responses
                return null;
            }

            case 'ping': {
                return jsonRpcResponse(id, {});
            }

            // =========================================================================
            // MCP Tools
            // =========================================================================

            case 'tools/list': {
                // params is optional for tools/list - handle gracefully
                console.error(`[MCP] tools/list: returning ${TOOLS.length} tools`);
                return jsonRpcResponse(id, { tools: TOOLS });
            }

            case 'tools/call': {
                // params is required for tools/call
                if (!params || typeof params !== 'object') {
                    return jsonRpcError(id, ERROR_CODES.INVALID_PARAMS, 'params is required for tools/call');
                }

                const { name, arguments: toolArgs } = params;

                if (!name || typeof name !== 'string') {
                    return jsonRpcError(id, ERROR_CODES.INVALID_PARAMS, 'Tool name is required');
                }

                console.error(`[MCP] tools/call: ${name}`);

                const handler = toolHandlers[name];
                if (!handler) {
                    console.error(`[MCP] Unknown tool: ${name}`);
                    return jsonRpcError(id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
                }

                try {
                    const result = await handler(toolArgs || {});
                    console.error(`[MCP] Tool ${name} completed successfully`);

                    return jsonRpcResponse(id, {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }],
                        isError: false
                    });
                } catch (toolError) {
                    console.error(`[MCP] Tool ${name} error:`, toolError.message);

                    return jsonRpcResponse(id, {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({ error: toolError.message }, null, 2)
                        }],
                        isError: true
                    });
                }
            }

            // =========================================================================
            // Unknown Methods
            // =========================================================================

            default: {
                console.error(`[MCP] Unknown method: ${method}`);
                return jsonRpcError(id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
            }
        }
    } catch (error) {
        console.error(`[MCP] Internal error in ${method}:`, error);
        return jsonRpcError(id, ERROR_CODES.INTERNAL_ERROR, error.message);
    }
}

// =============================================================================
// STDIO TRANSPORT
// =============================================================================

function sendResponse(response) {
    if (!response) return;
    const json = JSON.stringify(response);
    console.error(`[MCP] <<< Response (${json.length} bytes)`);
    process.stdout.write(json + '\n');
}

function main() {
    console.error('============================================================');
    console.error(`[${SERVER_INFO.name}] v${SERVER_INFO.version} starting`);
    console.error(`[${SERVER_INFO.name}] Protocol: MCP ${PROTOCOL_VERSION}`);
    console.error(`[${SERVER_INFO.name}] Transport: stdio (JSON-RPC 2.0)`);
    console.error(`[${SERVER_INFO.name}] Supabase URL: ${config.supabaseUrl || '(not configured)'}`);
    console.error(`[${SERVER_INFO.name}] RAG Table: ${config.ragSchema}.${config.ragTable}`);
    console.error(`[${SERVER_INFO.name}] Embedding Dimension: ${config.embeddingDimension}`);
    console.error('============================================================');
    console.error(`[${SERVER_INFO.name}] Ready for JSON-RPC on stdin`);

    const rl = readline.createInterface({
        input: process.stdin,
        terminal: false
    });

    rl.on('line', async (line) => {
        if (!line.trim()) return;

        try {
            const request = JSON.parse(line);
            const response = await handleRequest(request);
            sendResponse(response);
        } catch (error) {
            if (error instanceof SyntaxError) {
                console.error('[MCP] JSON parse error:', error.message);
                sendResponse(jsonRpcError(null, ERROR_CODES.PARSE_ERROR, 'Invalid JSON'));
            } else {
                console.error('[MCP] Unexpected error:', error);
                sendResponse(jsonRpcError(null, ERROR_CODES.INTERNAL_ERROR, error.message));
            }
        }
    });

    rl.on('close', () => {
        console.error(`[${SERVER_INFO.name}] stdin closed, exiting`);
        process.exit(0);
    });

    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));
}

main();

// =============================================================================
// SETUP INSTRUCTIONS
// =============================================================================
/*

## 1. Install Dependencies

In the auro-rag-mcp directory or project root:

```bash
npm install @supabase/supabase-js
```

## 2. Docker Build

```bash
cd auro-rag-mcp
docker build -t auro-rag-mcp .
```

## 3. Environment Variables

Set these in your Docker run command or docker-compose.yml:

```bash
docker run -i \
  -e SUPABASE_URL="https://your-project.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  -e RAG_SCHEMA="public" \
  -e RAG_TABLE="rag_chunks" \
  -e EMBEDDING_DIMENSION="1536" \
  auro-rag-mcp
```

## 4. Supabase SQL Setup

Run this in Supabase SQL Editor to create the table and RPC function:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create RAG chunks table
CREATE TABLE IF NOT EXISTS public.rag_chunks (
  chunk_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),  -- Match your EMBEDDING_DIMENSION (768 for Gemini, 1536 for OpenAI)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for multi-tenant filtering
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant 
  ON public.rag_chunks(client_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document 
  ON public.rag_chunks(client_id, folder_id, document_id);

-- HNSW index for fast vector similarity (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding 
  ON public.rag_chunks 
  USING hnsw (embedding vector_cosine_ops);

-- RPC function for vector similarity search with tenant isolation
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 5,
  filter_client_id text DEFAULT NULL,
  filter_folder_id text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id text,
  client_id text,
  folder_id text,
  document_id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.chunk_id,
    rc.client_id,
    rc.folder_id,
    rc.document_id,
    rc.content,
    rc.metadata,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks rc
  WHERE 
    (filter_client_id IS NULL OR rc.client_id = filter_client_id)
    AND (filter_folder_id IS NULL OR rc.folder_id = filter_folder_id)
    AND (1 - (rc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rag_chunks_updated_at
  BEFORE UPDATE ON public.rag_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Optional: Function to clean up expired hot topics
CREATE OR REPLACE FUNCTION cleanup_expired_hot_topics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.rag_chunks
  WHERE 
    metadata->>'type' = 'hot_topic'
    AND (metadata->>'expires_at')::timestamptz < NOW();
END;
$$;
```

## 5. Example MCP Config (for Antigravity)

```json
{
  "mcpServers": {
    "auro-rag": {
      "command": "docker",
      "args": ["run", "-i", "--rm",
        "-e", "SUPABASE_URL=https://xxx.supabase.co",
        "-e", "SUPABASE_SERVICE_ROLE_KEY=xxx",
        "auro-rag-mcp"
      ]
    }
  }
}
```

## 6. Testing

Test the MCP server manually:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node auro-rag-mcp.js
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node auro-rag-mcp.js
```

*/

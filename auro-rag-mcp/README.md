# AURO RAG MCP Server

Multi-tenant vector search MCP (Model Context Protocol) server for AI agents.

## Features

- **Multi-tenant**: Supports multiple clients and folders with strict isolation
- **MCP Protocol**: Standard JSON-RPC over stdio for AI agent integration
- **Supabase PGVector**: Scalable vector storage with similarity search
- **768-dim embeddings**: Compatible with Google Gemini text-embedding-004

## Tools Available

| Tool | Description |
|------|-------------|
| `upsert_documents` | Upload and index documents with embeddings |
| `query_folder` | Semantic search across documents |
| `crawl_and_index_url` | Crawl web pages and index content |
| `inject_hot_topic` | Add high-priority temporary context |

## Quick Start

### 1. Build Docker Image

```bash
docker build -t auro-rag-mcp .
```

### 2. Run Container

```bash
docker run -i \
  -e SUPABASE_URL="your-supabase-url" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-key" \
  auro-rag-mcp
```

### 3. With Docker Compose

Create `.env` file:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Run:
```bash
docker compose up -d
```

## AI Agent Configuration

### Antigravity / Claude MCP Config

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "auro-rag": {
      "command": "docker",
      "args": ["run", "-i", "--rm", 
        "-e", "SUPABASE_URL=...", 
        "-e", "SUPABASE_SERVICE_ROLE_KEY=...",
        "auro-rag-mcp"
      ]
    }
  }
}
```

Or if running locally:

```json
{
  "mcpServers": {
    "auro-rag": {
      "command": "node",
      "args": ["path/to/auro-rag-mcp.js"],
      "env": {
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_ROLE_KEY": "..."
      }
    }
  }
}
```

## Supabase Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create rag_chunks table
CREATE TABLE IF NOT EXISTS rag_chunks (
  chunk_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rag_chunks_client ON rag_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_folder ON rag_chunks(folder_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create match function
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
    r.chunk_id,
    r.client_id,
    r.folder_id,
    r.document_id,
    r.content,
    r.metadata,
    1 - (r.embedding <=> query_embedding) as similarity
  FROM rag_chunks r
  WHERE
    (filter_client_id IS NULL OR r.client_id = filter_client_id)
    AND (filter_folder_id IS NULL OR r.folder_id = filter_folder_id)
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | - | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | - | Service role key for admin access |
| `EMBEDDING_DIMENSION` | No | 768 | Vector dimension (768 for Gemini) |
| `RAG_SCHEMA` | No | public | Postgres schema name |
| `RAG_TABLE` | No | rag_chunks | Table name for vectors |

## Testing

Test tools list:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node auro-rag-mcp.js
```

Test query:
```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"query_folder","arguments":{"client_id":"demo","folder_id":"test","query":"payment plans"}}}' | node auro-rag-mcp.js
```

## License

ISC

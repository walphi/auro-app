# AURO RAG MCP Server
# Multi-tenant vector search MCP server for AI agents

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY auro-rag-mcp.js ./

# Environment variables (override at runtime)
ENV SUPABASE_URL=""
ENV SUPABASE_SERVICE_ROLE_KEY=""
ENV EMBEDDING_DIMENSION="768"
ENV RAG_SCHEMA="public"
ENV RAG_TABLE="rag_chunks"

# MCP servers communicate via stdio
# The container should be run with -i flag for interactive mode
CMD ["node", "auro-rag-mcp.js"]

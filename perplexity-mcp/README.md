# Perplexity AI MCP Server

Real-time web search capabilities for AURO AI agents via Model Context Protocol.

## Features

- **perplexity_search** - Quick web search for facts, news, prices
- **perplexity_ask** - Conversational AI with web grounding  
- **perplexity_research** - Deep research on complex topics

## Setup

1. Get your Perplexity API key from [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)

2. Update `~/.gemini/antigravity/mcp_config.json`:
```json
{
  "mcpServers": {
    "perplexity": {
      "command": "node",
      "args": ["C:/Users/phill/Downloads/2025/Auro App/perplexity-mcp/perplexity-mcp.js"],
      "env": {
        "PERPLEXITY_API_KEY": "pplx-xxxxxxxxxxxxxxxx"
      },
      "transportType": "stdio",
      "timeout": 60,
      "disabled": false
    }
  }
}
```

3. Restart Antigravity to load the new MCP server

## Tools

### perplexity_search
Quick search for current information.

```json
{
  "query": "Dubai Marina property prices 2025",
  "focus": "web"  // web, news, or academic
}
```

### perplexity_ask
Ask questions with web-grounded answers.

```json
{
  "question": "What are the best areas for property investment in Dubai?",
  "context": "Client has 10M AED budget"
}
```

### perplexity_research
Deep research on complex topics.

```json
{
  "topic": "DIFC vs Dubai Marina investment comparison",
  "depth": "comprehensive"  // brief, detailed, or comprehensive
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PERPLEXITY_API_KEY` | Yes | Your Perplexity API key |

## Testing

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node perplexity-mcp.js
```

## License

ISC

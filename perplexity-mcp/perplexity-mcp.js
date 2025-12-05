#!/usr/bin/env node
/**
 * Perplexity AI MCP Server for AURO
 * 
 * Provides real-time web search capabilities to AI agents via Model Context Protocol.
 * 
 * Tools:
 * - perplexity_search: Quick web search for factual information
 * - perplexity_ask: Conversational AI with web grounding
 * - perplexity_research: Deep research on complex topics
 * 
 * Transport: stdio (JSON-RPC 2.0)
 */

const readline = require('readline');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SERVER_INFO = {
    name: 'perplexity-mcp',
    version: '1.0.0'
};

const PROTOCOL_VERSION = '2024-11-05';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Available models
const MODELS = {
    search: 'sonar',           // Fast search
    ask: 'sonar',              // Conversational
    research: 'sonar-pro',     // Deep research
    reason: 'sonar-reasoning'  // Complex reasoning
};

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
    {
        name: 'perplexity_search',
        description: 'Search the web for current information. Use for factual queries, news, prices, events, or any real-time information. Returns concise, cited results.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query (e.g., "Dubai property market trends 2024", "latest DIFC developments")'
                },
                focus: {
                    type: 'string',
                    enum: ['web', 'news', 'academic'],
                    description: 'Search focus area (default: web)'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'perplexity_ask',
        description: 'Ask a question and get a comprehensive, web-grounded answer. Use for general questions, explanations, or advice.',
        inputSchema: {
            type: 'object',
            properties: {
                question: {
                    type: 'string',
                    description: 'Question to answer (e.g., "What are the best areas to invest in Dubai property?")'
                },
                context: {
                    type: 'string',
                    description: 'Optional context to guide the answer'
                }
            },
            required: ['question']
        }
    },
    {
        name: 'perplexity_research',
        description: 'Conduct deep research on a topic. Returns detailed analysis with multiple sources. Use for market research, competitor analysis, or complex topics.',
        inputSchema: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'Research topic (e.g., "Dubai Marina vs DIFC property investment comparison")'
                },
                depth: {
                    type: 'string',
                    enum: ['brief', 'detailed', 'comprehensive'],
                    description: 'Research depth (default: detailed)'
                }
            },
            required: ['topic']
        }
    }
];

// =============================================================================
// PERPLEXITY API CLIENT
// =============================================================================

async function callPerplexity(messages, model = 'sonar') {
    if (!PERPLEXITY_API_KEY) {
        return {
            error: true,
            message: 'PERPLEXITY_API_KEY not configured. Set the environment variable.'
        };
    }

    try {
        const response = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: 1024,
                temperature: 0.2,
                return_citations: true,
                return_images: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Perplexity] API error: ${response.status}`, errorText);
            return {
                error: true,
                message: `Perplexity API error: ${response.status}`
            };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response';
        const citations = data.citations || [];

        return {
            error: false,
            content: content,
            citations: citations,
            model: model
        };
    } catch (err) {
        console.error('[Perplexity] Request error:', err.message);
        return {
            error: true,
            message: `Request failed: ${err.message}`
        };
    }
}

// =============================================================================
// TOOL HANDLERS
// =============================================================================

async function handleSearch(args) {
    const { query, focus = 'web' } = args;

    console.error(`[Perplexity] Search: "${query}" (focus: ${focus})`);

    const messages = [
        {
            role: 'system',
            content: `You are a search assistant. Provide concise, factual answers with sources. Focus: ${focus}. Be direct and cite your sources.`
        },
        {
            role: 'user',
            content: query
        }
    ];

    const result = await callPerplexity(messages, MODELS.search);

    if (result.error) {
        return { success: false, error: result.message };
    }

    return {
        success: true,
        query: query,
        answer: result.content,
        citations: result.citations.slice(0, 5),
        model: result.model
    };
}

async function handleAsk(args) {
    const { question, context = '' } = args;

    console.error(`[Perplexity] Ask: "${question}"`);

    const systemPrompt = context
        ? `You are a helpful AI assistant with web search capabilities. Context: ${context}`
        : 'You are a helpful AI assistant with web search capabilities. Provide comprehensive answers with sources.';

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
    ];

    const result = await callPerplexity(messages, MODELS.ask);

    if (result.error) {
        return { success: false, error: result.message };
    }

    return {
        success: true,
        question: question,
        answer: result.content,
        citations: result.citations,
        model: result.model
    };
}

async function handleResearch(args) {
    const { topic, depth = 'detailed' } = args;

    console.error(`[Perplexity] Research: "${topic}" (depth: ${depth})`);

    const depthInstructions = {
        brief: 'Provide a brief overview in 2-3 paragraphs.',
        detailed: 'Provide a detailed analysis with key points, data, and sources.',
        comprehensive: 'Provide a comprehensive research report with multiple perspectives, data analysis, pros/cons, and extensive sourcing.'
    };

    const messages = [
        {
            role: 'system',
            content: `You are a research analyst. ${depthInstructions[depth]} Always cite sources.`
        },
        {
            role: 'user',
            content: `Research topic: ${topic}`
        }
    ];

    const result = await callPerplexity(messages, MODELS.research);

    if (result.error) {
        return { success: false, error: result.message };
    }

    return {
        success: true,
        topic: topic,
        depth: depth,
        analysis: result.content,
        citations: result.citations,
        model: result.model
    };
}

// =============================================================================
// MCP PROTOCOL HANDLERS
// =============================================================================

function handleInitialize(params) {
    console.error('[MCP] Initialize request received');
    return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
            tools: {}
        },
        serverInfo: SERVER_INFO
    };
}

function handleToolsList() {
    console.error('[MCP] Tools list requested');
    return { tools: TOOLS };
}

async function handleToolCall(params) {
    const { name, arguments: args } = params;
    console.error(`[MCP] Tool call: ${name}`);

    switch (name) {
        case 'perplexity_search':
            return { content: [{ type: 'text', text: JSON.stringify(await handleSearch(args), null, 2) }] };
        case 'perplexity_ask':
            return { content: [{ type: 'text', text: JSON.stringify(await handleAsk(args), null, 2) }] };
        case 'perplexity_research':
            return { content: [{ type: 'text', text: JSON.stringify(await handleResearch(args), null, 2) }] };
        default:
            throw { code: -32601, message: `Unknown tool: ${name}` };
    }
}

// =============================================================================
// JSON-RPC SERVER
// =============================================================================

async function handleRequest(request) {
    const { id, method, params } = request;

    try {
        let result;

        switch (method) {
            case 'initialize':
                result = handleInitialize(params);
                break;
            case 'notifications/initialized':
                return null; // No response for notifications
            case 'tools/list':
                result = handleToolsList();
                break;
            case 'tools/call':
                result = await handleToolCall(params);
                break;
            default:
                throw { code: -32601, message: `Unknown method: ${method}` };
        }

        return { jsonrpc: '2.0', id, result };
    } catch (error) {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: error.code || -32603,
                message: error.message || 'Internal error'
            }
        };
    }
}

// =============================================================================
// STDIO TRANSPORT
// =============================================================================

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

console.error('[perplexity-mcp] Server starting...');
console.error('[perplexity-mcp] API Key:', PERPLEXITY_API_KEY ? 'SET' : 'NOT SET');

rl.on('line', async (line) => {
    try {
        const request = JSON.parse(line);
        console.error(`[MCP] >>> ${request.method} (id=${request.id})`);

        const response = await handleRequest(request);

        if (response) {
            const output = JSON.stringify(response);
            console.log(output);
            console.error(`[MCP] <<< Response (${output.length} bytes)`);
        }
    } catch (err) {
        console.error('[MCP] Parse error:', err.message);
        console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' }
        }));
    }
});

rl.on('close', () => {
    console.error('[perplexity-mcp] stdin closed, exiting');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.error('[perplexity-mcp] SIGINT received, exiting');
    process.exit(0);
});

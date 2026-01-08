import { BuildSiteInput, BuildSiteOutput } from './types';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { validateAndRetry } from './validation';
import crypto from 'crypto';

export async function buildSiteInternal(input: BuildSiteInput): Promise<BuildSiteOutput> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!anthropicKey) console.warn("[buildSite] ANTHROPIC_API_KEY missing");
    if (!geminiKey) console.warn("[buildSite] No Gemini API key found (checked GOOGLE_API_KEY and GEMINI_API_KEY)");

    const modelOptions = [
        'claude-sonnet-4-5-20250929',    // Claude Sonnet 4.5
        'claude-haiku-4-5-20251001',     // Claude Haiku 4.5
        'gemini-2.0-flash'               // Google Gemini 2.0 Flash
    ];

    const startTime = Date.now();
    let usedModel = "";
    let finalTokenUsage = { input: 0, output: 0 };
    let initialResponseText = "";
    let lastError: any;

    const initialPrompt = buildUserPrompt(input.agentConfig, input.styleProfile);

    // 1. Initial Generation Loop
    for (const model of modelOptions) {
        try {
            console.info(`[build-site] Attempting model: ${model}`);

            if (model.startsWith('claude')) {
                if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");
                const response = await callClaude(model, initialPrompt, [], anthropicKey, SYSTEM_PROMPT);
                initialResponseText = response.content[0].text;
                finalTokenUsage = {
                    input: response.usage.input_tokens,
                    output: response.usage.output_tokens
                };
            } else if (model.startsWith('gemini')) {
                if (!geminiKey) throw new Error("Missing GOOGLE_API_KEY");
                const response = await callGemini(model, initialPrompt, geminiKey, SYSTEM_PROMPT);
                initialResponseText = response.text;
                finalTokenUsage = {
                    input: response.usage?.promptTokenCount || 0,
                    output: response.usage?.candidatesTokenCount || 0
                };
            }

            usedModel = model;
            console.info(`[build-site] Successfully built site with model: ${model}`);
            break; // Success!
        } catch (err: any) {
            console.warn(`[build-site] Model ${model} failed. Error: ${err.message}. Trying next model...`);
            lastError = err;
            continue;
        }
    }

    if (!usedModel || !initialResponseText) {
        throw new Error(`All models failed. Last error: ${lastError?.message}`);
    }

    // Capture context for retries (only supports Claude context for now, simple string append for others could be added)
    const messages: any[] = [{ role: 'user', content: initialPrompt }, { role: 'assistant', content: initialResponseText }];

    // 2. Validation & Retry Loop
    // Note: Retries will currently stick to the SUCCESSFUL model from step 1
    const retryFn = async (errorMsg: string) => {
        console.info(`[build-site] Retrying validation with model: ${usedModel}`);
        let retryText = "";

        if (usedModel.startsWith('claude')) {
            if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");
            const response = await callClaude(usedModel, errorMsg, messages, anthropicKey, SYSTEM_PROMPT);
            retryText = response.content[0].text;

            // Update usage
            finalTokenUsage.input += response.usage.input_tokens;
            finalTokenUsage.output += response.usage.output_tokens;

            // Update history
            messages.push({ role: 'user', content: errorMsg });
            messages.push({ role: 'assistant', content: retryText });

        } else if (usedModel.startsWith('gemini')) {
            if (!geminiKey) throw new Error("Missing GOOGLE_API_KEY");
            // ... logic ...
            // Simplified for replace match
            const contextPrompt = `Previous Output:\n${initialResponseText}\n\nCritique:\n${errorMsg}\n\nPlease fix the previous output based on the critique. Return ONLY the JSON.`;
            const response = await callGemini(usedModel, contextPrompt, geminiKey, SYSTEM_PROMPT);
            retryText = response.text;

            finalTokenUsage.input += response.usage?.promptTokenCount || 0;
            finalTokenUsage.output += response.usage?.candidatesTokenCount || 0;
        }

        // Sanitize retry output
        let cleanRetry = retryText.trim();
        if (cleanRetry.includes('{')) {
            const start = cleanRetry.indexOf('{');
            const end = cleanRetry.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                cleanRetry = cleanRetry.substring(start, end + 1);
            }
        }

        return cleanRetry;
    };

    // Sanitize output before parsing
    let cleanJson = initialResponseText.trim();
    if (cleanJson.includes('{')) {
        const start = cleanJson.indexOf('{');
        const end = cleanJson.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            cleanJson = cleanJson.substring(start, end + 1);
        }
    }

    const validatedOutput = await validateAndRetry(cleanJson, input, retryFn);

    // Construct the full document merging Config + AI Output
    const fullDocument: any = {
        id: crypto.randomUUID(),
        agentId: input.agentConfig.agentId,
        configId: input.agentConfig.id,
        slug: input.agentConfig.slug,
        version: 1, // Will be overwritten by caller
        languageCodes: ["en"], // Default
        site: validatedOutput.site,
        nav: validatedOutput.nav,
        pages: validatedOutput.pages,
        listings: input.agentConfig.listings, // Inject runtime listings
        generatedAt: new Date().toISOString(),
        generatedBy: usedModel,
        tokenUsage: finalTokenUsage
    };

    const endTime = Date.now();

    return {
        document: fullDocument, // Cast to any or correct type effectively
        tokenUsage: finalTokenUsage,
        model: usedModel,
        latencyMs: endTime - startTime
    };
}

// Helper: Call Claude API
async function callClaude(model: string, userMessage: string, previousMessages: any[], apiKey: string, systemPrompt: string) {
    const messages = [...previousMessages, { role: 'user', content: userMessage }];
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: messages
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${err}`);
    }
    return response.json();
}

// Helper: Call Gemini API (Simple Fetch)
async function callGemini(model: string, prompt: string, apiKey: string, systemPrompt: string) {
    // Note: Gemini API format is noticeably different. 
    // We'll use v1beta generateContent.
    // 'system_instruction' is available in recent versions.

    // Map generic model name to specific Gemini version if needed or just pass through
    // User requested 'gemini-2.0-flash', we might need to fallback to 'gemini-1.5-flash' if 404
    // But we will try exact string first.

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        usage: data.usageMetadata
    };
}

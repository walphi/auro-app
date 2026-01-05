import { BuildSiteInput, BuildSiteOutput } from './types';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { validateAndRetry } from './validation';

export async function buildSiteInternal(input: BuildSiteInput): Promise<BuildSiteOutput> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not found in environment");

    const model = "claude-3-5-sonnet-20241022";
    const startTime = Date.now();

    const callClaude = async (userMessage: string, previousMessages: any[] = []) => {
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
                max_tokens: input.options?.maxTokens || 4096,
                system: SYSTEM_PROMPT,
                messages: messages
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Claude API error: ${response.status} - ${err}`);
        }

        return response.json();
    };

    const initialPrompt = buildUserPrompt(input.agentConfig, input.styleProfile);
    const initialResult = await callClaude(initialPrompt);

    let currentResult = initialResult;
    const messages: any[] = [{ role: 'user', content: initialPrompt }, { role: 'assistant', content: initialResult.content[0].text }];

    const retryFn = async (errorMsg: string) => {
        const retryResult = await callClaude(errorMsg, messages);
        messages.push({ role: 'user', content: errorMsg });
        messages.push({ role: 'assistant', content: retryResult.content[0].text });
        currentResult = retryResult;
        return retryResult.content[0].text;
    };

    const validatedDoc = await validateAndRetry(initialResult.content[0].text, input, retryFn);

    const endTime = Date.now();

    return {
        document: validatedDoc,
        tokenUsage: {
            input: currentResult.usage.input_tokens,
            output: currentResult.usage.output_tokens
        },
        model: model,
        latencyMs: endTime - startTime
    };
}

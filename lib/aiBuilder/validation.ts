import { z } from 'zod';
import { BuildSiteInput } from './types';

export const SectionTypeSchema = z.enum([
    "hero", "about", "services", "focusAreas", "listingsGrid", "testimonials", "contact", "faq", "ctaBand", "stats", "developers"
]);

export const AgentSiteDocumentSchema = z.object({
    agentId: z.string().uuid(),
    configId: z.string().uuid(),
    slug: z.string(),
    version: z.number(),
    languageCodes: z.array(z.enum(["en", "ar"])),
    meta: z.object({
        title: z.string(),
        description: z.string(),
        keywords: z.array(z.string())
    }),
    theme: z.object({
        primaryColor: z.string(),
        secondaryColor: z.string(),
        fontFamily: z.string().optional()
    }),
    sections: z.array(z.object({
        id: z.string(),
        type: SectionTypeSchema,
        content: z.any() // Detailed validation for each section content can be added if needed
    })),
    listings: z.array(z.any())
});

export async function validateAndRetry(
    rawOutput: string,
    input: BuildSiteInput,
    retryFn: (errorMessage: string) => Promise<string>,
    attempt: number = 1
): Promise<any> {
    try {
        // Attempt to parse JSON
        const jsonStart = rawOutput.indexOf('{');
        const jsonEnd = rawOutput.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found in output");

        const jsonStr = rawOutput.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);

        // Validate against schema
        return AgentSiteDocumentSchema.parse(parsed);
    } catch (error: any) {
        if (attempt >= 3) {
            throw new Error(`Failed to generate valid site after 3 attempts: ${error.message}`);
        }

        console.warn(`Validation attempt ${attempt} failed: ${error.message}. Retrying...`);

        const errorMessage = `Your previous output was invalid. Error: ${error.message}. Please fix the JSON and ensure it strictly follows the schema.`;
        const newOutput = await retryFn(errorMessage);

        return validateAndRetry(newOutput, input, retryFn, attempt + 1);
    }
}

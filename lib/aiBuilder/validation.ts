import { z } from 'zod';
import { BuildSiteInput } from './types';

export const SectionTypeSchema = z.enum([
    "hero", "about", "services", "focusAreas", "listingsGrid", "testimonials", "contact", "faq", "ctaBand", "stats", "developers"
]);

// Validation for the Page sections
const SectionSchema = z.object({
    id: z.string().optional(), // AI might generate or we assign
    type: SectionTypeSchema,
    content: z.record(z.string(), z.any())
});

// Schema for the AI's output (Projected structure)
export const AISiteOutputSchema = z.object({
    site: z.object({
        brand: z.object({
            name: z.string(),
            logoUrl: z.string().optional(),
            faviconUrl: z.string().optional()
        }),
        designSystem: z.object({
            theme: z.enum(["luxury", "minimal", "bold"]),
            primaryColor: z.string(),
            accentColor: z.string(),
            backgroundColor: z.string(),
            typography: z.object({
                headingFont: z.string(),
                bodyFont: z.string(),
                scale: z.number()
            }),
            layoutMode: z.enum(["default", "centered", "wide"])
        }),
        meta: z.object({
            title: z.string(),
            description: z.string()
        })
    }),
    nav: z.object({
        items: z.array(z.object({
            label: z.string(),
            path: z.string(),
            type: z.enum(["page", "link", "button"]),
            action: z.string().optional()
        }))
    }),
    pages: z.array(z.object({
        id: z.string(),
        path: z.string(),
        title: z.string(),
        metaDescription: z.string(),
        sections: z.array(SectionSchema)
    })),
    listings: z.array(z.any()).optional()
});

export async function validateAndRetry(
    rawOutput: string,
    input: BuildSiteInput,
    retryFn: (errorMessage: string) => Promise<string>,
    attempt: number = 1
): Promise<z.infer<typeof AISiteOutputSchema>> {
    try {
        // Attempt to parse JSON
        const jsonStart = rawOutput.indexOf('{');
        const jsonEnd = rawOutput.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found in output");

        const jsonStr = rawOutput.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);

        // Validate against schema
        return AISiteOutputSchema.parse(parsed);
    } catch (error: any) {
        if (attempt >= 3) {
            throw new Error(`Failed to generate valid site after 3 attempts: ${error.message}`);
        }

        console.warn(`Validation attempt ${attempt} failed: ${error.message}. Retrying...`);

        // Contextual error message
        const errorMessage = `Your previous output was invalid. Error: ${error.message}. Please fix the JSON and ensure it strictly follows the schema with 'site', 'nav', and 'pages'.`;
        const newOutput = await retryFn(errorMessage);

        return validateAndRetry(newOutput, input, retryFn, attempt + 1);
    }
}

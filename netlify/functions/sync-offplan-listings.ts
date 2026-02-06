import { Handler, schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { FirecrawlClient } from "../../lib/firecrawlClient";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as crypto from "crypto";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "fc-24d25acc0c69468f8468b315aaa130e7";

const URL_TO_SCRAPE = "https://providentestate.com/new-projects/";

const SCRAPE_PROMPT = `
Extract all off-plan projects listed on this page.
For each project, extract:
- Title
- Location (Community/Area)
- Starting Price (numeric AED, remove commas/symbols)
- Unit Types (e.g. "1, 2, 3 BR Apartments", "3, 4 BR Townhouses")
- Handover Date (e.g. "Q4 2026")
- Main Image URL
- Developer Name (if available)
`;

const SCRAPE_SCHEMA = {
    type: "object",
    properties: {
        projects: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    location: { type: "string" },
                    developer: { type: "string" },
                    startingPrice: { type: "number" },
                    unitTypes: { type: "string" },
                    handoverDate: { type: "string" },
                    imageUrl: { type: "string" }
                },
                required: ["title", "location", "imageUrl"]
            }
        }
    }
};

const myHandler: Handler = async (event, context) => {
    console.log("[Sync-Offplan] Starting sync...");

    try {
        // 1. Initialize Firecrawl
        const firecrawl = new FirecrawlClient({
            apiKey: FIRECRAWL_API_KEY,
            baseUrl: "https://api.firecrawl.dev/v1",
            timeoutMs: 60000
        });

        // 2. Scrape Provident New Projects
        console.log(`[Sync-Offplan] Scraping ${URL_TO_SCRAPE}...`);
        const result = await firecrawl.scrapeJson(URL_TO_SCRAPE, SCRAPE_PROMPT, SCRAPE_SCHEMA);

        if (!result.success || !result.data?.json?.projects) {
            console.error("[Sync-Offplan] Scrape failed:", result.error);
            return { statusCode: 500, body: JSON.stringify({ error: "Scrape failed", details: result.error }) };
        }

        const projects = result.data.json.projects;
        console.log(`[Sync-Offplan] Found ${projects.length} projects.`);

        // 3. Clear 'Ready' listings (Logic: Remove everything from old source 'parsebot' or explicitly 'ready')
        await supabase.from('property_listings').delete().eq('source', 'parsebot');
        await supabase.from('property_listings').delete().eq('source', 'provident_offplan');

        console.log("[Sync-Offplan] Cleared old listings.");

        // 4. Update RAG Context (Embeddings)
        const { embedText } = require("../../lib/rag/embeddingClient");

        // Clean old scraped chunks
        await supabase.from('rag_chunks').delete().eq('source_type', 'provident_website_scrape');

        let insertCount = 0;

        for (const p of projects) {

            // --- A. RAG CHUNK ---
            const ragContent = `# ${p.title}
Location: ${p.location}
Developer: ${p.developer || "Unknown"}
Starting Price: AED ${p.startingPrice?.toLocaleString() || "TBC"}
Unit Types: ${p.unitTypes || "Various"}
Handover: ${p.handoverDate || "TBC"}

Overview:
New off-plan launch in ${p.location}. offering ${p.unitTypes}.
`;

            try {
                const embedding = await embedText(ragContent, { taskType: 'RETRIEVAL_DOCUMENT' });

                if (embedding) {
                    const { error: insErr } = await supabase.from('rag_chunks').insert({
                        chunk_id: crypto.randomUUID(),
                        content: ragContent,
                        embedding: embedding,
                        folder_id: 'projects',
                        document_id: `prov_off_${p.title.replace(/\s+/g, '_')}`,
                        client_id: 'provident',
                        tenant_id: 1, // Default Provident Tenant
                        source_type: 'provident_website_scrape',
                        metadata: { url: URL_TO_SCRAPE, image: p.imageUrl }
                    });
                    if (insErr) console.error(`[Sync-Offplan] RAG Insert Error for ${p.title}:`, insErr);
                } else {
                    console.error(`[Sync-Offplan] RAG Embedding failed for ${p.title} (returned null)`);
                }
            } catch (embError: any) {
                console.error(`[Sync-Offplan] RAG Embedding failed for ${p.title}:`, embError.message);
            }

            // --- B. VISUAL LISTINGS ---
            // Heuristic to expand "1, 2, 3 BR" into listings
            const bedroomsIndices: number[] = [];
            if (p.unitTypes) {
                const matches = p.unitTypes.match(/\d+/g);
                if (matches) {
                    matches.forEach((m: string) => bedroomsIndices.push(parseInt(m, 10)));
                }
            }
            if (bedroomsIndices.length === 0) bedroomsIndices.push(0); // Default to studio/unknown

            // Create a listing for each bedroom type found
            for (const beds of bedroomsIndices) {
                const listing = {
                    external_id: `prov_off_${p.title.replace(/\s+/g, '_')}_${beds}`,
                    title: `${p.title} - ${beds === 0 ? 'Studio' : beds + ' BR'}`,
                    description: `Off-plan opportunity in ${p.location}. Handover: ${p.handoverDate || 'TBC'}. Developer: ${p.developer || 'Unknown'}.`,
                    property_type: p.unitTypes?.toLowerCase().includes('villa') ? 'villa' : 'apartment',
                    offering_type: 'sale',
                    community: p.location,
                    bedrooms: beds,
                    bathrooms: beds,
                    price: p.startingPrice || 0,
                    images: [p.imageUrl],
                    source: 'provident_offplan',
                    source_url: URL_TO_SCRAPE,
                    status: 'active',
                    synced_at: new Date().toISOString()
                };

                const { error } = await supabase.from('property_listings').insert(listing);
                if (error) console.error(`[Sync-Offplan] Error inserting ${listing.title}:`, error.message);
                else insertCount++;
            }
        }

        console.log(`[Sync-Offplan] Successfully inserted ${insertCount} listings and updated RAG.`);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, count: insertCount })
        };
    } catch (e: any) {
        console.error("[Sync-Offplan] Exception:", e.message);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};

// Run every 3 days at 6:00 AM (CRON: 0 6 */3 * *)
export const handler = schedule("0 6 */3 * *", myHandler);

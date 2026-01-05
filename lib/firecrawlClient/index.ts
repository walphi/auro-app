
export interface FirecrawlConfig {
    apiKey: string;
    baseUrl: string; // e.g. "https://api.firecrawl.dev/v1"
    timeoutMs?: number;
}

export interface FirecrawlScrapeResult {
    success: boolean;
    data?: any;
    error?: any;
}

export class FirecrawlClient {
    constructor(private config: FirecrawlConfig) { }

    async scrapeJson(url: string, prompt: string, schema: any): Promise<FirecrawlScrapeResult> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 60000);

        try {
            // Use v2 endpoint
            const baseUrl = this.config.baseUrl.replace('/v1', '/v2');
            const response = await fetch(`${baseUrl}/scrape`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url,
                    formats: [
                        {
                            type: "json",
                            schema,
                            prompt,
                        },
                    ],
                    timeout: 120000,
                }),
                signal: controller.signal,
            });

            const text = await response.text();
            let json: any = {};
            try {
                json = text ? JSON.parse(text) : {};
            } catch {
                // leave json empty
            }

            if (!response.ok || !json.success) {
                return {
                    success: false,
                    error: {
                        status: response.status,
                        body: text,
                    },
                };
            }

            return {
                success: true,
                data: json.data, // contains { json: { ... } }
            };
        } catch (err: any) {
            return {
                success: false,
                error: { message: err.message ?? String(err) },
            };
        } finally {
            clearTimeout(timeout);
        }
    }
}

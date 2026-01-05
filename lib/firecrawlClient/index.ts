
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

    async scrapeJson(url: string, prompt: string): Promise<FirecrawlScrapeResult> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 60000);

        try {
            const response = await fetch(`${this.config.baseUrl}/scrape`, {
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
                            prompt, // our extraction instructions
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
                // leave json empty; will be reported in error
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
                data: json.data, // will contain json + metadata
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

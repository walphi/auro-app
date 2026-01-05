// /lib/rtrvrClient/index.ts

export interface RtrvrConfig {
    apiKey: string;
    baseUrl: string;
    timeout: number;
}

export interface RtrvrResponse {
    success: boolean;
    data: any;
    error?: string;
}

export class RtrvrClient {
    private config: RtrvrConfig;

    constructor(config: RtrvrConfig) {
        this.config = config;
    }

    async createTask(prompt: string): Promise<any> {
        const response = await fetch(`${this.config.baseUrl}/v1/tasks`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt,
                type: "single",
                options: { timeout: 60000 },
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`rtrvr.ai API error: ${response.status} - ${text}`);
        }

        return response.json();
    }
}

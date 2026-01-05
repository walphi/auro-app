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

    async browse(command: string): Promise<RtrvrResponse> {
        try {
            const response = await fetch(`${this.config.baseUrl}/browse`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command }),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    data: null,
                    error: `rtrvr.ai API error: ${response.status} - ${errorText}`
                };
            }

            const data = await response.json();
            return {
                success: true,
                data: data
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message || 'Unknown error during rtrvr.ai call'
            };
        }
    }
}

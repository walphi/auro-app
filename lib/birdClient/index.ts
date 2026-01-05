// /lib/birdClient/index.ts

export interface BirdMessageResponse {
    id: string;
    status: string;
}

export class BirdClient {
    private apiKey: string;
    private workspaceId: string;
    private channelId: string;

    constructor(apiKey: string, workspaceId: string, channelId: string) {
        this.apiKey = apiKey;
        this.workspaceId = workspaceId;
        this.channelId = channelId;
    }

    async sendTextMessage(to: string, text: string): Promise<BirdMessageResponse> {
        const url = `https://api.bird.com/workspaces/${this.workspaceId}/channels/${this.channelId}/messages`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `AccessKey ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                receiver: {
                    contacts: [{ identifierValue: to }]
                },
                body: {
                    type: 'text',
                    text: {
                        text: text
                    }
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Bird API error: ${response.status} - ${error}`);
        }

        return response.json();
    }

    // Add more methods as needed (sendImage, etc.)
    async sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<BirdMessageResponse> {
        const url = `https://api.bird.com/workspaces/${this.workspaceId}/channels/${this.channelId}/messages`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `AccessKey ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                receiver: {
                    contacts: [{ identifierValue: to }]
                },
                body: {
                    type: 'image',
                    image: {
                        url: imageUrl,
                        caption: caption
                    }
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Bird API error: ${response.status} - ${error}`);
        }

        return response.json();
    }
}

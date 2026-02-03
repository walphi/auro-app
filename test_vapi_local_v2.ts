import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { handler } from './netlify/functions/vapi-llm';

async function testVapi() {
    const event = {
        httpMethod: 'POST',
        headers: {
            'x-vapi-secret': process.env.VAPI_SECRET || ''
        },
        body: JSON.stringify({
            messages: [
                { role: 'user', content: 'Tell me about the Passo project on Palm Jumeirah.' }
            ],
            call: {
                id: 'test-vapi-id-123',
                customer: {
                    number: '+447733221144'
                },
                assistantOverrides: {
                    variableValues: {
                        name: 'John Doe',
                        email: 'john.doe@example.com',
                        lead_id: '46b54220-dbad-4dea-9bbf-0cb400bb97a0'
                    }
                }
            }
        })
    };

    const result = await handler(event as any, {} as any, () => { });
    console.log("Response Status:", result?.statusCode);

    if (result?.body && result.statusCode === 200) {
        // Sample the SSE stream
        console.log("Response Sample (first 1000 chars):", result.body.substring(0, 1000));
    } else {
        console.log("Response Body:", result?.body);
    }
}

testVapi().catch(console.error);


import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testWebhook() {
    console.log("🛠 Testing vapi-webhook.ts handler locally...");

    // @ts-ignore
    const { handler } = await import('./netlify/functions/vapi-webhook');

    // Generate a unique time +6 days to avoid conflicts
    const start = new Date();
    start.setDate(start.getDate() + 6);
    start.setHours(14, 0, 0, 0);
    const meetingStartIso = start.toISOString();

    const mockPayload = {
        message: {
            type: "end-of-call-report",
            call: {
                id: "test-call-webhook-" + Date.now(),
                assistantId: "fb5c7ebc-76e9-4e67-876b-967a5babc123",
                assistantOverrides: {
                    variableValues: {
                        lead_id: "554f9429-0c63-45ce-af0d-6714c56d7cce",
                        tenant_id: "1"
                    }
                },
                customer: {
                    number: "+971501234567"
                },
                analysis: {
                    structuredData: {
                        meeting_scheduled: true,
                        meeting_start_iso: meetingStartIso,
                        first_name: "Webhook",
                        last_name: "Tester",
                        email: "phill+test@auro-app.com",
                        phone: "+971501234567",
                        project_name: "Hado by Beyond"
                    }
                }
            }
        }
    };

    const event = {
        httpMethod: "POST",
        body: JSON.stringify(mockPayload),
        headers: {}
    };

    try {
        // @ts-ignore
        const response = await handler(event, {});
        console.log("--- Handler Response ---");
        console.log(response);
    } catch (error) {
        console.error("Handler crashed:", error);
    }
}

testWebhook();

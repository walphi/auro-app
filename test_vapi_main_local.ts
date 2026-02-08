
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testMainVapi() {
    console.log("🛠 Testing vapi.ts handler locally...");

    // @ts-ignore
    const { handler } = await import('./netlify/functions/vapi');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5); // Unique time
    tomorrow.setHours(12, 0, 0, 0);
    const meetingStartIso = tomorrow.toISOString();

    const mockPayload = {
        message: {
            type: "end-of-call-report",
            call: {
                id: "test-call-vapi-main-" + Date.now(),
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
                        first_name: "John",
                        last_name: "Doe",
                        email: "phill+test@auro-app.com",
                        phone: "+971501234567",
                        project_name: "Hado by Beyond"
                    },
                    bookingMade: true
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

testMainVapi();

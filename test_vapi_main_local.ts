
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testMainVapi() {
    console.log("🛠 Testing vapi.ts handler locally...");

    // @ts-ignore
    const { handler } = await import('./netlify/functions/vapi');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1); // Tomorrow
    tomorrow.setHours(14, 0, 0, 0); // 2 PM
    const meetingStartIso = tomorrow.toISOString();

    const mockPayload = {
        message: {
            type: "end-of-call-report",
            call: {
                id: "test-call-vapi-main-" + Date.now(),
                assistantId: "fb5c7ebc-76e9-4e67-876b-967a5babc123", // Dummy ID
                assistantOverrides: {
                    variableValues: {
                        lead_id: "554f9429-0c63-45ce-af0d-6714c56d7cce", // Existing test lead
                        tenant_id: "1"
                    }
                },
                customer: {
                    number: "+971507150121"
                },
                analysis: {
                    structuredData: {
                        meeting_scheduled: true,
                        meeting_start_iso: meetingStartIso,
                        first_name: "Test",
                        last_name: "User",
                        email: "phill+test@auro-app.com",
                        phone: "+971507150121",
                        project_name: "Test Project – DO NOT CONTACT"
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

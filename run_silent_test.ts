
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function runSilentTest() {
    const { handler } = await import('./netlify/functions/vapi');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    const meetingStartIso = tomorrow.toISOString();

    const mockPayload = {
        message: {
            type: "end-of-call-report",
            call: {
                id: "test-call-" + Date.now(),
                assistantId: "fb5c7ebc-76e9-4e67-876b-967a5babc123",
                assistantOverrides: {
                    variableValues: {
                        lead_id: "554f9429-0c63-45ce-af0d-6714c56d7cce",
                        tenant_id: "1"
                    }
                },
                customer: {
                    number: "+971507150121"
                }
            },
            analysis: {
                structuredData: {
                    meeting_scheduled: true,
                    meeting_start_iso: meetingStartIso,
                    first_name: "Test",
                    last_name: "User",
                    email: "phill+test@auro-app.com",
                    phone: "+971507150121",
                    preferred_area: "Dubai Marina"
                },
                bookingMade: true
            }
        }
    };

    const event = {
        httpMethod: "POST",
        body: JSON.stringify(mockPayload),
        headers: {}
    };

    // Override console.log to capture it
    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => {
        logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
        // originalLog(...args); // Keep output for terminal visibility
    };
    console.error = (...args) => {
        logs.push("[ERROR] " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
        // originalError(...args);
    };

    try {
        await handler(event, {});
        console.log = originalLog;
        console.error = originalError;

        console.log("--- CAPTURED LOGS ---");
        logs.forEach(l => {
            if (l.includes('Bitrix') || l.includes('WhatsApp')) {
                console.log(l);
            }
        });
    } catch (error) {
        console.log = originalLog;
        console.error = originalError;
        console.error("Crash:", error);
    }
}

runSilentTest();

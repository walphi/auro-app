
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load envs
const rootDir = path.resolve(__dirname, '..');
console.log('Loading envs from:', rootDir);

dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });

console.log('Env Check after load:');
console.log('SUPABASE_URL:', process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL ? 'SET' : 'MISSING');
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'MISSING');

async function run() {
    // Dynamic import to ensure envs are loaded first
    // tsx handles .ts imports
    const { handler } = await import('../netlify/functions/vapi');

    // 4 days from now + random hour 10-16
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + 4);
    const randomHour = 10 + Math.floor(Math.random() * 6);
    future.setHours(randomHour, 0, 0, 0);

    const meetingTime = future.toISOString();

    const body = {
        message: {
            type: "end-of-call-report",
            call: {
                id: "test-call-" + Date.now(),
                assistantId: "vapi-assistant-id", // might need a real one or it will fallback to default tenant
                customer: {
                    number: "+971507150121"
                },
                assistantOverrides: {
                    variableValues: {
                        tenant_id: "1" // Explicitly requesting tenant 1
                    }
                }
            },
            artifact: {
                structuredOutputs: {
                    "booking_1": {
                        name: "Morgan Booking",
                        result: {
                            meeting_scheduled: true,
                            meeting_start_iso: meetingTime,
                            first_name: "TestUser",
                            last_name: "Automated",
                            email: "test.automated@example.com",
                            phone: "+971507150121",
                            budget: "2M AED",
                            property_type: "Apartment",
                            preferred_area: "Downtown"
                        }
                    }
                }
            },
            analysis: {
                summary: "Test booking call reproduction",
                outcome: "booking_confirmed",
                bookingMade: true
            }
        }
    };

    const event = {
        httpMethod: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    };

    console.log(`Invoking VAPI handler with booking payload for ${meetingTime}...`);
    // @ts-ignore
    const result = await handler(event, {});
    console.log("Response:", JSON.stringify(result, null, 2));
}

run().catch(console.error);

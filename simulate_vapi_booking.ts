
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const WEBHOOK_URL = 'http://localhost:8888/.netlify/functions/vapi-webhook'; // Local dev
const PROD_URL = 'https://auroapp.com/.netlify/functions/vapi-webhook';

// Use a real lead ID from your database for testing
const LEAD_ID = '554f9429-0c63-45ce-af0d-6714c56d7cce';
const PHONE = '+971500000002'; // Change this to your test number if you want a real WhatsApp

async function simulateBooking() {
    console.log("🚀 Simulating Vapi End-of-Call Webhook with Booking...");

    // Pick a time tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const meetingStartIso = tomorrow.toISOString();

    const payload = {
        message: {
            type: "end-of-call-report",
            call: {
                id: "test-call-" + Date.now(),
                assistantId: "fb5c7ebc-76e9-4e67-876b-967a5babc123", // Provident Assistant
                assistantOverrides: {
                    variableValues: {
                        lead_id: LEAD_ID,
                        tenant_id: "1"
                    }
                },
                customer: {
                    number: PHONE
                },
                analysis: {
                    structuredData: {
                        meeting_scheduled: true,
                        meeting_start_iso: meetingStartIso,
                        first_name: "Test",
                        last_name: "Lead",
                        email: "phill+test@auro-app.com",
                        phone: PHONE,
                        project_name: "Hado by Beyond",
                        budget: "2,000,000 AED"
                    }
                }
            }
        }
    };

    try {
        // We use the local URL if running netlify dev, otherwise use prod
        const url = process.argv[2] === 'prod' ? PROD_URL : WEBHOOK_URL;
        console.log(`Sending to: ${url}`);

        const response = await axios.post(url, payload);
        console.log("--- Webhook Response ---");
        console.log(JSON.stringify(response.data, null, 2));
        console.log("------------------------");
    } catch (error: any) {
        console.error("Error:", error.response?.data || error.message);
    }
}

simulateBooking();

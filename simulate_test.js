import { handler } from './netlify/functions/whatsapp-bird.js';
import dotenv from 'dotenv';
dotenv.config();

// Mock event for Bird Webhook
const createEvent = (from, text) => ({
    httpMethod: 'POST',
    body: JSON.stringify({
        event: 'message.created',
        message: {
            direction: 'received',
            sender: {
                contacts: [{ identifierValue: from }]
            },
            body: {
                text: {
                    text: text
                }
            }
        }
    })
});

const testFrom = '+1234567890'; // Use a test number

async function runTest() {
    console.log("--- STARTING SIMULATION ---");

    // 1. Initial greeting
    console.log("\n> User: Hi");
    const res1 = await handler(createEvent(testFrom, 'Hi'), {});
    console.log("Response:", res1.body);

    // 2. Name
    console.log("\n> User: Sarah Ahmed");
    const res2 = await handler(createEvent(testFrom, 'Sarah Ahmed'), {});
    console.log("Response:", res2.body);

    // 3. RERA
    console.log("\n> User: BRN-12345");
    const res3 = await handler(createEvent(testFrom, 'BRN-12345'), {});
    console.log("Response:", res3.body);

    console.log("\n--- SIMULATION FINISHED ---");
}

// Note: This script assumes the exported handler can be called directly.
// We need to make sure the imports in whatsapp-bird.ts are resolvable.
// Since it's TS, we might need a wrapper or use ts-node.
runTest().catch(console.error);

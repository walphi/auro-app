import axios from 'axios';
import * as querystring from 'querystring';

const URL = 'https://auroapp.com/.netlify/functions/whatsapp';
const TO_NUMBER = 'whatsapp:+971565203832'; // Provident (UAE Number)
const FROM_NUMBER = 'whatsapp:+971500000000'; // Simulation Phone

async function sendMessage(text: string) {
    console.log(`\n> Sending: "${text}"`);

    const body = querystring.stringify({
        To: TO_NUMBER,
        From: FROM_NUMBER,
        Body: text,
        NumMedia: '0'
    });

    try {
        const response = await axios.post(URL, body, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('--- Agent Response ---');
        console.log(response.data);
        console.log('----------------------');
        return response.data;
    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
    }
}

async function runTest() {
    console.log("🚀 Starting WhatsApp Agent Simulation (New Lead Persona)");

    // Step 1: Initial Greeting / Inquiry
    await sendMessage("Hi, I saw a post about a new project in D3 from Meraas. Can you tell me more?");

    // Step 2: Specific Question about Amenities (Testing new text file)
    setTimeout(async () => {
        await sendMessage("What amenities does it have? Is there a gym?");
    }, 2000);

    // Step 3: Specific Question about Handover (Testing RAG specificity)
    setTimeout(async () => {
        await sendMessage("And when is the handover expected?");
    }, 4000);
}

runTest();

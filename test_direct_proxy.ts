
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    const listingId = "003f18f2-d1f5-48db-81f1-444522f3a0f98";
    const directUrl = `https://auro-app.netlify.app/.netlify/functions/image-proxy?listingId=${listingId}&index=0`;

    console.log(`Testing Direct URL: ${directUrl}`);

    try {
        const response = await axios.get(directUrl, {
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Content-Length: ${response.headers['content-length']}`);

        if (response.headers['content-type']?.includes('text/html')) {
            console.log("Response is HTML!");
            console.log(Buffer.from(response.data).toString('utf-8').substring(0, 200));
        } else {
            console.log("Response starts with:", Buffer.from(response.data).toString('hex').substring(0, 10));
        }
    } catch (e: any) {
        console.error("Fetch failed:", e.message);
    }
}

test();

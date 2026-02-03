
import axios from 'axios';

async function test() {
    const listingId = "003f18f2-d1f5-48db-81f1-444522f3a0f98";
    const directUrl = `https://auro-app.netlify.app/.netlify/functions/image-proxy?listingId=${listingId}&index=0`;

    console.log(`TEST_START`);
    console.log(`URL: ${directUrl}`);

    try {
        const response = await axios.get(directUrl, {
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        console.log(`STATUS: ${response.status}`);
        console.log(`TYPE: ${response.headers['content-type']}`);
        console.log(`LENGTH: ${response.headers['content-length']}`);

        const body = Buffer.from(response.data).toString('utf-8');
        if (body.includes('<html')) {
            console.log("RESULT: HTML_DETECTED");
        } else if (response.status === 200) {
            console.log("RESULT: IMAGE_DETECTED");
            console.log("MAGIC_BYTES: " + Buffer.from(response.data).toString('hex').substring(0, 8));
        } else {
            console.log("RESULT: OTHER");
            console.log("BODY: " + body.substring(0, 100));
        }
    } catch (e: any) {
        console.log("RESULT: ERROR");
        console.log("MSG: " + e.message);
    }
    console.log(`TEST_END`);
}

test();

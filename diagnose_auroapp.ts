
import axios from 'axios';

async function check(url) {
    try {
        const response = await axios.get(url, {
            validateStatus: () => true,
            timeout: 5000
        });
        console.log(`URL: ${url}`);
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        const body = response.data.toString();
        console.log(`Body Snippet: ${body.substring(0, 50)}`);
        console.log('---');
    } catch (e: any) {
        console.log(`URL: ${url} - Failed: ${e.message}`);
    }
}

const baseUrl = "https://auroapp.com";
async function run() {
    await check(`${baseUrl}/.netlify/functions/whatsapp`);
    await check(`${baseUrl}/.netlify/functions/image-proxy`);
    await check(`${baseUrl}/property-image/test/0.jpg`);
}

run();

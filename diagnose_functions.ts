
import axios from 'axios';

async function check(url) {
    try {
        const response = await axios.get(url, { validateStatus: () => true });
        console.log(`URL: ${url}`);
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        const body = response.data.toString();
        console.log(`Body Snippet: ${body.substring(0, 50)}`);
        console.log('---');
    } catch (e) {
        console.log(`URL: ${url} - Failed: ${e.message}`);
    }
}

const baseUrl = "https://auro-app.netlify.app";
async function run() {
    await check(`${baseUrl}/.netlify/functions/whatsapp`);
    await check(`${baseUrl}/.netlify/functions/image-proxy`);
    await check(`${baseUrl}/.netlify/functions/health`); // Doesn't exist
    await check(`${baseUrl}/property-image/test/0.jpg`);
}

run();

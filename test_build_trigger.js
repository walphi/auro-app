
import axios from 'axios';

async function testBuild() {
    const agentId = "1efaba76-6493-4154-b4e1-5b7a420cf584";
    const url = "https://auroapp.com/.netlify/functions/build-site";

    console.log(`[Test] Triggering manual build for ${agentId}...`);

    try {
        const response = await axios.post(url, { agentId }, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[Test] Success! Status: ${response.status}`);
        console.log(`[Test] Response:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error(`[Test] Failed! Status: ${error.response?.status}`);
        console.error(`[Test] Body:`, error.response?.data);
        console.error(`[Test] Message:`, error.message);
    }
}

testBuild();

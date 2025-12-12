import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const mcpEnvPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');

if (fs.existsSync(mcpEnvPath)) dotenv.config({ path: mcpEnvPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });

const parseKey = process.env.PARSE_API_KEY;
const targetUrl = 'https://www.providentestate.com/buy/properties-for-sale/';

console.log('--- VERIFYING PARSE SCRAPER ---');
console.log(`Key Present: ${!!parseKey}`);
console.log(`Target URL: ${targetUrl}`);

async function testFetch() {
    try {
        const start = Date.now();
        console.log('Calling Parse API...');

        const resp = await fetch('https://api.parse.bot/scraper/98f4861a-6e6b-41ed-8efe-f9ff96ee8fe8/fetch_listing_page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': parseKey },
            body: JSON.stringify({ page_url: targetUrl })
        });

        const duration = Date.now() - start;
        console.log(`Response Status: ${resp.status} (${duration}ms)`);

        if (!resp.ok) {
            console.log(`Error Body:`, await resp.text());
            return;
        }

        const data = await resp.json();
        const jsonStr = JSON.stringify(data, null, 2);

        console.log(`Data Size: ${jsonStr.length} chars`);

        // Peek at content
        console.log('--- DATA PREVIEW (First 500 chars) ---');
        console.log(jsonStr.substring(0, 500));
        console.log('--- DATA END ---');

        // Validation (User provided example has 'accommodation_summary')
        const valid = jsonStr.includes('accommodation_summary') || jsonStr.includes('AED') || jsonStr.includes('Price') || jsonStr.includes('Bedrooms');

        if (valid) {
            console.log('✅ VERIFICATION SUCCESSFUL: Real estate data found.');
        } else {
            console.log('⚠️ WARNING: Data returned but keywords missing.');
        }

    } catch (e) {
        console.log(`Exception: ${e.message}`);
    }
}

testFetch();

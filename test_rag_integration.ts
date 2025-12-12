import { handler as apiHandler } from './netlify/functions/rag-api';
import { handler as queryHandler } from './netlify/functions/rag-query';
import * as dotenv from 'dotenv';

// Load env vars from auro-rag-mcp/.env or root .env
dotenv.config({ path: './auro-rag-mcp/.env' });
dotenv.config(); // Fallback to root

async function runTest() {
    console.log('=== Starting RAG Integration Test ===');

    const clientId = 'test-client';
    const folderId = 'test-folder-' + Date.now();
    const filename = 'test-doc.txt';
    const content = 'The AURO platform provides AI agents for real estate in Dubai. It supports WhatsApp and Voice integration.';

    // 1. Test Upload (Text)
    console.log('\n1. Testing Upload Text...');
    const uploadEvent = {
        path: `/api/v1/client/${clientId}/rag/upload_text`,
        httpMethod: 'POST',
        body: JSON.stringify({
            text: content,
            filename: filename,
            project_id: folderId
        })
    };

    try {
        // @ts-ignore
        const uploadResult = await apiHandler(uploadEvent, {});
        console.log('Upload Result:', uploadResult);

        if (uploadResult.statusCode !== 200) {
            throw new Error(`Upload failed: ${uploadResult.body}`);
        }
    } catch (e) {
        console.error('Upload Error:', e);
        return;
    }

    // Wait a bit for consistency (though Supabase is usually immediate)
    await new Promise(r => setTimeout(r, 2000));

    // 2. Test Query
    console.log('\n2. Testing Query...');
    const queryEvent = {
        path: `/api/v1/client/${clientId}/rag/query`,
        httpMethod: 'POST',
        body: JSON.stringify({
            query: 'What does AURO do?',
            folder_id: folderId,
            top_k: 3
        })
    };

    try {
        // @ts-ignore
        const queryResult = await queryHandler(queryEvent, {});
        console.log('Query Result:', queryResult);

        const body = JSON.parse(queryResult.body);
        if (body.results && body.results.length > 0) {
            console.log('✅ Found matches:', body.results.length);
            console.log('Top match:', body.results[0].content);
        } else {
            console.warn('⚠️ No matches found (might be embedding mismatch or propagation delay)');
        }

    } catch (e) {
        console.error('Query Error:', e);
    }
}

runTest();

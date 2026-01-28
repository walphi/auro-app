import { Handler } from "@netlify/functions";

/**
 * PDF OCR Extraction using LlamaParse
 * Handles image-heavy PDFs that standard text extractors can't read
 */
export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;

    if (!LLAMA_CLOUD_API_KEY) {
        console.error('[PDF-OCR] LLAMA_CLOUD_API_KEY not configured');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'PDF OCR service not configured. Please add LLAMA_CLOUD_API_KEY.' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { pdf_base64, filename, job_id, action = 'start' } = body;

        // Mode 1: Polling for existing job
        if (action === 'check' && job_id) {
            console.log(`[PDF-OCR] Checking status for job: ${job_id}`);
            const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${job_id}`, {
                headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` }
            });

            if (!statusResponse.ok) throw new Error(`Status check failed: ${statusResponse.status}`);
            const statusResult = await statusResponse.json();

            if (statusResult.status === 'SUCCESS') {
                console.log(`[PDF-OCR] Result Success for job: ${job_id}`);
                // Try and get markdown first as it's higher quality from LlamaParse
                const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${job_id}/result/markdown`, {
                    headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` }
                });

                let resultData: any = {};
                if (resultResponse.ok) {
                    resultData = await resultResponse.json();
                    console.log(`[PDF-OCR] Markdown extracted: ${resultData.markdown?.length || 0} chars`);
                } else {
                    // Fallback to text
                    const txtResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${job_id}/result/text`, {
                        headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` }
                    });
                    resultData = await txtResponse.json();
                    console.log(`[PDF-OCR] Text extracted: ${resultData.text?.length || 0} chars`);
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: 'SUCCESS',
                        text: resultData.markdown || resultData.text || ''
                    })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ status: statusResult.status || 'PENDING' })
            };
        }

        // Mode 2: Start new job
        if (!pdf_base64) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing pdf_base64' }) };
        }

        const pdfBuffer = Buffer.from(pdf_base64, 'base64');
        const formData = new FormData();
        // Use a file blob with a specific name and type
        const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
        formData.append('file', fileBlob, filename || 'document.pdf');

        console.log(`[PDF-OCR] Starting upload for ${filename || 'document.pdf'} (${pdfBuffer.length} bytes)`);

        const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` },
            body: formData
        });

        if (!uploadResponse.ok) {
            const errText = await uploadResponse.text();
            console.error(`[PDF-OCR] Upload failed: ${uploadResponse.status}`, errText);
            throw new Error(`LlamaParse upload failed: ${uploadResponse.status} - ${errText}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log(`[PDF-OCR] Job created: ${uploadResult.id}`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, job_id: uploadResult.id })
        };

    } catch (error: any) {
        console.error('[PDF-OCR] Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

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
        // Get base64-encoded PDF from request body
        const body = JSON.parse(event.body || '{}');
        const { pdf_base64, filename } = body;

        if (!pdf_base64) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing pdf_base64 in request body' })
            };
        }

        console.log(`[PDF-OCR] Processing file: ${filename || 'unknown.pdf'}`);

        // Convert base64 to buffer
        const pdfBuffer = Buffer.from(pdf_base64, 'base64');

        // Upload to LlamaParse
        const formData = new FormData();
        formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename || 'document.pdf');

        // Step 1: Upload the PDF
        const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`
            },
            body: formData
        });

        if (!uploadResponse.ok) {
            const errText = await uploadResponse.text();
            throw new Error(`LlamaParse upload failed: ${uploadResponse.status} - ${errText}`);
        }

        const uploadResult = await uploadResponse.json();
        const jobId = uploadResult.id;
        console.log(`[PDF-OCR] Upload successful, job ID: ${jobId}`);

        // Step 2: Poll for completion
        let attempts = 0;
        const maxAttempts = 30; // 30 * 2s = 60 seconds max wait
        let parsedText = '';

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            attempts++;

            const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`
                }
            });

            if (!statusResponse.ok) {
                console.error(`[PDF-OCR] Status check failed: ${statusResponse.status}`);
                continue;
            }

            const statusResult = await statusResponse.json();
            console.log(`[PDF-OCR] Job status: ${statusResult.status} (attempt ${attempts})`);

            if (statusResult.status === 'SUCCESS') {
                // Step 3: Get the parsed result
                const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/text`, {
                    headers: {
                        'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`
                    }
                });

                if (resultResponse.ok) {
                    const resultData = await resultResponse.json();
                    parsedText = resultData.text || resultData.markdown || '';
                    console.log(`[PDF-OCR] Extraction successful: ${parsedText.length} chars`);
                    break;
                }
            } else if (statusResult.status === 'ERROR') {
                throw new Error(`LlamaParse job failed: ${statusResult.error || 'Unknown error'}`);
            }
            // Otherwise keep polling (PENDING status)
        }

        if (!parsedText) {
            throw new Error('PDF parsing timed out or returned empty content');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                text: parsedText,
                filename: filename,
                chars: parsedText.length
            })
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

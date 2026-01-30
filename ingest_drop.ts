import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdf from 'pdf-parse';
import { crypto } from 'node:crypto';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const DROP_FOLDER = 'knowledge_drop';
const PROCESSED_FOLDER = path.join(DROP_FOLDER, 'processed');

if (!fs.existsSync(PROCESSED_FOLDER)) {
    fs.mkdirSync(PROCESSED_FOLDER);
}

function chunkText(text: string, size: number = 800, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.substring(start, end));
        start += size - overlap;
    }
    return chunks;
}

async function ingestFile(filename: string) {
    const filePath = path.join(DROP_FOLDER, filename);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return;

    let content = '';

    console.log(`Processing ${filename}...`);

    if (filename.toLowerCase().endsWith('.pdf')) {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await (pdf as any)(dataBuffer);
            content = pdfData.text;
            content = content.replace(/\n\s*\n/g, '\n').trim();
        } catch (e: any) {
            console.error(`Error parsing PDF ${filename}:`, e.message);
            return;
        }
    } else if (filename.match(/\.(txt|md|json|csv)$/i)) {
        content = fs.readFileSync(filePath, 'utf-8');
    } else {
        console.log(`Skipping unsupported file type: ${filename}`);
        return;
    }

    if (!content || content.length < 50) {
        console.warn(`Content too short for ${filename}, skipping.`);
        return;
    }

    let folderId = 'projects';
    if (filename.toLowerCase().includes('edit') || filename.toLowerCase().includes('campaign')) folderId = 'campaign_docs';
    if (filename.toLowerCase().includes('market')) folderId = 'market_reports';
    if (filename.toLowerCase().includes('agency') || filename.toLowerCase().includes('history')) folderId = 'agency_history';

    console.log(`Ingesting into folder: ${folderId}, length: ${content.length}`);

    const { data: doc, error: docError } = await supabase
        .from('knowledge_base')
        .insert({
            tenant_id: 1,
            folder_id: folderId,
            source_name: filename,
            type: 'text',
            content: content,
            metadata: { contentLength: content.length, source: 'knowledge_drop' }
        })
        .select()
        .single();

    if (docError) {
        console.error('Error creating doc record:', docError);
        return;
    }

    const chunks = chunkText(content);
    console.log(`Created doc ${doc.id}, embedding ${chunks.length} chunks...`);

    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    let successCount = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 2000));

            const result = await model.embedContent({
                content: { role: 'user', parts: [{ text: chunk }] },
                taskType: 'RETRIEVAL_DOCUMENT' as any,
                outputDimensionality: 768
            } as any);

            // Generate a random chunk_id since it's required
            const chunkId = `sync:${doc.id}:${i}`;

            const { error: chunkError } = await supabase.from('rag_chunks').insert({
                chunk_id: chunkId,
                tenant_id: 1,
                document_id: doc.id,
                folder_id: folderId,
                client_id: 'provident',
                content: chunk,
                embedding: result.embedding.values,
                metadata: { index: i, source: filename }
            });

            if (chunkError) {
                console.error(`\nError inserting chunk ${i}:`, chunkError);
            } else {
                successCount++;
                process.stdout.write('.');
            }
        } catch (e: any) {
            console.error(`\nError embedding chunk ${i}:`, e.message);
        }
    }
    console.log(`\nSuccessfully ingested ${successCount} chunks.`);

    const newPath = path.join(PROCESSED_FOLDER, filename);
    fs.renameSync(filePath, newPath);
    console.log(`Moved ${filename} to processed folder.`);
}

async function main() {
    const files = fs.readdirSync(DROP_FOLDER);
    console.log(`Found ${files.length} items in ${DROP_FOLDER}`);

    for (const file of files) {
        if (file === 'processed') continue;
        await ingestFile(file);
    }
}

main();

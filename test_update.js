import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve('auro-rag-mcp', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('No credentials found.'); process.exit(1); }
const supabase = createClient(url, key);

async function main() {
    const leadPhone = '+971507150121';
    const listingId = '023b2feb-48d3-4f4f-8310-d743b7c843aa';

    console.log(`Searching for lead with phone ${leadPhone}...`);
    const { data: lead } = await supabase.from('leads').select('id').eq('phone', leadPhone).single();

    if (lead) {
        console.log(`Found lead ID: ${lead.id}. Updating current_listing_id to ${listingId}...`);
        const { data, error } = await supabase.from('leads').update({ current_listing_id: listingId }).eq('id', lead.id);
        if (error) {
            console.error('Update error:', error);
        } else {
            console.log('Update successful (locally).');
            // Check again
            const { data: updatedLead } = await supabase.from('leads').select('current_listing_id').eq('id', lead.id).single();
            console.log('Updated lead current_listing_id:', updatedLead.current_listing_id);
        }
    } else {
        console.log('Lead not found.');
    }
}
main();

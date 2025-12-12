
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// Use service role if available for better access, but anon is what the app uses mostly
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLead() {
    const phone = '+971507150121';
    console.log(`Checking for lead with phone: ${phone}`);

    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', phone);

    if (error) {
        console.error("Error fetching lead:", error);
    } else {
        console.log(`Found ${data.length} leads matching ${phone}:`);
        console.log(JSON.stringify(data, null, 2));
    }
}

checkLead();


const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectColumns() {
    try {
        // Fetch one row to see columns
        const { data, error } = await supabase.from('agentconfigs').select('*').limit(1);
        if (error) {
            console.error('Error fetching agentconfigs:', error);
            // If table is empty, we might need another way.
            // Let's try to insert a dummy and see what fails or just use the error.
        } else if (data && data.length > 0) {
            console.log('Columns in agentconfigs:', Object.keys(data[0]));
        } else {
            console.log('Table agentconfigs is empty. Trying to describe table via RPC or just guessing from errors.');
        }

        // Try to get table info from information_schema if possible via query
        const { data: schemaData, error: schemaError } = await supabase.from('agentconfigs').select().limit(0);
        console.log('Target columns in types vs actual?');
    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

inspectColumns();

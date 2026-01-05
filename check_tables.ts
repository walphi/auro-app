
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkTables() {
    const { data: configs, error: configsError } = await supabase.from('agentconfigs').select('count').limit(1);
    console.log('agentconfigs check:', { configs, configsError });

    const { data: siteDocs, error: siteDocsError } = await supabase.from('agent_site_documents').select('count').limit(1);
    console.log('agent_site_documents check:', { siteDocs, siteDocsError });
}

checkTables();

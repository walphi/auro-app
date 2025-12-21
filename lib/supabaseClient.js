import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load Environment
const envPath = path.resolve('auro-rag-mcp', '.env');
const rootEnvPath = path.resolve('.env');
const localEnvPath = path.resolve('.env.local');

if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
if (fs.existsSync(localEnvPath)) dotenv.config({ path: localEnvPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in lib/supabaseClient.js');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// This script simulates the build-site-background function by calling the Netlify function endpoint if running,
// or by manually triggering the build if we have the local URL.
// Since we don't have a reliable way to call the local endpoint without knowing the port,
// we will just instruct the user on how to do it or try a common port.

async function trigger() {
    const agentId = '1efaba76-6493-4154-b4e1-5b7a4420cf584';
    const ports = [8888, 3000, 3001, 5173];

    for (const port of ports) {
        try {
            console.log(`Checking port ${port}...`);
            const response = await axios.post(`http://localhost:${port}/.netlify/functions/build-site-background`, {
                agentId
            }, { timeout: 2000 });
            console.log(`Successfully triggered build on port ${port}:`, response.status);
            return;
        } catch (e) {
            // console.log(`Failed on port ${port}`);
        }
    }

    console.log("Could not find a local Netlify Dev server. Please run 'npm start' or 'netlify dev' and then call this script, or trigger it manually via the dashboard.");
}

trigger();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/sbng/Desktop/ANTIGRAVITY/WEB college/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('cohort_chats').select('*').limit(1);
    console.log(JSON.stringify(data));
}
run();

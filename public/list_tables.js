import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/sbng/Desktop/ANTIGRAVITY/WEB college/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    console.log("Columns in users:", Object.keys(data[0] || {}).join(', '));
    
    // Try to find activity table
    const { data: acts } = await supabase.from('user_activity').select('*').limit(1);
    if (acts) console.log("user_activity table exists");
}
run();

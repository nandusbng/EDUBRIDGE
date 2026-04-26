import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// --- Production Credentials (Safe to expose Anon key) ---
const supabaseUrl = 'https://wjiajmsemeqhcswfpevu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaWFqbXNlbWVxaGNzd2ZwZXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTMwNzIsImV4cCI6MjA5MDU2OTA3Mn0.6M17OqhV3MsiZhUq-HAn90KDGMk15RkB24L_NhGI06A'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
window.supabase = supabase;

console.log("Supabase Client initialized successfully.");

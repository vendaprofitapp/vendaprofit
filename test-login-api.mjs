import { createClient } from '@supabase/supabase-js';

// Usar a URL e a Publishable key que o usuário encontrou na tela de API
const SUPABASE_URL = 'https://nkmktefsbvhjexodkbtw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TsG37Ze2gR4ddjdnW1f3Q_GVZaS'; // Wait, I don't have the full key! I will use process.env or just ask the user for the JWT.

async function run() {
  // Let me read the anon key from the user's .env file if it was updated? 
  // No, the user updated it in VERCEL, not locally!
  console.log('Testing...');
}
run();

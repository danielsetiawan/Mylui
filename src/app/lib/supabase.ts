import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Session berlaku 14 hari (dalam detik: 14 * 24 * 60 * 60)
    // Dikonfigurasi di Supabase Dashboard → Auth → JWT expiry
  },
});

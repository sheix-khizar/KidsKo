import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Lazy service-role client for backend-only writes with no user session (e.g. webhooks).
// Fails explicitly if SUPABASE_SERVICE_ROLE_KEY is missing from .env instead of silently falling back.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!supabaseServiceKey) {
      throw new Error(
        '❌ SUPABASE_SERVICE_ROLE_KEY is missing in backend/.env. Service role operations require this key.'
      );
    }
    const client = createClient(supabaseUrl, supabaseServiceKey);
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export function createUserScopedClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

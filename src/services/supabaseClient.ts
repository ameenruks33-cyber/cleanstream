import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anon)
}

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
    })
  : null

/**
 * Supabase Client for client-side operations
 * Used for price tag generation, RPC calls, and CRUD operations
 * that bypass Prisma for tables not in the Prisma schema.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('[Supabase] Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Using placeholders for build compilation.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase

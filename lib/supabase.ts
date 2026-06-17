/**
 * Supabase Client for client-side operations
 * Used for price tag generation, RPC calls, and CRUD operations
 * that bypass Prisma for tables not in the Prisma schema.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase

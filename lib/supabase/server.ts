import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'

export function createClient() {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  )

  // Wrap client.auth.getSession to fallback to NextAuth session if Supabase session is empty
  const originalGetSession = client.auth.getSession.bind(client.auth)
  client.auth.getSession = (async () => {
    const res = await originalGetSession()
    if (res.data?.session) return res

    // Fallback: Check NextAuth session
    try {
      const nextAuthSession = await getServerSession(authOptions)
      if (nextAuthSession?.user) {
        return {
          data: {
            session: {
              user: {
                id: (nextAuthSession.user as any).id || 'admin-user',
                email: nextAuthSession.user.email,
              },
            } as any,
          },
          error: null,
        }
      }
    } catch (e) {
      console.error('[Supabase Server Client Auth Fallback Error]', e)
    }

    return res
  }) as any

  return client
}

export default createClient

import { NextRequest } from 'next/server'
import { downloadFile } from '@/lib/workdrive/api'
import { createClient } from '@/lib/supabase/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // 1. Check NextAuth Session
  const adminSession = await getServerSession(authOptions)
  let hasSession = !!adminSession?.user

  // 2. Check Supabase Session if NextAuth is not present
  if (!hasSession) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      hasSession = true
    }
  }

  if (!hasSession) {
    return new Response('Unauthorized', { status: 401 })
  }

  const fileId = req.nextUrl.searchParams.get('fileId')
  if (!fileId) return new Response('fileId required', { status: 400 })

  try {
    const zohoRes = await downloadFile(fileId)
    const contentType = zohoRes.headers.get('content-type') ?? 'image/jpeg'
    return new Response(zohoRes.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err: any) {
    console.error('[WorkDrive image proxy]', err)
    return new Response(err.message, { status: 500 })
  }
}

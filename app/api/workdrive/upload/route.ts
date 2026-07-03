import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/workdrive/api'
import { createClient } from '@/lib/supabase/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null

    if (!file || !folderId) {
      return NextResponse.json({ error: 'file and folderId required' }, { status: 400 })
    }

    const result = await uploadFile(folderId, file)
    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      name: result.name,
    })
  } catch (err: any) {
    console.error('[WorkDrive upload route]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

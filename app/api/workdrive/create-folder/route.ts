import { NextRequest, NextResponse } from 'next/server'
import { createFolder, createWorkspaceFolder } from '@/lib/workdrive/api'
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
    const { parentFolderId, name } = await req.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    // If no parentFolderId given, create at workspace root level
    const data = parentFolderId
      ? await createFolder(parentFolderId, name)
      : await createWorkspaceFolder(name)

    return NextResponse.json({
      success: true,
      folderId: data.data?.id,
      folderName: data.data?.attributes?.name ?? name,
    })
  } catch (err: any) {
    console.error('[WorkDrive create-folder]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

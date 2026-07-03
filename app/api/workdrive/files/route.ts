import { NextRequest, NextResponse } from 'next/server'
import { listFolderFiles } from '@/lib/workdrive/api'
import { createClient } from '@/lib/supabase/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const folderId = req.nextUrl.searchParams.get('folderId')
  if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 })

  try {
    const data = await listFolderFiles(folderId)
    const files = (data.data ?? []).map((f: any) => {
      const attr = f.attributes ?? {}
      const ext = (attr.ext ?? attr.extension ?? '').toLowerCase()
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)
      return {
        id: f.id,
        name: attr.name ?? 'Untitled',
        type: attr.type ?? 'file',
        size: attr.storage_info?.size_in_bytes ?? attr.file_size ?? 0,
        extension: ext,
        createdTime: attr.created_time ?? attr.created_time_i18 ?? '',
        modifiedTime: attr.last_modified_time ?? '',
        isImage,
        isFolder: attr.is_folder ?? false,
      }
    })
    return NextResponse.json({ files })
  } catch (err: any) {
    console.error('[WorkDrive files]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

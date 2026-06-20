import { NextRequest, NextResponse } from 'next/server'
import { createFolder, createWorkspaceFolder } from '@/lib/workdrive/api'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

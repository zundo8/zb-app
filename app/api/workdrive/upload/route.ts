import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/workdrive/api'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

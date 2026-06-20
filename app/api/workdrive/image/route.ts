import { NextRequest } from 'next/server'
import { downloadFile } from '@/lib/workdrive/api'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

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

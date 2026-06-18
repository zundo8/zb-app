import { randomUUID } from 'crypto';

/**
 * Uploads a file buffer to Supabase storage bucket 'uploads' and returns its public URL.
 * Falls back to base64 data URL if credentials are not configured.
 */
export async function uploadToStorage(buffer: Buffer, mimeType: string, originalName: string): Promise<{ url: string; fallback: boolean }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Storage] Supabase credentials not found. Falling back to base64 encoding.');
    const base64 = buffer.toString('base64');
    return {
      url: `data:${mimeType};base64,${base64}`,
      fallback: true
    };
  }

  // Determine file extension
  const ext = originalName.split('.').pop() || 'jpg';
  const filename = `${randomUUID()}.${ext}`;

  try {
    const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/uploads/${filename}`;
    
    console.log(`[Storage] Uploading ${filename} (${buffer.length} bytes) to Supabase...`);
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    console.log('[Storage] Upload success:', data);

    const publicUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/uploads/${filename}`;
    return {
      url: publicUrl,
      fallback: false
    };
  } catch (error: any) {
    console.error('[Storage] Supabase upload failed, falling back to base64:', error.message);
    const base64 = buffer.toString('base64');
    return {
      url: `data:${mimeType};base64,${base64}`,
      fallback: true
    };
  }
}

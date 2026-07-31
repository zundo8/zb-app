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
    const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/store-assets/uploads/${filename}`;
    
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

    const publicUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/store-assets/uploads/${filename}`;
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

/**
 * Uploads a social sharing image file buffer to Supabase storage bucket 'store-assets/social-sharing/' and returns its public URL.
 * Throws an Error if Supabase credentials are missing or if the upload fails.
 * Base64 data URIs are strictly forbidden because social crawlers (Meta, Twitter, etc.) cannot fetch data: URIs.
 */
export async function uploadSocialSharingImage(buffer: Buffer, mimeType: string, originalName: string): Promise<{ url: string; fallback: boolean }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('[Storage] Missing Supabase credentials. Please configure NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).');
  }

  // Determine file extension
  const ext = originalName.split('.').pop() || 'jpg';
  const filename = `social-sharing/${randomUUID()}.${ext}`;

  try {
    const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/store-assets/${filename}`;
    
    console.log(`[Storage] Uploading social sharing image ${filename} (${buffer.length} bytes) to Supabase store-assets bucket...`);
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

    const publicUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/store-assets/${filename}`;
    return {
      url: publicUrl,
      fallback: false
    };
  } catch (error: any) {
    console.error('[Storage] Supabase social sharing upload failed:', error.message);
    throw new Error(`[Storage] Failed to upload social sharing image: ${error.message}`);
  }
}


/**
 * Shared image upload validation utilities.
 * Magic-byte content sniffing to prevent extension spoofing.
 */

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Sniff the real image type from file magic bytes.
 * Returns the MIME type if valid, or null if not a recognized image format.
 */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';

  // WebP: RIFF....WEBP
  if (
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';

  // GIF: 47 49 46
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';

  // AVIF/HEIC: ftyp box at offset 4
  if (buf.length >= 8 && buf.slice(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.slice(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heix' || brand === 'mif1') return 'image/heic';
  }

  return null;
}

/**
 * Validates file size against the max upload limit.
 * Returns an error message if too large, or null if OK.
 */
export function validateFileSize(size: number, maxBytes: number = MAX_UPLOAD_SIZE): string | null {
  if (size > maxBytes) {
    const maxMB = Math.round(maxBytes / (1024 * 1024));
    return `File too large. Max ${maxMB}MB.`;
  }
  return null;
}

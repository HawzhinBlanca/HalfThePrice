import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Sniffs a buffer's magic bytes to verify PDF, PNG, JPEG, and WebP signatures.
 */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 4) {
    const magic = buffer.subarray(0, 4);
    // PDF: %PDF (25 50 44 46)
    if (magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46) {
      return "application/pdf";
    }
    // PNG: 89 50 4E 47
    else if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47) {
      return "image/png";
    }
    // JPEG: FF D8 FF
    else if (magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF) {
      return "image/jpeg";
    }
    // WEBP: RIFF (52 49 46 46) at 0..3 and WEBP (57 45 42 50) at 8..11
    else if (buffer.length >= 12 &&
             magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46 &&
             buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return "image/webp";
    }
  }
  return null;
}

/**
 * Performs a constant-time timing-safe byte comparison via SHA-256 hashing.
 */
export function timingSafeMatch(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  try {
    return timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}

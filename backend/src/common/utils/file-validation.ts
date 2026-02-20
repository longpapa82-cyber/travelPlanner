import { readFileSync, unlinkSync } from 'fs';

const IMAGE_SIGNATURES: Array<{ ext: string; magic: number[] }> = [
  { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
  { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
];

export function validateImageMagicBytes(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(12);
    const fd = readFileSync(filePath);
    fd.copy(buffer, 0, 0, Math.min(12, fd.length));

    const isValid = IMAGE_SIGNATURES.some(({ magic }) =>
      magic.every((byte, i) => buffer[i] === byte),
    );

    if (!isValid) {
      unlinkSync(filePath);
    }

    return isValid;
  } catch {
    return false;
  }
}

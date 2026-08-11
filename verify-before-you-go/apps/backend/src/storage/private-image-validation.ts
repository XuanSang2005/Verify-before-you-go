import sharp from 'sharp';

import type { PrivateAttachmentInput } from './private-attachment-storage.js';

type PrivateImageMimeType = PrivateAttachmentInput['mimeType'];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const MAX_DECODED_IMAGE_PIXELS = 40_000_000;

function hasBytes(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000)
    + ((bytes[offset + 1] ?? 0) << 16)
    + ((bytes[offset + 2] ?? 0) << 8)
    + (bytes[offset + 3] ?? 0)
  );
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0)
    + ((bytes[offset + 1] ?? 0) << 8)
    + ((bytes[offset + 2] ?? 0) << 16)
    + ((bytes[offset + 3] ?? 0) * 0x1000000)
  );
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 45 || !hasBytes(bytes, 0, PNG_SIGNATURE)) return false;

  let offset: number = PNG_SIGNATURE.length;
  let chunkIndex = 0;
  let hasHeader = false;

  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32BigEndian(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const chunkEnd = offset + 12 + length;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.byteLength) return false;

    if (chunkIndex === 0) {
      if (type !== 'IHDR' || length !== 13) return false;
      const width = readUint32BigEndian(bytes, offset + 8);
      const height = readUint32BigEndian(bytes, offset + 12);
      if (width === 0 || height === 0) return false;
      hasHeader = true;
    }

    if (type === 'IEND') return hasHeader && length === 0 && chunkEnd === bytes.byteLength;

    offset = chunkEnd;
    chunkIndex += 1;
  }

  return false;
}

function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 10 || !hasBytes(bytes, 0, [0xff, 0xd8])) return false;

  let offset = 2;
  let hasSegment = false;
  let hasFrame = false;

  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    if (marker === undefined || marker === 0x00 || marker === 0xd8) return false;
    offset += 1;

    if (marker === 0xd9) return hasSegment && offset === bytes.byteLength;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.byteLength) return false;

    const segmentLength = ((bytes[offset] ?? 0) << 8) + (bytes[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) return false;
    hasSegment = true;

    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      if (segmentLength < 8) return false;
      const height = ((bytes[offset + 3] ?? 0) << 8) + (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 0);
      if (width === 0 || height === 0) return false;
      hasFrame = true;
    }

    if (marker === 0xda) {
      if (!hasFrame || segmentLength < 6) return false;
      offset += segmentLength;
      while (offset + 1 < bytes.byteLength) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const next = bytes[offset + 1];
        if (next === 0x00 || (next !== undefined && next >= 0xd0 && next <= 0xd7)) {
          offset += 2;
          continue;
        }
        if (next === 0xd9) return hasSegment && offset + 2 === bytes.byteLength;
        return false;
      }
      return false;
    }

    offset += segmentLength;
  }

  return false;
}

function isWebp(bytes: Uint8Array): boolean {
  if (
    bytes.byteLength < 25
    || ascii(bytes, 0, 4) !== 'RIFF'
    || ascii(bytes, 8, 4) !== 'WEBP'
  ) return false;

  const riffSize = readUint32LittleEndian(bytes, 4);
  const chunkType = ascii(bytes, 12, 4);
  const chunkSize = readUint32LittleEndian(bytes, 16);
  const paddedChunkSize = chunkSize + (chunkSize % 2);
  if (riffSize !== bytes.byteLength - 8 || 20 + paddedChunkSize > bytes.byteLength) return false;

  if (chunkType === 'VP8 ') {
    return chunkSize >= 10 && hasBytes(bytes, 23, [0x9d, 0x01, 0x2a]);
  }
  if (chunkType === 'VP8L') return chunkSize >= 5 && bytes[20] === 0x2f;
  if (chunkType === 'VP8X') return chunkSize >= 10;
  return false;
}

export async function validatePrivateImage(
  bytes: Uint8Array,
  declaredMimeType: PrivateImageMimeType,
): Promise<PrivateImageMimeType> {
  const detectedMimeType: PrivateImageMimeType | undefined = isPng(bytes)
    ? 'image/png'
    : isJpeg(bytes)
      ? 'image/jpeg'
      : isWebp(bytes)
        ? 'image/webp'
        : undefined;

  if (!detectedMimeType) throw new Error('Private attachment is not a valid supported image.');
  if (detectedMimeType !== declaredMimeType) {
    throw new Error('Private attachment content does not match its declared file type.');
  }

  try {
    const decoder = sharp(bytes, {
      animated: false,
      failOn: 'warning',
      limitInputPixels: MAX_DECODED_IMAGE_PIXELS,
      pages: 1,
    });
    const metadata = await decoder.metadata();
    const decodedMimeType = mimeTypeForSharpFormat(metadata.format);
    if (decodedMimeType !== declaredMimeType) {
      throw new Error('Private attachment content does not match its declared file type.');
    }
    if (!metadata.width || !metadata.height) throw new Error('Private attachment has no decodable image dimensions.');
    if ((metadata.pages ?? 1) !== 1) throw new Error('Animated or multi-page private attachments are not supported.');
    if (metadata.width * metadata.height > MAX_DECODED_IMAGE_PIXELS) {
      throw new Error('Private attachment decoded pixel count is too large.');
    }
    const decoded = await decoder.clone().raw().toBuffer({ resolveWithObject: true });
    if (
      decoded.data.byteLength === 0
      || decoded.info.width !== metadata.width
      || decoded.info.height !== metadata.height
    ) throw new Error('Private attachment pixels could not be decoded.');
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('does not match')
      || error.message.includes('not supported')
      || error.message.includes('pixel count')
    )) throw error;
    throw new Error('Private attachment is not a decodable supported image.');
  }
  return detectedMimeType;
}

function mimeTypeForSharpFormat(format: string | undefined): PrivateImageMimeType | undefined {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  return undefined;
}

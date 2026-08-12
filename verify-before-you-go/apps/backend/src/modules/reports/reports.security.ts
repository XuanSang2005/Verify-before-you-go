import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const base32Alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const scrypt = promisify(nodeScrypt);
const REPORT_ENCRYPTION_SCHEMA_VERSION = 2;

export interface ReportEncryptionContext {
  publicReportId: string;
  fieldName: 'privateIdentifier' | 'privateDescription' | 'namedPartner' | 'recoveryKeyDelivery';
}

export interface ReportSecurityKeys {
  privateDataEncryption: Buffer;
  recoveryDeliveryEncryption: Buffer;
  idempotencyHmac: Buffer;
  identifierHmac: Buffer;
  payloadHmac: Buffer;
}

export function deriveReportSecurityKeys(encodedSecret: string): ReportSecurityKeys {
  if (!/^[A-Za-z0-9_-]{43,}$/u.test(encodedSecret)) {
    throw new Error('REPORT_SECURITY_SECRET must be a base64url-encoded high-entropy value.');
  }
  const master = Buffer.from(encodedSecret, 'base64url');
  if (master.byteLength < 32) {
    throw new Error('REPORT_SECURITY_SECRET must contain at least 256 bits.');
  }
  const derive = (domain: string) => Buffer.from(hkdfSync(
    'sha256',
    master,
    Buffer.from('vbyg-report-security-v2', 'utf8'),
    Buffer.from(domain, 'utf8'),
    32,
  ));
  return {
    privateDataEncryption: derive('private-data-encryption'),
    recoveryDeliveryEncryption: derive('recovery-delivery-encryption'),
    idempotencyHmac: derive('idempotency-hmac'),
    identifierHmac: derive('identifier-hmac'),
    payloadHmac: derive('payload-hmac'),
  };
}

export function createPublicReportId(bytes = randomBytes(10)): string {
  if (bytes.byteLength !== 10) throw new Error('Public report IDs require exactly 80 bits of randomness.');
  return `R-${encodeBase32(bytes)}`;
}

export function createRandomRecoveryKey(bytes = randomBytes(16)): string {
  if (bytes.byteLength !== 16) throw new Error('Recovery keys require exactly 128 bits of randomness.');
  return groupRecoveryKey(encodeBase32(bytes));
}

export async function hashRecoveryKey(recoveryKey: string, salt = randomBytes(16)): Promise<string> {
  const derived = await scrypt(recoveryKey, salt, 32) as Buffer;
  return `scrypt-v1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyRecoveryKey(recoveryKey: string, encodedHash: string): Promise<boolean> {
  const [version, encodedSalt, encodedExpected, extra] = encodedHash.split('$');
  if (version !== 'scrypt-v1' || !encodedSalt || !encodedExpected || extra !== undefined) return false;
  const salt = decodeCanonicalBase64Url(encodedSalt);
  const expected = decodeCanonicalBase64Url(encodedExpected);
  if (!salt || salt.byteLength !== 16 || !expected || expected.byteLength !== 32) return false;
  const derived = await scrypt(recoveryKey, salt, expected.byteLength) as Buffer;
  return timingSafeEqual(derived, expected);
}

export function hashIdempotencyKey(idempotencyKey: string, key: Buffer): string {
  return createHmac('sha256', key)
    .update('report-idempotency-v2\0')
    .update(idempotencyKey)
    .digest('hex');
}

export function hashNormalizedIdentifier(identifierType: string, identifier: string, key: Buffer): string {
  return createHmac('sha256', key)
    .update('report-identifier-v2\0')
    .update(identifierType)
    .update('\0')
    .update(normalizeIdentifier(identifier))
    .digest('hex');
}

export function hashSubmissionPayload(canonicalPayload: string, key: Buffer): string {
  return createHmac('sha256', key)
    .update('report-payload-v2\0')
    .update(canonicalPayload)
    .digest('hex');
}

export function encryptPrivateReportText(
  plaintext: string,
  key: Buffer,
  context: ReportEncryptionContext,
  initializationVector = randomBytes(12),
): string {
  if (key.byteLength !== 32) throw new Error('Private report encryption requires a 256-bit key.');
  if (initializationVector.byteLength !== 12) throw new Error('Private report encryption requires a 96-bit nonce.');
  const cipher = createCipheriv('aes-256-gcm', key, initializationVector);
  cipher.setAAD(createAdditionalAuthenticatedData(context));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'aes-gcm-v2',
    Buffer.from(initializationVector).toString('base64url'),
    encrypted.toString('base64url'),
    tag.toString('base64url'),
  ].join('$');
}

export function decryptPrivateReportText(
  ciphertext: string,
  key: Buffer,
  context: ReportEncryptionContext,
): string {
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = ciphertext.split('$');
  if (version !== 'aes-gcm-v2' || !encodedIv || encodedCiphertext === undefined || !encodedTag || extra !== undefined) {
    throw new Error('Private report ciphertext is invalid.');
  }
  const initializationVector = Buffer.from(encodedIv, 'base64url');
  const encrypted = Buffer.from(encodedCiphertext, 'base64url');
  const tag = Buffer.from(encodedTag, 'base64url');
  if (initializationVector.byteLength !== 12 || tag.byteLength !== 16) {
    throw new Error('Private report ciphertext is invalid.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, initializationVector);
  decipher.setAAD(createAdditionalAuthenticatedData(context));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function createAdditionalAuthenticatedData(context: ReportEncryptionContext): Buffer {
  return Buffer.from(JSON.stringify({
    schemaVersion: REPORT_ENCRYPTION_SCHEMA_VERSION,
    publicReportId: context.publicReportId,
    fieldName: context.fieldName,
  }), 'utf8');
}

function normalizeIdentifier(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/gu, ' ');
}

function groupRecoveryKey(value: string): string {
  return value.match(/.{1,4}/gu)?.join('-') ?? value;
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += base32Alphabet[(value << (5 - bits)) & 31];
  return output;
}

function decodeCanonicalBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : null;
}

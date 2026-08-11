import {
  SHARE_TOKEN_MAX_LIFETIME_MS,
  ShareSummaryRequestSchema,
  ShareTokenClaimsSchema,
  ShareTokenCreationResponseSchema,
  ShareTokenSchema,
  ShareTokenVerificationResponseSchema,
  type ShareSummaryRequest,
  type ShareTokenClaims,
  type ShareTokenCreationResponse,
  type ShareTokenVerificationResponse,
} from '@vbyg/contracts';
import {
  createHmac,
  hkdfSync,
  timingSafeEqual,
} from 'node:crypto';

const SHARE_TOKEN_DOMAIN = 'share-token-signing-v1';
const SHARE_TOKEN_VERSION = 'v1';
const SHARE_TOKEN_FUTURE_TOLERANCE_MS = 60_000;

export class InvalidShareTokenError extends Error {
  constructor() {
    super('The shared summary token is invalid.');
    this.name = 'InvalidShareTokenError';
  }
}

export class ExpiredShareTokenError extends Error {
  constructor() {
    super('The shared summary token has expired.');
    this.name = 'ExpiredShareTokenError';
  }
}

export type ShareTokenDependencies = {
  lifetimeMs?: number;
  now?: () => Date;
};

export function deriveShareTokenSigningKey(encodedSecret: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43,}$/u.test(encodedSecret)) {
    throw new Error('REPORT_SECURITY_SECRET must be a base64url-encoded high-entropy value.');
  }
  const master = Buffer.from(encodedSecret, 'base64url');
  if (master.byteLength < 32) {
    throw new Error('REPORT_SECURITY_SECRET must contain at least 256 bits.');
  }
  return Buffer.from(hkdfSync(
    'sha256',
    master,
    Buffer.from('vbyg-share-token-security-v1', 'utf8'),
    Buffer.from(SHARE_TOKEN_DOMAIN, 'utf8'),
    32,
  ));
}

export function issueShareToken(
  input: ShareSummaryRequest,
  encodedSecret: string,
  dependencies: ShareTokenDependencies = {},
): ShareTokenCreationResponse {
  const summary = ShareSummaryRequestSchema.parse(input);
  const issuedAt = (dependencies.now ?? (() => new Date()))();
  const lifetimeMs = dependencies.lifetimeMs ?? SHARE_TOKEN_MAX_LIFETIME_MS;
  if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs <= 0 || lifetimeMs > SHARE_TOKEN_MAX_LIFETIME_MS) {
    throw new InvalidShareTokenError();
  }
  const claims = ShareTokenClaimsSchema.parse({
    schemaVersion: summary.schemaVersion,
    findingIds: summary.findingIds,
    demo: summary.demo,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + lifetimeMs).toISOString(),
  });
  const payload = encodeClaims(claims);
  const signature = signPayload(payload, deriveShareTokenSigningKey(encodedSecret));
  return ShareTokenCreationResponseSchema.parse({
    token: `${SHARE_TOKEN_VERSION}.${payload}.${signature}`,
    expiresAt: claims.expiresAt,
  });
}

export function verifyShareToken(
  token: string,
  encodedSecret: string,
  now = new Date(),
): ShareTokenVerificationResponse {
  const parsedToken = ShareTokenSchema.safeParse(token);
  if (!parsedToken.success) throw new InvalidShareTokenError();
  const [version, payload, signature, extra] = parsedToken.data.split('.');
  if (version !== SHARE_TOKEN_VERSION || !payload || !signature || extra !== undefined) {
    throw new InvalidShareTokenError();
  }
  const expectedSignature = Buffer.from(
    signPayload(payload, deriveShareTokenSigningKey(encodedSecret)),
    'base64url',
  );
  const suppliedSignature = Buffer.from(signature, 'base64url');
  if (
    suppliedSignature.byteLength !== expectedSignature.byteLength
    || !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new InvalidShareTokenError();
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidShareTokenError();
  }
  const claims = ShareTokenClaimsSchema.safeParse(decoded);
  if (!claims.success || encodeClaims(claims.data) !== payload) throw new InvalidShareTokenError();

  const issuedAt = Date.parse(claims.data.issuedAt);
  const expiresAt = Date.parse(claims.data.expiresAt);
  if (issuedAt > now.getTime() + SHARE_TOKEN_FUTURE_TOLERANCE_MS) throw new InvalidShareTokenError();
  if (expiresAt <= now.getTime()) throw new ExpiredShareTokenError();

  return ShareTokenVerificationResponseSchema.parse({
    ...claims.data,
    checkedRuleCount: 9,
  });
}

function encodeClaims(claims: ShareTokenClaims): string {
  const canonical = JSON.stringify({
    schemaVersion: claims.schemaVersion,
    findingIds: claims.findingIds,
    demo: claims.demo,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  });
  return Buffer.from(canonical, 'utf8').toString('base64url');
}

function signPayload(payload: string, key: Buffer): string {
  return createHmac('sha256', key)
    .update(`${SHARE_TOKEN_DOMAIN}\0`, 'utf8')
    .update(payload, 'ascii')
    .digest('base64url');
}

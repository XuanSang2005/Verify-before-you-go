export const REPORT_DRAFT_SCHEMA_VERSION = 1 as const;
export const MAX_REPORT_DESCRIPTION_LENGTH = 4_000;
export const MAX_REPORT_IDENTIFIER_LENGTH = 500;
export const MAX_REPORT_EVIDENCE_ITEMS = 5;
export const MAX_REPORT_EVIDENCE_BYTES = 10 * 1024 * 1024;

export const reportBehaviourOptions = [
  {
    id: 'identity-document-request',
    title: 'Passport or ID requested before a contract',
  },
  {
    id: 'payment-request',
    title: 'Payment, fee or deposit requested',
  },
  {
    id: 'pressure',
    title: 'Pressure or “only a few places left”',
  },
  {
    id: 'company-not-found',
    title: 'Company identity could not be verified',
  },
  {
    id: 'contract-visa-mismatch',
    title: 'Contract, role or visa details did not match',
  },
  {
    id: 'travel-accommodation-control',
    title: 'Travel or accommodation controlled by recruiter',
  },
  {
    id: 'impersonation',
    title: 'Sender appeared to impersonate an organisation',
  },
] as const;

export const reportSubjectOptions = [
  { id: 'job-post', label: 'Job post' },
  { id: 'recruiter', label: 'Recruiter or contact' },
  { id: 'company', label: 'Claimed company' },
  { id: 'agency', label: 'Recruitment agency' },
] as const;

export const reportIdentifierOptions = [
  { id: 'url', label: 'URL or domain', placeholder: 'example.org/job-post' },
  { id: 'phone', label: 'Phone number', placeholder: '+00 000 000 000' },
  { id: 'handle', label: 'Messaging handle', placeholder: '@recruiter_handle' },
  { id: 'payment-account', label: 'Payment account', placeholder: 'Account or wallet reference' },
  { id: 'claimed-entity', label: 'Claimed entity', placeholder: 'Organisation or agency name' },
] as const;

export type ReportBehaviourId = (typeof reportBehaviourOptions)[number]['id'];
export type ReportSubjectType = (typeof reportSubjectOptions)[number]['id'];
export type ReportIdentifierType = (typeof reportIdentifierOptions)[number]['id'];

export interface ReportEvidenceDraft {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  width?: number;
  height?: number;
  addedAt: string;
}

export interface ReportSharingPermissions {
  useForPrivateMatching: boolean;
  allowRedactedPublicAlert: boolean;
  shareWithNamedPartner: boolean;
  namedPartner: string;
}

export interface ReportDraft {
  schemaVersion: typeof REPORT_DRAFT_SCHEMA_VERSION;
  subjectType: ReportSubjectType;
  identifierType: ReportIdentifierType;
  identifier: string;
  behaviourIds: ReportBehaviourId[];
  description: string;
  evidence: ReportEvidenceDraft[];
  permissions: ReportSharingPermissions;
  redactedPreview?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDraftErrors {
  identifier?: string;
  behaviours?: string;
  description?: string;
  evidence?: string;
  namedPartner?: string;
}

export type ReportDraftParseStatus = 'empty' | 'valid' | 'recovered';

const behaviourIds = new Set<string>(reportBehaviourOptions.map((option) => option.id));
const subjectTypes = new Set<string>(reportSubjectOptions.map((option) => option.id));
const identifierTypes = new Set<string>(reportIdentifierOptions.map((option) => option.id));
const allowedEvidenceTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function createEmptyReportDraft(timestamp = new Date().toISOString()): ReportDraft {
  return {
    schemaVersion: REPORT_DRAFT_SCHEMA_VERSION,
    subjectType: 'job-post',
    identifierType: 'url',
    identifier: '',
    behaviourIds: [],
    description: '',
    evidence: [],
    permissions: {
      useForPrivateMatching: true,
      allowRedactedPublicAlert: false,
      shareWithNamedPartner: false,
      namedPartner: '',
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateReportDraft(
  draft: ReportDraft,
  patch: Partial<Omit<ReportDraft, 'schemaVersion' | 'createdAt'>>,
  timestamp = new Date().toISOString(),
): ReportDraft {
  const permissions = patch.permissions ?? draft.permissions;
  return {
    ...draft,
    ...patch,
    permissions: {
      ...permissions,
      namedPartner: permissions.shareWithNamedPartner ? permissions.namedPartner : '',
    },
    schemaVersion: REPORT_DRAFT_SCHEMA_VERSION,
    createdAt: draft.createdAt,
    updatedAt: timestamp,
  };
}

export function toggleReportBehaviour(
  draft: ReportDraft,
  behaviourId: ReportBehaviourId,
  timestamp = new Date().toISOString(),
): ReportDraft {
  const selected = draft.behaviourIds.includes(behaviourId);
  return updateReportDraft(draft, {
    behaviourIds: selected
      ? draft.behaviourIds.filter((id) => id !== behaviourId)
      : [...draft.behaviourIds, behaviourId],
  }, timestamp);
}

export function prepareReportDraft(draft: ReportDraft): ReportDraft {
  const prepared: ReportDraft = {
    ...draft,
    identifier: draft.identifier.trim(),
    description: draft.description.trim(),
    permissions: {
      ...draft.permissions,
      namedPartner: draft.permissions.shareWithNamedPartner
        ? draft.permissions.namedPartner.trim()
        : '',
    },
  };
  const redactedPreview = draft.redactedPreview?.trim();
  if (redactedPreview) prepared.redactedPreview = redactedPreview;
  else delete prepared.redactedPreview;
  return prepared;
}

export function validateReportDraftForPrivacy(draft: ReportDraft): ReportDraftErrors {
  const prepared = prepareReportDraft(draft);
  const errors: ReportDraftErrors = {};
  if (!prepared.identifier) {
    errors.identifier = 'Add one searchable identifier or source location to continue.';
  } else if (prepared.identifier.length > MAX_REPORT_IDENTIFIER_LENGTH) {
    errors.identifier = `Keep the identifier under ${MAX_REPORT_IDENTIFIER_LENGTH} characters.`;
  }
  if (prepared.behaviourIds.length === 0) {
    errors.behaviours = 'Select at least one behaviour you observed.';
  }
  if (prepared.description.length > MAX_REPORT_DESCRIPTION_LENGTH) {
    errors.description = `Keep the factual description under ${MAX_REPORT_DESCRIPTION_LENGTH.toLocaleString('en-US')} characters.`;
  }
  if (prepared.evidence.length > MAX_REPORT_EVIDENCE_ITEMS) {
    errors.evidence = `Attach no more than ${MAX_REPORT_EVIDENCE_ITEMS} images.`;
  } else {
    const invalidEvidence = prepared.evidence.find((item) => getReportEvidenceError(item));
    if (invalidEvidence) errors.evidence = getReportEvidenceError(invalidEvidence);
  }
  if (prepared.permissions.shareWithNamedPartner && !prepared.permissions.namedPartner) {
    errors.namedPartner = 'Name the support partner before allowing this share.';
  }
  return errors;
}

export function hasReportDraftErrors(errors: ReportDraftErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function getReportEvidenceError(evidence: Pick<ReportEvidenceDraft, 'fileSize' | 'mimeType'>): string | undefined {
  if (!allowedEvidenceTypes.has(evidence.mimeType.toLowerCase())) {
    return 'Choose a JPEG, PNG or WebP image.';
  }
  if (evidence.fileSize && evidence.fileSize > MAX_REPORT_EVIDENCE_BYTES) {
    return 'Choose an image smaller than 10 MB.';
  }
  return undefined;
}

export function parseReportDraft(
  raw: string | null,
  fallbackTimestamp = new Date().toISOString(),
): { draft: ReportDraft; status: ReportDraftParseStatus } {
  if (raw === null) return { draft: createEmptyReportDraft(fallbackTimestamp), status: 'empty' };
  try {
    const value: unknown = JSON.parse(raw);
    if (!isReportDraft(value)) throw new Error('Invalid report draft');
    return { draft: prepareReportDraft(value), status: 'valid' };
  } catch {
    return { draft: createEmptyReportDraft(fallbackTimestamp), status: 'recovered' };
  }
}

export function serializeReportDraft(draft: ReportDraft): string {
  return JSON.stringify(prepareReportDraft(draft));
}

export function reportDraftHasUserContent(draft: ReportDraft): boolean {
  return Boolean(
    draft.identifier.trim()
    || draft.description.trim()
    || draft.behaviourIds.length
    || draft.evidence.length,
  );
}

function isReportDraft(value: unknown): value is ReportDraft {
  if (!isRecord(value)
    || value.schemaVersion !== REPORT_DRAFT_SCHEMA_VERSION
    || !subjectTypes.has(String(value.subjectType))
    || !identifierTypes.has(String(value.identifierType))
    || typeof value.identifier !== 'string'
    || typeof value.description !== 'string'
    || !Array.isArray(value.behaviourIds)
    || !value.behaviourIds.every((id) => typeof id === 'string' && behaviourIds.has(id))
    || !Array.isArray(value.evidence)
    || !value.evidence.every(isReportEvidence)
    || !isReportPermissions(value.permissions)
    || (value.redactedPreview !== undefined && typeof value.redactedPreview !== 'string')
    || !isIsoTimestamp(value.createdAt)
    || !isIsoTimestamp(value.updatedAt)) {
    return false;
  }
  return true;
}

function isReportEvidence(value: unknown): value is ReportEvidenceDraft {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.uri === 'string'
    && value.uri.length > 0
    && typeof value.fileName === 'string'
    && value.fileName.length > 0
    && typeof value.mimeType === 'string'
    && (value.fileSize === undefined || (typeof value.fileSize === 'number' && Number.isFinite(value.fileSize) && value.fileSize >= 0))
    && (value.width === undefined || (typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0))
    && (value.height === undefined || (typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0))
    && isIsoTimestamp(value.addedAt);
}

function isReportPermissions(value: unknown): value is ReportSharingPermissions {
  return isRecord(value)
    && typeof value.useForPrivateMatching === 'boolean'
    && typeof value.allowRedactedPublicAlert === 'boolean'
    && typeof value.shareWithNamedPartner === 'boolean'
    && typeof value.namedPartner === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export const LOCAL_V1_REPORT_CLEANUP_CONFIRMATION =
  'delete-exactly-3-authorized-local-synthetic-v1-reports' as const;

export const AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS = [
  { publicId: 'R-4WZ8D2WXEV83VCBT', submittedAt: '2026-08-11T14:27:39.558Z' },
  { publicId: 'R-V4BDTHHTFWWRHLSL', submittedAt: '2026-08-11T14:43:06.021Z' },
  { publicId: 'R-MW6YWCTHH42XM5PH', submittedAt: '2026-08-11T14:43:57.724Z' },
] as const;

export interface LocalV1ReportCleanupCandidate {
  publicId: string;
  submittedAt: Date;
  status: string;
  privateIdentifier: string;
  privateDescription: string;
  namedPartner: string | null;
  recoveryKeyDeliveryCiphertext: string | null;
  recoveryKeyDeliverUntil: Date | null;
}

export interface LocalV1ReportCleanupPort {
  loadAuthorizedCandidates: (publicIds: readonly string[]) => Promise<LocalV1ReportCleanupCandidate[]>;
  deleteAuthorizedCandidates: () => Promise<number>;
}

export function assertLocalV1CleanupEnvironment(
  databaseUrl: string,
  nodeEnvironment: string | undefined,
  confirmation: string | undefined,
): void {
  if (nodeEnvironment === 'production') throw new Error('Local v1 report cleanup is disabled in production.');
  if (confirmation !== LOCAL_V1_REPORT_CLEANUP_CONFIRMATION) {
    throw new Error('Local v1 report cleanup requires the exact confirmation token.');
  }
  const parsed = new URL(databaseUrl);
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (!localHosts.has(parsed.hostname) || parsed.pathname !== '/verify_before_you_go') {
    throw new Error('Local v1 report cleanup is restricted to the local verify_before_you_go database.');
  }
}

export async function deleteAuthorizedLocalSyntheticV1Reports(
  port: LocalV1ReportCleanupPort,
): Promise<number> {
  const authorizedIds = AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS.map((report) => report.publicId);
  const candidates = await port.loadAuthorizedCandidates(authorizedIds);
  assertAuthorizedCandidates(candidates);
  const deleted = await port.deleteAuthorizedCandidates();
  if (deleted !== AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS.length) {
    throw new Error('Guarded local v1 report cleanup did not delete exactly three records.');
  }
  return deleted;
}

export function assertAuthorizedCandidates(candidates: LocalV1ReportCleanupCandidate[]): void {
  if (candidates.length !== AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS.length) {
    throw new Error('Guarded local v1 report cleanup requires exactly three matching records.');
  }

  const byId = new Map(candidates.map((candidate) => [candidate.publicId, candidate]));
  for (const authorization of AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS) {
    const candidate = byId.get(authorization.publicId);
    if (!candidate
      || candidate.submittedAt.toISOString() !== authorization.submittedAt
      || candidate.status !== 'RECEIVED'
      || !candidate.privateIdentifier.startsWith('aes-gcm-v1$')
      || !candidate.privateDescription.startsWith('aes-gcm-v1$')
      || candidate.namedPartner !== null
      || candidate.recoveryKeyDeliveryCiphertext !== null
      || candidate.recoveryKeyDeliverUntil !== null) {
      throw new Error('A local report no longer matches its authorized synthetic v1 fingerprint.');
    }
  }
}

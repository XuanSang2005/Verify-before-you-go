import { Platform } from 'react-native';

import type { ReportEvidenceDraft } from './report-model';
import { runEvidenceTransaction } from './indexeddb-evidence-transaction';
import type { LocalReportEvidenceStoragePort } from './report-evidence-storage-port';

const WEB_DATABASE_NAME = 'vbyg-private-report-evidence';
const WEB_OBJECT_STORE = 'evidence';
const WEB_URI_PREFIX = 'vbyg-private-evidence://';
const evidenceIdPattern = /^evidence-[a-z0-9-]+$/u;

export const localReportEvidenceStorage: LocalReportEvidenceStoragePort = {
  persist: persistLocalReportEvidence,
  remove: removeLocalReportEvidence,
  listEvidenceIds: listLocalReportEvidenceIds,
};

export async function persistLocalReportEvidence(evidence: ReportEvidenceDraft): Promise<ReportEvidenceDraft> {
  assertEvidenceId(evidence.id);
  if (Platform.OS === 'web') return persistWebEvidence(evidence);
  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.document, 'private-report-evidence');
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${evidence.id}.${extensionForMimeType(evidence.mimeType)}`);
  await new File(evidence.uri).copy(destination);
  return { ...evidence, uri: destination.uri };
}

export async function removeLocalReportEvidence(evidenceId: string): Promise<void> {
  assertEvidenceId(evidenceId);
  if (Platform.OS === 'web') {
    const database = await openEvidenceDatabase();
    try {
      await runEvidenceTransaction(database, 'readwrite', (store) => store.delete(evidenceId));
    } finally {
      database.close();
    }
    return;
  }
  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.document, 'private-report-evidence');
  if (!directory.exists) return;
  for (const entry of directory.list()) {
    if (entry instanceof File && entry.name.startsWith(`${evidenceId}.`) && entry.exists) entry.delete();
  }
}

export async function listLocalReportEvidenceIds(): Promise<string[]> {
  if (Platform.OS === 'web') {
    const database = await openEvidenceDatabase();
    try {
      const keys = await runEvidenceTransaction<IDBValidKey[]>(database, 'readonly', (store) => store.getAllKeys());
      return keys.filter((key): key is string => typeof key === 'string' && evidenceIdPattern.test(key));
    } finally {
      database.close();
    }
  }
  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.document, 'private-report-evidence');
  if (!directory.exists) return [];
  return [...new Set(directory.list().flatMap((entry) => {
    if (!(entry instanceof File)) return [];
    const id = entry.name.replace(/\.[^.]+$/u, '');
    return evidenceIdPattern.test(id) ? [id] : [];
  }))];
}

export async function resolveLocalReportEvidenceUri(evidence: ReportEvidenceDraft): Promise<string> {
  if (Platform.OS !== 'web' || !evidence.uri.startsWith(WEB_URI_PREFIX)) return evidence.uri;
  const database = await openEvidenceDatabase();
  let value: Blob | undefined;
  try {
    value = await runEvidenceTransaction<Blob | undefined>(database, 'readonly', (store) => store.get(evidence.id));
  } finally {
    database.close();
  }
  if (!(value instanceof Blob)) throw new Error('Private evidence is unavailable on this device.');
  return URL.createObjectURL(value);
}

export function releaseResolvedReportEvidenceUri(uri: string): void {
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}

async function persistWebEvidence(evidence: ReportEvidenceDraft): Promise<ReportEvidenceDraft> {
  if (typeof indexedDB === 'undefined') throw new Error('Private evidence storage is unavailable in this browser.');
  const blob = await readLocalBlob(evidence.uri);
  const database = await openEvidenceDatabase();
  try {
    await runEvidenceTransaction(database, 'readwrite', (store) => store.put(blob, evidence.id));
  } finally {
    database.close();
  }
  return { ...evidence, uri: `${WEB_URI_PREFIX}${evidence.id}` };
}

function readLocalBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', uri, true);
    request.responseType = 'blob';
    request.onerror = () => reject(new Error('The selected evidence could not be read.'));
    request.onload = () => {
      if (request.status !== 0 && (request.status < 200 || request.status >= 300)) {
        reject(new Error('The selected evidence could not be read.'));
        return;
      }
      if (!(request.response instanceof Blob)) {
        reject(new Error('The selected evidence was not an image blob.'));
        return;
      }
      resolve(request.response);
    };
    request.send();
  });
}

function openEvidenceDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Private evidence storage is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WEB_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WEB_OBJECT_STORE)) request.result.createObjectStore(WEB_OBJECT_STORE);
    };
    request.onerror = () => reject(request.error ?? new Error('Private evidence storage could not be opened.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function assertEvidenceId(evidenceId: string): void {
  if (!evidenceIdPattern.test(evidenceId)) throw new Error('Invalid private evidence identifier.');
}

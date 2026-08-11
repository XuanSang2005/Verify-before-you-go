import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  getReportEvidenceError,
  MAX_REPORT_EVIDENCE_ITEMS,
  type ReportEvidenceDraft,
} from './report-model';

export type ReportAttachmentPickResult =
  | { status: 'cancelled' }
  | { status: 'selected'; evidence: ReportEvidenceDraft }
  | { status: 'error'; message: string };

export interface ReportAttachmentPickerPort {
  pick: (currentCount: number) => Promise<ReportAttachmentPickResult>;
}

export const localPrivateReportAttachmentPicker: ReportAttachmentPickerPort = {
  pick: pickPrivateReportEvidence,
};

export async function pickPrivateReportEvidence(currentCount: number): Promise<ReportAttachmentPickResult> {
  if (currentCount >= MAX_REPORT_EVIDENCE_ITEMS) {
    return { status: 'error', message: `Attach no more than ${MAX_REPORT_EVIDENCE_ITEMS} images.` };
  }
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return {
          status: 'error',
          message: 'Photo-library access is needed to choose evidence. You can continue without an attachment.',
        };
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: false,
      exif: false,
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
    const asset = result.assets[0];
    const mimeType = asset.mimeType || inferImageMimeType(asset.fileName || asset.uri);
    const now = new Date().toISOString();
    const evidence: ReportEvidenceDraft = {
      id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      uri: asset.uri,
      fileName: asset.fileName || `report-evidence-${Date.now()}.${extensionForMimeType(mimeType)}`,
      mimeType,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
      addedAt: now,
    };
    const error = getReportEvidenceError(evidence);
    return error ? { status: 'error', message: error } : { status: 'selected', evidence };
  } catch {
    return {
      status: 'error',
      message: 'The image could not be selected. Try another image or continue without evidence.',
    };
  }
}

function inferImageMimeType(name: string): string {
  const normalized = name.toLowerCase().split(/[?#]/u)[0];
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

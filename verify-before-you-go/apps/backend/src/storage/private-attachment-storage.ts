export const MAX_PRIVATE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface PrivateAttachmentInput {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface StoredAttachment {
  attachmentId: string;
  byteLength: number;
  mimeType: PrivateAttachmentInput['mimeType'];
}

export interface AttachmentStorage {
  store: (input: PrivateAttachmentInput) => Promise<StoredAttachment>;
  read: (attachmentId: string) => Promise<Uint8Array>;
  delete: (attachmentId: string) => Promise<void>;
}

import { randomUUID } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rm,
  unlink,
  type FileHandle,
} from 'node:fs/promises';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

import {
  MAX_PRIVATE_ATTACHMENT_BYTES,
  type AttachmentStorage,
  type PrivateAttachmentInput,
  type StoredAttachment,
} from './private-attachment-storage.js';
import { validatePrivateImage } from './private-image-validation.js';

const storageKeyPattern = /^attachment_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export interface LocalAttachmentStorageDependencies {
  openFile: (path: string, flags: number, mode?: number) => Promise<FileHandle>;
  writeFile: (file: FileHandle, bytes: Uint8Array) => Promise<void>;
  syncFile: (file: FileHandle) => Promise<void>;
  closeFile: (file: FileHandle) => Promise<void>;
  renameFile: (from: string, to: string) => Promise<void>;
}

const defaultDependencies: LocalAttachmentStorageDependencies = {
  openFile: (path, flags, mode) => open(path, flags, mode),
  writeFile: async (file, bytes) => file.writeFile(bytes),
  syncFile: async (file) => file.sync(),
  closeFile: async (file) => file.close(),
  renameFile: rename,
};

export class LocalPrivateAttachmentStorage implements AttachmentStorage {
  private readonly rootDirectory: string;
  private readonly attachmentDirectory: string;
  private trustedRootDirectory?: string;

  constructor(
    rootDirectory: string,
    private readonly dependencies: LocalAttachmentStorageDependencies = defaultDependencies,
  ) {
    this.rootDirectory = resolve(rootDirectory);
    this.attachmentDirectory = resolve(this.rootDirectory, 'private-attachments');
  }

  async store({ bytes, mimeType }: PrivateAttachmentInput): Promise<StoredAttachment> {
    if (bytes.byteLength === 0) throw new Error('Private attachment cannot be empty.');
    if (bytes.byteLength > MAX_PRIVATE_ATTACHMENT_BYTES) throw new Error('Private attachment exceeds the 10 MB limit.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Unsupported private attachment file type.');
    const safeBytes = Uint8Array.from(bytes);
    await validatePrivateImage(safeBytes, mimeType);
    const verifiedDirectory = await this.verifyStorageDirectories();

    const storageKey = `attachment_${randomUUID()}`;
    const finalPath = this.resolveStorageKey(storageKey, verifiedDirectory.attachmentDirectory);
    const temporaryPath = resolve(verifiedDirectory.attachmentDirectory, `.tmp_${randomUUID()}`);
    this.assertPathWithinTrustedRoot(temporaryPath, verifiedDirectory.rootDirectory);
    let file: FileHandle | undefined;
    let closed = false;

    try {
      file = await this.dependencies.openFile(
        temporaryPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
        0o600,
      );
      await this.dependencies.writeFile(file, safeBytes);
      await this.dependencies.syncFile(file);
      await this.dependencies.closeFile(file);
      closed = true;
      await this.assertSameAttachmentDirectory(verifiedDirectory);
      await this.dependencies.renameFile(temporaryPath, finalPath);
    } catch (error) {
      if (file && !closed) await file.close().catch(() => undefined);
      await Promise.allSettled([
        rm(temporaryPath, { force: true }),
        rm(finalPath, { force: true }),
      ]);
      throw error;
    }

    return { attachmentId: storageKey, byteLength: safeBytes.byteLength, mimeType };
  }

  async read(storageKey: string): Promise<Uint8Array> {
    const verifiedDirectory = await this.verifyStorageDirectories();
    const path = this.resolveStorageKey(storageKey, verifiedDirectory.attachmentDirectory);
    const entry = await lstat(path);
    this.assertSafeStoredFile(entry);
    await this.assertSameAttachmentDirectory(verifiedDirectory);
    const file = await this.dependencies.openFile(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const openedEntry = await file.stat();
      this.assertSafeStoredFile(openedEntry);
      return new Uint8Array(await file.readFile());
    } finally {
      await file.close();
    }
  }

  async delete(storageKey: string): Promise<void> {
    const verifiedDirectory = await this.verifyStorageDirectories();
    const path = this.resolveStorageKey(storageKey, verifiedDirectory.attachmentDirectory);
    let entry: Stats;
    try {
      entry = await lstat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    this.assertSafeStoredFile(entry);
    const file = await this.dependencies.openFile(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      this.assertSafeStoredFile(await file.stat());
    } finally {
      await file.close();
    }
    await this.assertSameAttachmentDirectory(verifiedDirectory);
    await unlink(path);
  }

  private resolveStorageKey(storageKey: string, canonicalAttachmentDirectory: string): string {
    if (!storageKeyPattern.test(storageKey)) throw new Error('Invalid private attachment storage key.');
    const candidate = resolve(canonicalAttachmentDirectory, storageKey);
    this.assertPathWithinTrustedRoot(candidate, this.trustedRootDirectory ?? canonicalAttachmentDirectory);
    return candidate;
  }

  private async verifyStorageDirectories(): Promise<VerifiedStorageDirectory> {
    await this.ensureDirectory(this.rootDirectory);
    await this.ensureDirectory(this.attachmentDirectory);
    const canonicalRootDirectory = await realpath(this.rootDirectory);
    const canonicalAttachmentDirectory = await realpath(this.attachmentDirectory);
    if (canonicalAttachmentDirectory !== resolve(canonicalRootDirectory, 'private-attachments')) {
      throw new Error('Private attachment directory escaped its canonical storage root.');
    }
    if (this.trustedRootDirectory && canonicalRootDirectory !== this.trustedRootDirectory) {
      throw new Error('Private attachment storage root changed after it was trusted.');
    }
    this.trustedRootDirectory = canonicalRootDirectory;
    this.assertPathWithinTrustedRoot(canonicalAttachmentDirectory, canonicalRootDirectory);
    const attachmentEntry = await lstat(canonicalAttachmentDirectory);
    if (attachmentEntry.isSymbolicLink() || !attachmentEntry.isDirectory()) {
      throw new Error('Private attachment storage directory is not a real directory.');
    }
    return {
      attachmentDevice: attachmentEntry.dev,
      attachmentDirectory: canonicalAttachmentDirectory,
      attachmentInode: attachmentEntry.ino,
      rootDirectory: canonicalRootDirectory,
    };
  }

  private async ensureDirectory(path: string): Promise<void> {
    await this.assertNoUnsafeSymlinkComponents(path);
    await mkdir(path, { mode: 0o700, recursive: true });
    await this.assertNoUnsafeSymlinkComponents(path);
    const entry = await lstat(path);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error('Private attachment storage directory is not a real directory.');
    }
    await chmod(path, 0o700);
  }

  private async assertSameAttachmentDirectory(expected: VerifiedStorageDirectory): Promise<void> {
    const current = await this.verifyStorageDirectories();
    if (
      current.rootDirectory !== expected.rootDirectory
      || current.attachmentDirectory !== expected.attachmentDirectory
      || current.attachmentDevice !== expected.attachmentDevice
      || current.attachmentInode !== expected.attachmentInode
    ) throw new Error('Private attachment directory changed during the storage operation.');
  }

  private async assertNoUnsafeSymlinkComponents(path: string): Promise<void> {
    const parsed = parse(path);
    let current = parsed.root;
    const components = path.slice(parsed.root.length).split(sep).filter(Boolean);
    for (const component of components) {
      current = join(current, component);
      let entry: Stats;
      try {
        entry = await lstat(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      if (!entry.isSymbolicLink()) continue;
      const canonical = await realpath(current);
      if (!isAllowedMacOsSystemAlias(current, canonical)) {
        throw new Error('Private attachment storage path contains an unsafe symlink component.');
      }
    }
  }

  private assertPathWithinTrustedRoot(candidate: string, trustedRoot: string): void {
    const relativePath = relative(trustedRoot, candidate);
    if (
      relativePath === '..'
      || relativePath.startsWith(`..${sep}`)
      || isAbsolute(relativePath)
    ) throw new Error('Private attachment path escaped its canonical storage root.');
  }

  private assertSafeStoredFile(entry: Stats): void {
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error('Private attachment entry is not a regular file.');
    }
    if (entry.size > MAX_PRIVATE_ATTACHMENT_BYTES) {
      throw new Error('Private attachment exceeds the 10 MB limit.');
    }
  }
}

interface VerifiedStorageDirectory {
  attachmentDevice: number;
  attachmentDirectory: string;
  attachmentInode: number;
  rootDirectory: string;
}

function isAllowedMacOsSystemAlias(path: string, canonicalPath: string): boolean {
  if (process.platform !== 'darwin') return false;
  return (path === '/var' && canonicalPath === '/private/var')
    || (path === '/tmp' && canonicalPath === '/private/tmp');
}

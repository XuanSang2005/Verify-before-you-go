import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
  type FileHandle,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import {
  LocalPrivateAttachmentStorage,
  type LocalAttachmentStorageDependencies,
} from '../src/storage/local-private-attachment-storage.js';

const headerOnlyPngFixture = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0x00, 0x00, 0x00, 0x00,
]);

const structuralOnlyJpegFixture = new Uint8Array([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x00,
  0xff, 0xd9,
]);

const headerOnlyWebpFixture = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58,
  0x0a, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const sourcePixel = {
  create: {
    background: { alpha: 1, b: 41, g: 97, r: 173 },
    channels: 4 as const,
    height: 1,
    width: 1,
  },
};
const [jpegFixture, pngFixture, webpFixture, animatedWebpFixture] = await Promise.all([
  sharp(sourcePixel).jpeg().toBuffer().then((bytes) => new Uint8Array(bytes)),
  sharp(sourcePixel).png().toBuffer().then((bytes) => new Uint8Array(bytes)),
  sharp(sourcePixel).webp().toBuffer().then((bytes) => new Uint8Array(bytes)),
  sharp(Buffer.from([
    0xff, 0x00, 0x00, 0xff,
    0x00, 0x00, 0xff, 0xff,
  ]), {
    raw: { channels: 4, height: 2, pageHeight: 1, width: 1 },
  }).webp({ delay: [80, 80], loop: 0 }).toBuffer().then((bytes) => new Uint8Array(bytes)),
]);

const defaultDependencies: LocalAttachmentStorageDependencies = {
  openFile: (path, flags, mode) => open(path, flags, mode),
  writeFile: async (file, bytes) => file.writeFile(bytes),
  syncFile: async (file) => file.sync(),
  closeFile: async (file) => file.close(),
  renameFile: rename,
};

async function temporaryRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vbyg-private-attachments-'));
  t.after(async () => rm(root, { force: true, recursive: true }));
  return root;
}

test('local adapter stores valid JPEG, PNG and WebP bytes with canonical IDs and private permissions', async (t) => {
  const root = await temporaryRoot(t);
  const storage = new LocalPrivateAttachmentStorage(root);

  for (const [mimeType, source] of [
    ['image/jpeg', jpegFixture],
    ['image/png', pngFixture],
    ['image/webp', webpFixture],
  ] as const) {
    const stored = await storage.store({ bytes: source, mimeType });
    assert.match(stored.attachmentId, /^attachment_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    assert.equal(stored.byteLength, source.byteLength);
    assert.equal(stored.mimeType, mimeType);
    assert.deepEqual(Array.from(await storage.read(stored.attachmentId)), Array.from(source));

    const file = await stat(join(root, 'private-attachments', stored.attachmentId));
    assert.equal(file.mode & 0o077, 0);
  }

  const directories = [await stat(root), await stat(join(root, 'private-attachments'))];
  for (const directory of directories) assert.equal(directory.mode & 0o077, 0);
});

test('adapter copies caller bytes before any asynchronous storage work', async (t) => {
  const root = await temporaryRoot(t);
  const source = Uint8Array.from(pngFixture);
  const storage = new LocalPrivateAttachmentStorage(root, {
    ...defaultDependencies,
    writeFile: async (file, bytes) => {
      source.fill(0);
      await file.writeFile(bytes);
    },
  });

  const stored = await storage.store({ bytes: source, mimeType: 'image/png' });
  assert.deepEqual(Array.from(await storage.read(stored.attachmentId)), Array.from(pngFixture));
});

test('adapter rejects executable, random, mismatched, truncated, empty and oversized content before publication', async (t) => {
  const root = await temporaryRoot(t);
  const storage = new LocalPrivateAttachmentStorage(root);
  const executable = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
  const random = new Uint8Array([0x13, 0x37, 0x42, 0x99, 0x01, 0x02, 0x03]);

  await assert.rejects(() => storage.store({ bytes: executable, mimeType: 'image/png' }), /not a valid supported image/u);
  await assert.rejects(() => storage.store({ bytes: random, mimeType: 'image/webp' }), /not a valid supported image/u);
  await assert.rejects(() => storage.store({ bytes: pngFixture, mimeType: 'image/jpeg' }), /does not match/u);
  await assert.rejects(() => storage.store({ bytes: pngFixture.slice(0, -1), mimeType: 'image/png' }), /not a valid supported image/u);
  await assert.rejects(() => storage.store({ bytes: jpegFixture.slice(0, -2), mimeType: 'image/jpeg' }), /not a valid supported image/u);
  await assert.rejects(() => storage.store({ bytes: webpFixture.slice(0, -1), mimeType: 'image/webp' }), /not a valid supported image/u);
  await assert.rejects(
    () => storage.store({ bytes: headerOnlyPngFixture, mimeType: 'image/png' }),
    /not a decodable supported image/u,
  );
  await assert.rejects(
    () => storage.store({ bytes: headerOnlyWebpFixture, mimeType: 'image/webp' }),
    /not a decodable supported image/u,
  );
  await assert.rejects(
    () => storage.store({ bytes: structuralOnlyJpegFixture, mimeType: 'image/jpeg' }),
    /not a decodable supported image/u,
  );
  await assert.rejects(
    () => storage.store({ bytes: animatedWebpFixture, mimeType: 'image/webp' }),
    /not supported/u,
  );
  await assert.rejects(() => storage.store({ bytes: new Uint8Array(), mimeType: 'image/png' }), /cannot be empty/u);
  await assert.rejects(
    () => storage.store({ bytes: new Uint8Array(10 * 1024 * 1024 + 1), mimeType: 'image/png' }),
    /10 MB limit/u,
  );
  await assert.rejects(
    () => storage.store({ bytes: pngFixture, mimeType: 'application/pdf' as 'image/png' }),
    /Unsupported private attachment file type/u,
  );
  assert.deepEqual(await readdir(root), []);
});

test('adapter rejects symlinked directories and repairs permissive directory modes', async (t) => {
  const base = await temporaryRoot(t);
  const target = join(base, 'target');
  const rootLink = join(base, 'root-link');
  await mkdir(target);
  await symlink(target, rootLink, 'dir');
  await assert.rejects(
    () => new LocalPrivateAttachmentStorage(rootLink).store({ bytes: pngFixture, mimeType: 'image/png' }),
    /symlink component|not a real directory/u,
  );

  const root = join(base, 'real-root');
  const outside = join(base, 'outside');
  await mkdir(root, { mode: 0o777 });
  await mkdir(outside);
  await symlink(outside, join(root, 'private-attachments'), 'dir');
  await assert.rejects(
    () => new LocalPrivateAttachmentStorage(root).store({ bytes: pngFixture, mimeType: 'image/png' }),
    /symlink component|not a real directory/u,
  );

  const permissiveRoot = join(base, 'permissive-root');
  const permissiveAttachments = join(permissiveRoot, 'private-attachments');
  await mkdir(permissiveAttachments, { mode: 0o777, recursive: true });
  await chmod(permissiveRoot, 0o777);
  await chmod(permissiveAttachments, 0o777);
  await new LocalPrivateAttachmentStorage(permissiveRoot).store({ bytes: pngFixture, mimeType: 'image/png' });
  assert.equal((await stat(permissiveRoot)).mode & 0o077, 0);
  assert.equal((await stat(permissiveAttachments)).mode & 0o077, 0);
});

test('adapter rejects root/ancestor-link/nested when the ancestor redirects outside the intended root', async (t) => {
  const base = await temporaryRoot(t);
  const intendedRoot = join(base, 'root');
  const outsideRoot = join(base, 'outside');
  await mkdir(intendedRoot);
  await mkdir(outsideRoot);
  await symlink(outsideRoot, join(intendedRoot, 'ancestor-link'), 'dir');
  const configuredRoot = join(intendedRoot, 'ancestor-link', 'nested');

  await assert.rejects(
    () => new LocalPrivateAttachmentStorage(configuredRoot).store({ bytes: pngFixture, mimeType: 'image/png' }),
    /unsafe symlink component/u,
  );
  await assert.rejects(() => lstat(join(outsideRoot, 'nested')), /ENOENT/u);
});

test('read and delete reject symlinked, oversized and invalid storage entries', async (t) => {
  const root = await temporaryRoot(t);
  const directory = join(root, 'private-attachments');
  const target = join(root, 'outside-image');
  await mkdir(directory, { mode: 0o700 });
  await writeFile(target, pngFixture);
  const symlinkId = 'attachment_00000000-0000-4000-8000-000000000001';
  await symlink(target, join(directory, symlinkId));
  const storage = new LocalPrivateAttachmentStorage(root);

  await assert.rejects(() => storage.read(symlinkId), /not a regular file/u);
  await assert.rejects(() => storage.delete(symlinkId), /not a regular file/u);
  assert.equal((await lstat(join(directory, symlinkId))).isSymbolicLink(), true);

  const oversizedId = 'attachment_00000000-0000-4000-8000-000000000002';
  const oversized = await open(join(directory, oversizedId), constants.O_CREAT | constants.O_WRONLY, 0o600);
  await oversized.truncate(10 * 1024 * 1024 + 1);
  await oversized.close();
  await assert.rejects(() => storage.read(oversizedId), /10 MB limit/u);
  await assert.rejects(() => storage.delete(oversizedId), /10 MB limit/u);

  await assert.rejects(() => storage.read('../../passport.png'), /Invalid private attachment storage key/u);
  await assert.rejects(() => storage.delete('/tmp/file'), /Invalid private attachment storage key/u);
  await assert.rejects(
    () => storage.read('attachment_00000000-0000-0000-0000-000000000000'),
    /Invalid private attachment storage key/u,
  );
});

for (const failurePoint of ['write', 'sync', 'close', 'rename'] as const) {
  test(`atomic storage removes temporary and final files after injected ${failurePoint} failure`, async (t) => {
    const root = await temporaryRoot(t);
    const dependencies: LocalAttachmentStorageDependencies = {
      ...defaultDependencies,
      ...(failurePoint === 'write'
        ? { writeFile: async () => { throw new Error('injected write failure'); } }
        : {}),
      ...(failurePoint === 'sync'
        ? { syncFile: async () => { throw new Error('injected sync failure'); } }
        : {}),
      ...(failurePoint === 'close'
        ? {
            closeFile: async (file: FileHandle) => {
              await file.close();
              throw new Error('injected close failure');
            },
          }
        : {}),
      ...(failurePoint === 'rename'
        ? { renameFile: async () => { throw new Error('injected rename failure'); } }
        : {}),
    };
    const storage = new LocalPrivateAttachmentStorage(root, dependencies);

    await assert.rejects(
      () => storage.store({ bytes: pngFixture, mimeType: 'image/png' }),
      new RegExp(`injected ${failurePoint} failure`, 'u'),
    );
    assert.deepEqual(await readdir(join(root, 'private-attachments')), []);
  });
}

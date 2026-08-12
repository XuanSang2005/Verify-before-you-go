export type ClipboardWriter = (value: string) => Promise<boolean | void>;

export async function copySupportValue(
  value: string,
  write: ClipboardWriter,
): Promise<'copied' | 'failed'> {
  try {
    const result = await write(value);
    return result === false ? 'failed' : 'copied';
  } catch {
    return 'failed';
  }
}

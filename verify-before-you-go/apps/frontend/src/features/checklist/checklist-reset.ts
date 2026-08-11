export type ResetConfirmation = () => Promise<boolean>;

export async function runConfirmedChecklistReset(
  confirmReset: ResetConfirmation,
  reset: () => Promise<void> | void,
): Promise<boolean> {
  if (!(await confirmReset())) return false;
  await reset();
  return true;
}

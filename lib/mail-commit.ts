/** Retry the status write after the provider has already accepted the email. */
export async function retryMailedWrite(write: () => Promise<void>, saved: () => Promise<boolean>): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await write();
      return;
    } catch (error) {
      last = error;
      if (await saved().catch(() => false)) return;
    }
  }
  if (last instanceof Error) throw last;
  throw new Error("The database connection timed out.");
}

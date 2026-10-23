/** The seeded Los Angeles home. Reviewer sign-in opens this account and never emails a landlord. */
export const DEMO_EMAIL = "demo@rentright.local";

export function isSampleAccount(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL;
}

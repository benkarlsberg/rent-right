export function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

export function must(form: FormData, name: string, label: string): string {
  const value = field(form, name);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

export function emailValue(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function centsField(form: FormData, name: string): number | null {
  const raw = field(form, name).replace(/[$,]/g, "");
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a dollar amount.");
  return Math.round(amount * 100);
}

export function dateField(form: FormData, name: string): string | null {
  const value = field(form, name);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a real date.");
  return value;
}

export function fileOf(form: FormData, name: string): File | null {
  const value = form.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

export type AddressParts = {
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
};

export function titleCase(value: string): string {
  return value.toLowerCase().replace(/[a-z]+/g, (word, offset: number, whole: string) => {
    const before = offset > 0 ? whole[offset - 1] : "";
    if (/\d/.test(before) && /^(st|nd|rd|th)$/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Display form of a unit. Stored text is left as entered. */
export function displayUnit(unitNumber: string): string {
  const raw = clean(unitNumber);
  if (!raw) return "";
  if (/^(apt|apartment|#)\b/i.test(raw)) return titleCase(raw);
  const stripped = raw.replace(/^(unit\s+)+/i, "").trim();
  if (!stripped) return "";
  return `Unit ${titleCase(stripped)}`;
}

function stateCode(region?: string | null): string {
  const value = clean(region || "");
  if (/^[a-z]{2}$/i.test(value)) return value.toUpperCase();
  return "CA";
}

/** Line 1 is the street and unit. Line 2 is city, state, and ZIP. */
export function formatAddressLines(input: AddressParts): [string, string] {
  const street = titleCase(clean(input.street || ""));
  const unit = displayUnit(input.unit || "");
  const city = titleCase(clean(input.city || ""));
  const zip = clean(input.postalCode || "");
  if (!street && !unit && !city && !zip) return ["", ""];
  const line1 = [street, unit].filter(Boolean).join(", ");
  const stateZip = [stateCode(input.region), zip].filter(Boolean).join(" ");
  const line2 = [city, stateZip].filter(Boolean).join(", ");
  return [line1, line2];
}

export function formatAddressPlain(input: AddressParts): string {
  return formatAddressLines(input).filter(Boolean).join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatAddressHtml(input: AddressParts): string {
  return formatAddressLines(input).filter(Boolean).map(escapeHtml).join("<br>");
}

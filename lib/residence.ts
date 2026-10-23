import "server-only";

import {
  archiveUnit,
  createUnit,
  latestRentCheck,
  linkMovedFrom,
  listDeadlines,
  listLogs,
  listResidences,
  primaryUnit,
  requireUnit,
  saveRentCheck,
  setActiveUnit,
  unitAddress,
  updateDeadlineFacts,
  updateUnit,
  type Unit,
  type UnitInput,
  type User,
} from "@/lib/db";
import { emailValue } from "@/lib/forms";
import { suggestPlace } from "@/lib/geo";
import { parseISODate } from "@/lib/rules/dates";
import { detectPlace, placeSummary, type PlaceDetection } from "@/lib/rules/detect";
import {
  checkRentIncrease,
  depositReturnDeadline,
  repairReminder,
  threeDayNoticeDeadline,
  type Jurisdiction,
  type RentIncreaseInput,
  type RepairSeverity,
  type RsoStatus,
  type RstpoTier,
} from "@/lib/rules/engine";
import { relayAddress, tx } from "@/lib/text";

const SEVERITIES = new Set<RepairSeverity>(["no_heat", "no_water", "no_electricity", "gas_leak", "leak", "mold", "pests", "other"]);

const LAWS_CHANGE_EN = "This changes which local laws apply";

export type ResidenceLabels = {
  title: string;
  intro: string;
  homes: string;
  active: string;
  archived: string;
  show: string;
  street: string;
  unit: string;
  city: string;
  zip: string;
  landlordName: string;
  landlordEmail: string;
  rent: string;
  leaseStart: string;
  leaseEnd: string;
  check: string;
  useAddress: string;
  checked: string;
  typo: string;
  move: string;
  lawsChange: string;
  lawsSame: string;
  acknowledge: string;
  saveDetails: string;
  saveTypo: string;
  saveMove: string;
  nothingSent: string;
  relayLabel: string;
  relayKeep: string;
  relayNew: string;
  archivedNote: string;
  export: string;
};

export function residenceLabels(locale: User["locale"]): ResidenceLabels {
  return {
    title: tx(locale, "Residence", "Vivienda"),
    intro: tx(
      locale,
      "Update this home. Nothing is emailed unless you later confirm a message.",
      "Actualice esta vivienda. No se envía ningún correo a menos que después confirme un mensaje.",
    ),
    homes: tx(locale, "Your homes", "Sus viviendas"),
    active: tx(locale, "Active", "Activa"),
    archived: tx(locale, "Archived", "Archivada"),
    show: tx(locale, "Show this home", "Ver esta vivienda"),
    street: tx(locale, "Street", "Calle"),
    unit: tx(locale, "Unit", "Unidad"),
    city: tx(locale, "City", "Ciudad"),
    zip: tx(locale, "ZIP", "Código postal"),
    landlordName: tx(locale, "Landlord name", "Nombre del propietario"),
    landlordEmail: tx(locale, "Landlord email", "Correo del propietario"),
    rent: tx(locale, "Monthly rent", "Renta mensual"),
    leaseStart: tx(locale, "Lease start", "Inicio del contrato"),
    leaseEnd: tx(locale, "Lease end", "Fin del contrato"),
    check: tx(locale, "Check this address", "Revisar esta dirección"),
    useAddress: tx(locale, "Use this address", "Usar esta dirección"),
    checked: tx(locale, "Checked", "Revisada"),
    typo: tx(locale, "Fix a typo in this address", "Corregir un error en esta dirección"),
    move: tx(locale, "I moved to a new home", "Me mudé a una vivienda nueva"),
    lawsChange: tx(locale, LAWS_CHANGE_EN, "Esto cambia qué leyes locales aplican"),
    lawsSame: tx(locale, "Local laws stay the same for this address.", "Las leyes locales siguen siendo las mismas para esta dirección."),
    acknowledge: tx(locale, "I understand", "Entiendo"),
    saveDetails: tx(locale, "Save these details", "Guardar estos datos"),
    saveTypo: tx(locale, "Save the correction", "Guardar la corrección"),
    saveMove: tx(locale, "Archive this home and start the new one", "Archivar esta vivienda y empezar la nueva"),
    nothingSent: tx(locale, "Nothing was emailed.", "No se envió ningún correo."),
    relayLabel: tx(locale, "Unit email", "Correo de la unidad"),
    relayKeep: tx(locale, "A correction keeps this address.", "Una corrección conserva esta dirección."),
    relayNew: tx(locale, "A move gets a new unit email. The old one stays with the archived home.", "Una mudanza recibe un correo de unidad nuevo. El anterior se queda con la vivienda archivada."),
    archivedNote: tx(
      locale,
      "This home is archived. Records, messages, and evidence stay here and can be exported. Nothing new can be sent.",
      "Esta vivienda está archivada. Los registros, mensajes y pruebas se quedan aquí y se pueden exportar. No se puede enviar nada nuevo.",
    ),
    export: tx(locale, "Export evidence", "Exportar pruebas"),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dollars(value: unknown, locale: User["locale"]): number | null {
  if (value == null || value === "") return null;
  const amount = Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) throw new Error(tx(locale, "Enter a dollar amount.", "Escriba un monto en dólares."));
  return Math.round(amount * 100);
}

function dateOrNull(value: unknown, locale: User["locale"]): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(tx(locale, "Use a real date.", "Use una fecha real."));
  try {
    parseISODate(raw);
  } catch {
    throw new Error(tx(locale, "Use a real date.", "Use una fecha real."));
  }
  return raw;
}

function dollarText(cents: number | null): string {
  if (cents == null) return "";
  const amount = cents / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function sameAddress(unit: Unit, fields: { street: string; unitNumber: string; city: string; postalCode: string }): boolean {
  return norm(unit.street) === norm(fields.street)
    && norm(unit.unitNumber) === norm(fields.unitNumber)
    && norm(unit.city) === norm(fields.city)
    && unit.postalCode.trim() === fields.postalCode.trim();
}

function readFields(unit: Unit, body: Record<string, unknown>, locale: User["locale"]) {
  const street = text(body.street);
  const city = text(body.city);
  const postalCode = text(body.postalCode);
  const landlordName = text(body.landlordName);
  const landlordEmail = text(body.landlordEmail);
  if (!street || !city || !postalCode) throw new Error(tx(locale, "Add the street, city, and ZIP.", "Agregue calle, ciudad y código postal."));
  if (!landlordName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(landlordEmail)) {
    throw new Error(tx(locale, "Add the landlord's name and email.", "Agregue el nombre y el correo del propietario."));
  }
  return {
    street,
    unitNumber: text(body.unitNumber),
    city,
    postalCode,
    region: text(body.region) || unit.region || "CA",
    landlordName,
    landlordEmail: emailValue(landlordEmail),
    rentCents: dollars(body.rent, locale),
    moveInDate: dateOrNull(body.moveInDate, locale),
    leaseEndDate: dateOrNull(body.leaseEndDate, locale),
  };
}

function placeFor(fields: { street: string; city: string; postalCode: string; region: string }): PlaceDetection {
  return detectPlace({ address: fields.street, city: fields.city, postalCode: fields.postalCode, region: fields.region });
}

export function archivedNote(unit: Unit | null, locale: User["locale"]): string | null {
  if (!unit?.archivedAt) return null;
  return residenceLabels(locale).archivedNote;
}

export async function residencePayload(user: User) {
  const locale = user.locale;
  const labels = residenceLabels(locale);
  const homes = await listResidences(user.id);
  const selected = await primaryUnit(user.id);
  if (!selected) {
    return { home: null, homes: [], labels, archivedNote: null };
  }
  const place = placeFor(selected);
  return {
    home: {
      id: selected.id,
      street: selected.street,
      unitNumber: selected.unitNumber,
      city: selected.city,
      postalCode: selected.postalCode,
      region: selected.region,
      landlordName: selected.landlordName,
      landlordEmail: selected.landlordEmail,
      rent: dollarText(selected.rentCents),
      moveInDate: selected.moveInDate || "",
      leaseEndDate: selected.leaseEndDate || "",
      relay: relayAddress(selected.relayLocal),
      jurisdiction: selected.jurisdiction,
      summary: placeSummary(place, locale),
      archived: Boolean(selected.archivedAt),
      canEdit: selected.role === "owner" && !selected.archivedAt,
    },
    homes: homes.map((item) => ({
      id: item.id,
      address: unitAddress(item),
      archived: Boolean(item.archivedAt),
      selected: item.id === selected.id,
      status: item.archivedAt ? labels.archived : labels.active,
    })),
    labels,
    archivedNote: archivedNote(selected, locale),
  };
}

export async function previewResidence(user: User, body: Record<string, unknown>) {
  const locale = user.locale;
  const labels = residenceLabels(locale);
  const unit = await primaryUnit(user.id);
  if (!unit) throw new Error(tx(locale, "Add your unit first.", "Agregue su vivienda primero."));
  const fields = readFields(unit, body, locale);
  const found = await suggestPlace([fields.street, fields.city, fields.region, fields.postalCode].join(", "));
  const place = found.place.inCalifornia ? found.place : placeFor(fields);
  if (!place.inCalifornia) {
    throw new Error(placeSummary(place, locale));
  }
  const changed = !sameAddress(unit, fields);
  const lawsChange = changed && place.jurisdiction !== unit.jurisdiction;
  return {
    inCalifornia: true,
    summary: placeSummary(place, locale),
    suggestion: found.suggestion,
    jurisdiction: place.jurisdiction,
    lawsChange,
    addressChanged: changed,
    warning: !changed ? "" : lawsChange ? labels.lawsChange : labels.lawsSame,
  };
}

function inputFor(unit: Unit, fields: ReturnType<typeof readFields>, place: PlaceDetection, mode: "typo" | "move" | "details", changed: boolean): UnitInput {
  const moving = mode === "move";
  const redetect = moving || (mode === "typo" && changed);
  return {
    street: fields.street,
    unitNumber: fields.unitNumber,
    city: fields.city,
    postalCode: fields.postalCode,
    region: fields.region,
    jurisdiction: redetect ? place.jurisdiction : unit.jurisdiction,
    jurisdictionConfirmed: true,
    rsoStatus: (moving ? "unsure" : unit.rsoStatus) as RsoStatus,
    rstpoTier: (moving ? "unsure" : unit.rstpoTier) as RstpoTier,
    landlordName: fields.landlordName,
    landlordEmail: fields.landlordEmail,
    landlordPhone: moving ? "" : unit.landlordPhone,
    rentCents: fields.rentCents,
    depositCents: moving ? null : unit.depositCents,
    moveInDate: fields.moveInDate,
    leaseEndDate: fields.leaseEndDate,
  };
}

async function refreshOpenDeadlines(userId: string, unitId: string) {
  const deadlines = await listDeadlines(userId, unitId);
  const logs = await listLogs(userId, unitId);
  for (const item of deadlines) {
    if (item.status !== "open" || item.kind === "custom_reminder") continue;
    let next: { ruleId: string; dueDate: string | null; explanation: string; explanationEs: string; computation: string; unsure: boolean } | null = null;
    if (item.kind === "repair") {
      const log = logs.find((entry) => entry.id === item.sourceId);
      const severity = log?.severity;
      const anchor = (log?.eventDate ? String(log.eventDate).slice(0, 10) : null) || item.anchorDate;
      if (severity && anchor && SEVERITIES.has(severity as RepairSeverity)) {
        next = repairReminder(anchor, severity as RepairSeverity);
      }
    } else if (item.kind === "deposit" && item.anchorDate) {
      next = depositReturnDeadline(item.anchorDate);
    } else if (item.kind === "notice_3day" && item.anchorDate) {
      next = threeDayNoticeDeadline(item.anchorDate);
    }
    if (!next) continue;
    if (!next.dueDate && item.dueDate) continue;
    try {
      await updateDeadlineFacts(item.id, next);
    } catch {
      continue;
    }
  }
}

function numberish(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const amount = Number(value.replace(/[$,]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) return null;
    return Math.round(amount);
  }
  return null;
}

async function refreshRentCheck(user: User, unit: Unit) {
  const saved = await latestRentCheck(user.id, unit.id);
  if (!saved || !saved.input || typeof saved.input !== "object") return;
  const raw = saved.input as Record<string, unknown>;
  const lowest = numberish(raw.lowestRentCents) ?? (raw.lowest != null ? numberish(Number(String(raw.lowest).replace(/[$,]/g, "")) * 100) : null);
  const proposed = numberish(raw.proposedRentCents) ?? (raw.proposed != null ? numberish(Number(String(raw.proposed).replace(/[$,]/g, "")) * 100) : null);
  const effectiveDate = text(raw.effectiveDate);
  if (lowest == null || proposed == null || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return;
  const place = placeFor(unit);
  const statewide = unit.jurisdiction === "ca" || unit.jurisdiction === "other_ca";
  const input: RentIncreaseInput = {
    jurisdiction: unit.jurisdiction as Jurisdiction,
    rsoStatus: unit.rsoStatus,
    rstpoTier: unit.rstpoTier,
    countyArea: statewide ? place.area ?? undefined : undefined,
    localOrdinanceName: statewide ? place.localOrdinance?.name ?? null : null,
    lowestRentCents: lowest,
    proposedRentCents: proposed,
    noticeDate: /^\d{4}-\d{2}-\d{2}$/.test(text(raw.noticeDate)) ? text(raw.noticeDate) : effectiveDate,
    effectiveDate,
    lastIncreaseDate: /^\d{4}-\d{2}-\d{2}$/.test(text(raw.lastIncreaseDate)) ? text(raw.lastIncreaseDate) : null,
    claimsExemption: raw.claimsExemption === true,
  };
  try {
    await saveRentCheck(user.id, unit.id, { ...raw, jurisdiction: unit.jurisdiction, recomputed: true }, checkRentIncrease(input));
  } catch {
    return;
  }
}

export async function saveResidence(user: User, body: Record<string, unknown>) {
  const locale = user.locale;
  const labels = residenceLabels(locale);
  const unit = await primaryUnit(user.id);
  if (!unit) throw new Error(tx(locale, "Add your unit first.", "Agregue su vivienda primero."));
  if (unit.role !== "owner") throw new Error(tx(locale, "Only the person who added the home can edit it.", "Solo quien agregó la vivienda puede editarla."));
  const mode = text(body.mode);
  if (mode !== "typo" && mode !== "move" && mode !== "details") {
    throw new Error(tx(locale, "Choose whether this is a typo or a move.", "Elija si es un error o una mudanza."));
  }
  const fields = readFields(unit, body, locale);
  const changed = !sameAddress(unit, fields);
  if (mode === "details" && changed) throw new Error(tx(locale, "Choose whether this is a typo or a move.", "Elija si es un error o una mudanza."));
  if (mode === "move" && !changed) throw new Error(tx(locale, "Enter the new home's address.", "Escriba la dirección de la vivienda nueva."));
  if (mode !== "move" && unit.archivedAt) {
    throw new Error(labels.archivedNote);
  }
  const place = placeFor(fields);
  if ((mode === "typo" || mode === "move") && changed && !place.inCalifornia) throw new Error(placeSummary(place, locale));
  const lawsChange = changed && place.jurisdiction !== unit.jurisdiction;
  if (lawsChange && body.acknowledged !== true) {
    throw new Error(`${labels.lawsChange} ${placeSummary(place, locale)}`);
  }
  if (mode === "move") {
    const created = await createUnit(user.id, inputFor(unit, fields, place, "move", true));
    await linkMovedFrom(created.id, unit.id);
    if (!unit.archivedAt) await archiveUnit(unit.id);
    return { note: labels.nothingSent, unit: created };
  }
  const saved = await updateUnit(user.id, unit.id, inputFor(unit, fields, place, mode === "typo" ? "typo" : "details", changed));
  if (mode === "typo" && changed) {
    await refreshOpenDeadlines(user.id, saved.id);
    await refreshRentCheck(user, saved);
  }
  return { note: labels.nothingSent, unit: await requireUnit(user.id, saved.id) };
}

export async function selectResidence(user: User, id: string) {
  if (!id) throw new Error(tx(user.locale, "Choose a home.", "Elija una vivienda."));
  await setActiveUnit(user.id, id);
}

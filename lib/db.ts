import "server-only";
import { randomUUID } from "crypto";
import { decryptString, encryptString, hashToken, randomToken, shortCode } from "@/lib/crypto";
import { all, dropRequestMemo, hasUserActor, one, requestMemo, run, withActor } from "@/lib/pg";
import { deleteSupabaseAuthUser, sendSupabaseMagicLink, supabaseAuthConfigured, userFromSupabaseOtp } from "@/lib/supabase-auth";
import type { Locale } from "@/lib/disclaimer";
import type { LeaseReview } from "@/lib/lease/review";
import type { AssistantAnswer } from "@/lib/rules/assistant";
import type { Jurisdiction, RentIncreaseResult, RsoStatus, RstpoTier } from "@/lib/rules/engine";
import { deleteBlob, getBlob, putBlob } from "@/lib/storage";
import { chainHash, GENESIS_HASH, sha256 } from "@/lib/hash";

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  if (value == null) return fallback;
  return value as T;
}

function isOn(value: unknown): boolean {
  return value === true || value === 1;
}

export class HttpError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type User = {
  id: string;
  email: string;
  name: string;
  locale: Locale;
  lowBandwidth: boolean;
  phone: string;
  createdAt: string;
};

export type Unit = {
  id: string;
  createdBy: string;
  street: string;
  unitNumber: string;
  city: string;
  postalCode: string;
  region: string;
  jurisdiction: Jurisdiction;
  jurisdictionConfirmed: boolean;
  rsoStatus: RsoStatus;
  rstpoTier: RstpoTier;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  relayLocal: string;
  rentCents: number | null;
  depositCents: number | null;
  moveInDate: string | null;
  leaseEndDate: string | null;
  archivedAt: string | null;
  movedFromUnitId: string | null;
  createdAt: string;
  role: "owner" | "roommate";
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  locale: string;
  low_bandwidth: number;
  phone: string;
  created_at: string;
};

type UnitRow = {
  id: string;
  created_by: string;
  street: string;
  unit_number: string;
  city: string;
  postal_code: string;
  region: string;
  jurisdiction: string;
  jurisdiction_confirmed: number;
  rso_status: string;
  rstpo_tier: string;
  landlord_name: string;
  landlord_email: string;
  landlord_phone: string;
  relay_local: string;
  rent_cents: number | null;
  deposit_cents: number | null;
  move_in_date: string | null;
  lease_end_date: string | null;
  archived_at: string | null;
  moved_from_unit_id: string | null;
  created_at: string;
  role?: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    locale: row.locale === "es" ? "es" : "en",
    lowBandwidth: isOn(row.low_bandwidth),
    phone: row.phone || "",
    createdAt: row.created_at,
  };
}

function mapUnit(row: UnitRow, role: "owner" | "roommate"): Unit {
  return {
    id: row.id,
    createdBy: row.created_by,
    street: row.street,
    unitNumber: row.unit_number,
    city: row.city,
    postalCode: row.postal_code,
    region: row.region,
    jurisdiction: row.jurisdiction as Jurisdiction,
    jurisdictionConfirmed: isOn(row.jurisdiction_confirmed),
    rsoStatus: (row.rso_status as RsoStatus) || "unsure",
    rstpoTier: (row.rstpo_tier as RstpoTier) || "unsure",
    landlordName: row.landlord_name,
    landlordEmail: row.landlord_email,
    landlordPhone: row.landlord_phone,
    relayLocal: row.relay_local,
    rentCents: row.rent_cents,
    depositCents: row.deposit_cents,
    moveInDate: dateText(row.move_in_date),
    leaseEndDate: dateText(row.lease_end_date),
    archivedAt: timeText(row.archived_at),
    movedFromUnitId: row.moved_from_unit_id,
    createdAt: row.created_at,
    role,
  };
}

export function unitLabel(unitNumber: string): string {
  const raw = unitNumber.trim().replace(/\s+/g, " ");
  if (!raw) return "";
  if (/^(apt|apartment|#)\b/i.test(raw)) return raw;
  const stripped = raw.replace(/^(unit\s+)+/i, "").trim();
  if (!stripped) return "";
  return `Unit ${stripped}`;
}

export function unitAddress(unit: Unit): string {
  return [unit.street, unitLabel(unit.unitNumber), unit.city, "CA", unit.postalCode]
    .filter(Boolean)
    .join(", ")
    .replace(", CA,", " CA");
}

export async function getUser(id: string) {
  const row = await one<UserRow>("select * from profiles where id = ?", [id]);
  return row ? mapUser(row) : null;
}

export async function createNamedUser(email: string, name: string, locale: Locale = "en"): Promise<User> {
  if (hasUserActor()) return withActor(null, () => createNamedUser(email, name, locale));
  const id = randomUUID();
  const normalized = email.toLowerCase();
  const now = new Date().toISOString();
  await run(
    "insert into auth.users (id, email, role, aud, email_confirmed_at) values (?, ?, 'authenticated', 'authenticated', now())",
    [id, normalized],
  );
  await run(
    `insert into profiles (id, email, name, locale, phone, created_at) values (?, ?, ?, ?, '', ?)
     on conflict (id) do update set name = excluded.name, locale = excluded.locale, email = excluded.email`,
    [id, normalized, name, locale, now],
  );
  const user = await getUser(id);
  if (!user) throw new HttpError("Could not create the account.");
  return user;
}

export async function getUserByEmail(email: string) {
  const row = await one<UserRow>("select * from profiles where email = ?", [email.toLowerCase()]);
  return row ? mapUser(row) : null;
}

export async function createMagicLink(email: string): Promise<{ token: string; supabase: boolean }> {
  if (hasUserActor()) return withActor(null, () => createMagicLink(email));
  const normalized = email.toLowerCase().trim();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await one<{ n: number }>("select count(*)::int as n from magic_links where email = ? and created_at > ?", [normalized, since]);
  if ((recent?.n || 0) >= 5) throw new HttpError("Too many sign-in emails. Wait an hour and try again.");
  const code = shortCode();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  if (supabaseAuthConfigured()) {
    const provider = await sendSupabaseMagicLink(normalized);
    if (!provider) return { token: "", supabase: true };
    await run(
      "insert into magic_links (id, email, token_hash, provider_token, provider_hash, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), normalized, hashToken(code), encryptString(provider), hashToken(provider), expires, now],
    );
    return { token: code, supabase: true };
  }
  await run(
    "insert into magic_links (id, email, token_hash, provider_token, provider_hash, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?)",
    [randomUUID(), normalized, hashToken(code), null, null, expires, now],
  );
  return { token: code, supabase: false };
}

/** Counts tries for the reviewer address only. The inserted row cannot be used as a sign-in link. */
export async function reviewerAttemptOpen(email: string): Promise<boolean> {
  if (hasUserActor()) return withActor(null, () => reviewerAttemptOpen(email));
  const normalized = email.toLowerCase().trim();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await one<{ n: number }>("select count(*)::int as n from magic_links where email = ? and created_at > ?", [normalized, since]);
  if ((recent?.n || 0) >= 8) return false;
  const now = new Date().toISOString();
  await run(
    "insert into magic_links (id, email, token_hash, provider_token, provider_hash, expires_at, used_at, created_at) values (?, ?, ?, null, null, ?, ?, ?)",
    [randomUUID(), normalized, hashToken(randomToken(24)), now, now, now],
  );
  return true;
}

export async function consumeMagicLink(token: string): Promise<User> {
  if (hasUserActor()) return withActor(null, () => consumeMagicLink(token));
  const hashed = hashToken(token);
  const row = await one<{ id: string; email: string; expires_at: string; used_at: string | null; provider_token: string | null }>(
    "select * from magic_links where token_hash = ? or provider_hash = ?",
    [hashed, hashed],
  );
  if (!row) {
    if (supabaseAuthConfigured()) {
      const remote = await userFromSupabaseOtp(token);
      if (remote) return await profileForAuthUser(remote.id, remote.email);
    }
    throw new HttpError("That sign-in link is invalid or expired.");
  }
  if (row.used_at || row.expires_at < new Date().toISOString()) {
    throw new HttpError("That sign-in link is invalid or expired.");
  }
  const claimed = await run("update magic_links set used_at = ? where id = ? and used_at is null", [new Date().toISOString(), row.id]);
  if (!claimed.changes) throw new HttpError("That sign-in link is invalid or expired.");
  if (row.provider_token) {
    let provider = "";
    try {
      provider = decryptString(row.provider_token);
    } catch {
      throw new HttpError("That sign-in link is invalid or expired.");
    }
    const remote = await userFromSupabaseOtp(provider);
    if (!remote) throw new HttpError("That sign-in link is invalid or expired.");
    return await profileForAuthUser(remote.id, remote.email);
  }
  const existing = await getUserByEmail(row.email);
  if (existing) return existing;
  const id = randomUUID();
  await run(
    "insert into auth.users (id, email, role, aud, email_confirmed_at) values (?, ?, 'authenticated', 'authenticated', now())",
    [id, row.email],
  );
  return await profileForAuthUser(id, row.email);
}

export async function profileForAuthUser(id: string, email: string) {
  const existing = await getUser(id);
  if (existing) return existing;
  const sameEmail = await getUserByEmail(email);
  if (sameEmail) return sameEmail;
  const now = new Date().toISOString();
  await run(
    "insert into auth.users (id, email, role, aud, email_confirmed_at) values (?, ?, 'authenticated', 'authenticated', now()) on conflict (id) do nothing",
    [id, email.toLowerCase()],
  );
  await run(
    `insert into profiles (id, email, name, locale, phone, created_at) values (?, ?, '', 'en', '', ?)
     on conflict (id) do update set email = excluded.email`,
    [id, email.toLowerCase(), now],
  );
  const created = await getUser(id);
  if (!created) throw new HttpError("Could not create the account.");
  return created;
}

export async function updateUser(id: string, patch: Partial<Pick<User, "name" | "locale" | "lowBandwidth" | "phone">>) {
  const current = await getUser(id);
  if (!current) throw new HttpError("Account not found.");
  await run("update profiles set name = ?, locale = ?, low_bandwidth = ?, phone = ? where id = ?", [
    patch.name ?? current.name,
    patch.locale ?? current.locale,
    Boolean(patch.lowBandwidth ?? current.lowBandwidth),
    patch.phone ?? current.phone,
    id,
  ]);
}

export async function membership(userId: string, unitId: string) {
  const row = await one<{ role: string }>("select role from unit_members where user_id = ? and unit_id = ?", [userId, unitId]);
  if (!row) return null;
  return row.role === "owner" ? "owner" : "roommate";
}

export async function requireUnit(userId: string, unitId: string) {
  return requestMemo(`unit:${userId}:${unitId}`, async () => {
    const role = await membership(userId, unitId);
    if (!role) throw new HttpError("You do not have access to that unit.");
    const row = await one<UnitRow>("select * from units where id = ?", [unitId]);
    if (!row) throw new HttpError("Unit not found.");
    return mapUnit(row, role);
  });
}

export async function peekUnit(id: string) {
  const row = await one<UnitRow>("select * from units where id = ?", [id]);
  return row ? mapUnit(row, "owner") : null;
}

export async function primaryUnit(userId: string) {
  const row = await one<UnitRow & { role: string }>(
    `select u.*, m.role as role from units u
     join unit_members m on m.unit_id = u.id
     where m.user_id = ?
     order by (u.id = (select p.active_unit_id from profiles p where p.id = ?)) desc,
              (u.archived_at is null) desc,
              m.created_at desc
     limit 1`,
    [userId, userId],
  );
  if (!row) return null;
  return mapUnit(row, row.role === "owner" ? "owner" : "roommate");
}

export async function listResidences(userId: string): Promise<Unit[]> {
  const rows = await all<UnitRow & { role: string }>(
    `select u.*, m.role as role from units u
     join unit_members m on m.unit_id = u.id
     where m.user_id = ?
     order by (u.archived_at is null) desc, u.created_at desc`,
    [userId],
  );
  return rows.map((row) => mapUnit(row, row.role === "owner" ? "owner" : "roommate"));
}

export function assertWritable(unit: Unit, locale: Locale = "en"): void {
  if (!unit.archivedAt) return;
  throw new HttpError(
    locale === "es"
      ? "Esta vivienda está archivada. Los registros se quedan, y no se puede guardar ni enviar nada nuevo."
      : "This home is archived. Records stay, and nothing new can be saved or sent.",
  );
}

async function requireWritable(userId: string, unitId: string) {
  const unit = await requireUnit(userId, unitId);
  const user = await getUser(userId);
  assertWritable(unit, user?.locale === "es" ? "es" : "en");
  return unit;
}

export async function setActiveUnit(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  await run("update profiles set active_unit_id = ? where id = ?", [unitId, userId]);
}

export async function archiveUnit(unitId: string) {
  await run("update units set archived_at = ? where id = ? and archived_at is null", [new Date().toISOString(), unitId]);
}

export async function linkMovedFrom(unitId: string, fromUnitId: string) {
  await run("update units set moved_from_unit_id = ? where id = ?", [fromUnitId, unitId]);
}

export type UnitInput = {
  street: string;
  unitNumber: string;
  city: string;
  postalCode: string;
  region: string;
  jurisdiction: Jurisdiction;
  jurisdictionConfirmed: boolean;
  rsoStatus: RsoStatus;
  rstpoTier: RstpoTier;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  rentCents: number | null;
  depositCents: number | null;
  moveInDate: string | null;
  leaseEndDate: string | null;
};

export async function createUnit(userId: string, input: UnitInput) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const relay = `u-${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
  await run(
    `insert into units (
      id, created_by, street, unit_number, city, postal_code, region, jurisdiction, jurisdiction_confirmed,
      rso_status, rstpo_tier, landlord_name, landlord_email, landlord_phone, relay_local,
      rent_cents, deposit_cents, move_in_date, lease_end_date, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, input.street, input.unitNumber, input.city, input.postalCode, input.region, input.jurisdiction,
      input.jurisdictionConfirmed, input.rsoStatus, input.rstpoTier, input.landlordName, input.landlordEmail,
      input.landlordPhone, relay, input.rentCents, input.depositCents, input.moveInDate, input.leaseEndDate, now,
    ],
  );
  await run("insert into unit_members (unit_id, user_id, role, created_at) values (?, ?, 'owner', ?)", [id, userId, now]);
  await run("update profiles set active_unit_id = ? where id = ?", [id, userId]);
  return await requireUnit(userId, id);
}

export async function updateUnit(userId: string, unitId: string, input: UnitInput) {
  const unit = await requireWritable(userId, unitId);
  if (unit.role !== "owner") throw new HttpError("Only the person who added the unit can edit the landlord and address.");
  await run(
    `update units set street=?, unit_number=?, city=?, postal_code=?, region=?, jurisdiction=?, jurisdiction_confirmed=?,
     rso_status=?, rstpo_tier=?, landlord_name=?, landlord_email=?, landlord_phone=?, rent_cents=?, deposit_cents=?, move_in_date=?, lease_end_date=?
     where id=?`,
    [
      input.street, input.unitNumber, input.city, input.postalCode, input.region, input.jurisdiction,
      input.jurisdictionConfirmed, input.rsoStatus, input.rstpoTier, input.landlordName, input.landlordEmail,
      input.landlordPhone, input.rentCents, input.depositCents, input.moveInDate, input.leaseEndDate, unitId,
    ],
  );
  dropRequestMemo(`unit:${userId}:${unitId}`);
  return await requireUnit(userId, unitId);
}

export type LogEntry = {
  id: string;
  unitId: string;
  userId: string;
  versionGroup: string;
  version: number;
  revisesId: string | null;
  type: string;
  noticeKind: string | null;
  severity: string | null;
  room: string | null;
  description: string;
  flags: Record<string, unknown>;
  photoFileId: string | null;
  prevHash: string;
  contentHash: string;
  eventDate: string;
  createdAt: string;
  status: string;
  resolvedAt: string | null;
  resolvedBy: "tenant" | "landlord" | null;
  resolutionNote: string | null;
};

type LogRow = {
  id: string;
  unit_id: string;
  user_id: string;
  version_group: string;
  version: number;
  revises_id: string | null;
  type: string;
  notice_kind: string | null;
  severity: string | null;
  room: string | null;
  description: string;
  flags: string;
  photo_file_id: string | null;
  prev_hash: string;
  content_hash: string;
  event_date: string;
  created_at: string;
  status: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
};

function mapLog(row: LogRow): LogEntry {
  return {
    id: row.id,
    unitId: row.unit_id,
    userId: row.user_id,
    versionGroup: row.version_group,
    version: row.version,
    revisesId: row.revises_id,
    type: row.type,
    noticeKind: row.notice_kind,
    severity: row.severity,
    room: row.room,
    description: row.description,
    flags: parseJson<Record<string, unknown>>(row.flags, {}),
    photoFileId: row.photo_file_id,
    prevHash: row.prev_hash,
    contentHash: row.content_hash,
    eventDate: dateText(row.event_date) || "",
    createdAt: timeText(row.created_at) || new Date().toISOString(),
    status: row.status || "open",
    resolvedAt: timeText(row.resolved_at),
    resolvedBy: row.resolved_by === "tenant" || row.resolved_by === "landlord" ? row.resolved_by : null,
    resolutionNote: row.resolution_note || null,
  };
}

export async function listLogs(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  const rows = await all<LogRow>(
    `select * from log_entries e where unit_id = ? and version = (
      select max(version) from log_entries where version_group = e.version_group
    ) order by event_date desc, created_at desc`,
    [unitId],
  );
  return rows.map(mapLog);
}

export async function listLogHistory(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  return (await all<LogRow>("select * from log_entries where unit_id = ? order by created_at asc", [unitId])).map(mapLog);
}

export async function getLog(userId: string, id: string) {
  const row = await one<LogRow>("select * from log_entries where id = ?", [id]);
  if (!row) throw new HttpError("Log entry not found.");
  await requireUnit(userId, row.unit_id);
  return mapLog(row);
}

export async function insertLog(input: {
  unitId: string;
  userId: string;
  type: string;
  noticeKind?: string | null;
  severity?: string | null;
  room?: string | null;
  description: string;
  flags?: Record<string, unknown>;
  photoFileId?: string | null;
  eventDate: string;
  createdAt?: string;
  versionGroup?: string;
  version?: number;
  revisesId?: string | null;
}) {
  await requireWritable(input.userId, input.unitId);
  const id = randomUUID();
  const createdAt = input.createdAt || new Date().toISOString();
  const prev = await one<{ content_hash: string }>(
    "select content_hash from log_entries where unit_id = ? order by created_at desc limit 1",
    [input.unitId],
  );
  const versionGroup = input.versionGroup || id;
  const version = input.version || 1;
  const payload = {
    id,
    unitId: input.unitId,
    type: input.type,
    noticeKind: input.noticeKind || null,
    severity: input.severity || null,
    room: input.room || null,
    description: input.description,
    flags: input.flags || {},
    eventDate: input.eventDate,
    version,
    createdAt,
  };
  const contentHash = chainHash(prev?.content_hash || GENESIS_HASH, payload);
  await run(
    `insert into log_entries (
      id, unit_id, user_id, version_group, version, revises_id, type, notice_kind, severity, room,
      description, flags, photo_file_id, prev_hash, content_hash, event_date, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.unitId, input.userId, versionGroup, version, input.revisesId || null, input.type,
      input.noticeKind || null, input.severity || null, input.room || null, input.description,
      JSON.stringify(input.flags || {}), input.photoFileId || null, prev?.content_hash || GENESIS_HASH,
      contentHash, input.eventDate, createdAt,
    ],
  );
  return await getLog(input.userId, id);
}

export type Message = {
  id: string;
  unitId: string;
  userId: string | null;
  logEntryId: string | null;
  direction: string;
  fromEmail: string;
  toEmail: string;
  ccEmail: string | null;
  subject: string;
  body: string;
  deliveryStatus: string;
  deliveryDetail: string | null;
  openIndicative: boolean;
  providerId: string | null;
  responseToken: string | null;
  createdAt: string;
  statusAt: string;
};

type MessageRow = {
  id: string;
  unit_id: string;
  user_id: string | null;
  log_entry_id: string | null;
  direction: string;
  from_email: string;
  to_email: string;
  cc_email: string | null;
  subject: string;
  body_enc: string;
  delivery_status: string;
  delivery_detail: string | null;
  open_indicative: number;
  provider_id: string | null;
  response_token: string | null;
  created_at: string;
  status_at: string;
};

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    unitId: row.unit_id,
    userId: row.user_id,
    logEntryId: row.log_entry_id,
    direction: row.direction,
    fromEmail: row.from_email,
    toEmail: row.to_email,
    ccEmail: row.cc_email,
    subject: row.subject,
    body: decryptString(row.body_enc),
    deliveryStatus: row.delivery_status,
    deliveryDetail: row.delivery_detail,
    openIndicative: isOn(row.open_indicative),
    providerId: row.provider_id,
    responseToken: row.response_token,
    createdAt: row.created_at,
    statusAt: row.status_at,
  };
}

export async function listMessages(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  return (await all<MessageRow>("select * from messages where unit_id = ? order by created_at asc", [unitId])).map(mapMessage);
}

export async function countOutboundSince(unitId: string, sinceIso: string) {
  const row = await one<{ n: number }>(
    "select count(*)::int as n from messages where unit_id = ? and direction = 'outbound' and created_at > ?",
    [unitId, sinceIso],
  );
  return row?.n || 0;
}

export async function isBlocked(unitId: string) {
  return Boolean(await one("select unit_id from landlord_blocks where unit_id = ?", [unitId]));
}

export async function insertMessage(input: {
  unitId: string;
  userId: string | null;
  logEntryId?: string | null;
  direction: "outbound" | "inbound";
  fromEmail: string;
  toEmail: string;
  ccEmail?: string | null;
  subject: string;
  body: string;
  deliveryStatus: string;
  deliveryDetail?: string | null;
  providerId?: string | null;
  responseToken?: string | null;
  createdAt?: string;
}) {
  const id = randomUUID();
  const now = input.createdAt || new Date().toISOString();
  await run(
    `insert into messages (
      id, unit_id, user_id, log_entry_id, direction, from_email, to_email, cc_email, subject, body_enc,
      delivery_status, delivery_detail, provider_id, response_token, created_at, status_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.unitId, input.userId, input.logEntryId || null, input.direction, input.fromEmail, input.toEmail,
      input.ccEmail || null, input.subject, encryptString(input.body), input.deliveryStatus, input.deliveryDetail || null,
      input.providerId || null, input.responseToken || null, now, now,
    ],
  );
  const row = await one<MessageRow>("select * from messages where id = ?", [id]);
  if (!row) throw new HttpError("Message was not saved.");
  return mapMessage(row);
}

export async function updateMessageStatus(providerId: string, status: string, detail: string, open = false): Promise<void> {
  if (hasUserActor()) return withActor(null, () => updateMessageStatus(providerId, status, detail, open));
  await run(
    "update messages set delivery_status = ?, delivery_detail = ?, status_at = ?, open_indicative = case when ? then true else open_indicative end where provider_id = ?",
    [status, detail, new Date().toISOString(), open, providerId],
  );
}

export async function unitByRelay(local: string): Promise<Unit | null> {
  if (hasUserActor()) return withActor(null, () => unitByRelay(local));
  const row = await one<UnitRow>("select * from units where relay_local = ?", [local]);
  if (!row) return null;
  return mapUnit(row, "owner");
}

export async function messageByToken(token: string): Promise<Message | null> {
  if (hasUserActor()) return withActor(null, () => messageByToken(token));
  const row = await one<MessageRow>("select * from messages where response_token = ?", [token]);
  return row ? mapMessage(row) : null;
}

export async function addLandlordResponse(unitId: string, messageId: string | null, action: string, note: string): Promise<void> {
  if (hasUserActor()) return withActor(null, () => addLandlordResponse(unitId, messageId, action, note));
  await run("insert into landlord_responses (id, unit_id, message_id, action, note, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), unitId, messageId, action, note, new Date().toISOString(),
  ]);
}

export async function listLandlordResponses(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  return await all<{ id: string; action: string; note: string | null; created_at: string; message_id: string | null }>(
    "select * from landlord_responses where unit_id = ? order by created_at asc",
    [unitId],
  );
}

export async function blockLandlord(unitId: string, reason: string): Promise<void> {
  if (hasUserActor()) return withActor(null, () => blockLandlord(unitId, reason));
  await run("insert into landlord_blocks (unit_id, reason, created_at) values (?, ?, ?) on conflict(unit_id) do update set reason = excluded.reason", [
    unitId, reason, new Date().toISOString(),
  ]);
}

export async function reportAbuse(unitId: string | null, source: string, note: string): Promise<void> {
  if (hasUserActor()) return withActor(null, () => reportAbuse(unitId, source, note));
  await run("insert into abuse_reports (id, unit_id, source, note, created_at) values (?, ?, ?, ?, ?)", [
    randomUUID(), unitId, source, note, new Date().toISOString(),
  ]);
}

export type Deadline = {
  id: string;
  unitId: string;
  ruleId: string;
  kind: string;
  anchorDate: string | null;
  dueDate: string | null;
  explanation: string;
  explanationEs: string;
  computation: string;
  sourceId: string | null;
  status: string;
  unsure: boolean;
  tenantReminderOn: string | null;
  createdAt: string;
};

export async function insertDeadline(input: Omit<Deadline, "id" | "createdAt" | "tenantReminderOn"> & { tenantReminderOn?: string | null }) {
  await run(
    `insert into deadlines (
      id, unit_id, rule_id, kind, anchor_date, due_date, explanation, explanation_es, computation, source_id, status, unsure, tenant_reminder_on, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(), input.unitId, input.ruleId, input.kind, input.anchorDate, input.dueDate, input.explanation,
      input.explanationEs, input.computation, input.sourceId, input.status, input.unsure, input.tenantReminderOn || null,
      new Date().toISOString(),
    ],
  );
}

export async function replaceOpenDeadline(unitId: string, kind: string) {
  await run("update deadlines set status = 'replaced' where unit_id = ? and kind = ? and status = 'open'", [unitId, kind]);
}

function dateText(value: unknown): string | null {
  if (value == null || value === "") return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : text;
}

function timeText(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

type DeadlineRow = {
  id: string; unit_id: string; rule_id: string; kind: string; anchor_date: string | null; due_date: string | null;
  explanation: string; explanation_es: string; computation: string; source_id: string | null; status: string;
  unsure: number; tenant_reminder_on: string | null; created_at: string;
};

function mapDeadline(row: DeadlineRow): Deadline {
  return {
    id: row.id,
    unitId: row.unit_id,
    ruleId: row.rule_id,
    kind: row.kind,
    anchorDate: dateText(row.anchor_date),
    dueDate: dateText(row.due_date),
    explanation: row.explanation,
    explanationEs: row.explanation_es,
    computation: row.computation,
    sourceId: row.source_id,
    status: row.status,
    unsure: isOn(row.unsure),
    tenantReminderOn: dateText(row.tenant_reminder_on),
    createdAt: row.created_at,
  };
}

export async function listDeadlines(userId: string, unitId: string): Promise<Deadline[]> {
  await requireUnit(userId, unitId);
  return (await all<DeadlineRow>(
    "select * from deadlines where unit_id = ? order by coalesce(due_date, tenant_reminder_on, '9999-12-31') asc",
    [unitId],
  )).map(mapDeadline);
}

export async function getDeadline(userId: string, id: string): Promise<Deadline> {
  const row = await one<DeadlineRow>("select * from deadlines where id = ?", [id]);
  if (!row) throw new HttpError("Reminder not found.");
  await requireWritable(userId, row.unit_id);
  return mapDeadline(row);
}

export async function setReminderStatus(userId: string, id: string, status: "open" | "deleted" | "dismissed") {
  await getDeadline(userId, id);
  const result = await run("update deadlines set status = ? where id = ?", [status, id]);
  if (!result.changes) throw new HttpError("Reminder not found.");
}

export async function updateLogResolution(userId: string, id: string, patch: {
  status: "open" | "pending_confirm" | "resolved";
  resolvedAt: string | null;
  resolvedBy: "tenant" | "landlord" | null;
  resolutionNote: string | null;
  flags: Record<string, unknown>;
}) {
  const current = await getLog(userId, id);
  await requireWritable(userId, current.unitId);
  if (current.type !== "repair") throw new HttpError("Only a repair request can be resolved.");
  await run(
    "update log_entries set status = ?, resolved_at = ?, resolved_by = ?, resolution_note = ?, flags = ? where id = ?",
    [patch.status, patch.resolvedAt, patch.resolvedBy, patch.resolutionNote, JSON.stringify(patch.flags), id],
  );
  return await getLog(userId, id);
}

export async function setLinkedDeadlines(userId: string, unitId: string, sourceId: string, from: string, to: string) {
  await requireWritable(userId, unitId);
  return await run(
    "update deadlines set status = ? where unit_id = ? and source_id = ? and status = ?",
    [to, unitId, sourceId, from],
  );
}

export async function setDeadlineStatus(userId: string, id: string, status: "open" | "done") {
  const row = await one<{ unit_id: string }>("select unit_id from deadlines where id = ?", [id]);
  if (!row) throw new HttpError("Deadline not found.");
  await requireWritable(userId, row.unit_id);
  await run("update deadlines set status = ? where id = ?", [status, id]);
}

export async function updateDeadlineFacts(id: string, patch: {
  ruleId: string;
  dueDate: string | null;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
}) {
  await run(
    "update deadlines set rule_id = ?, due_date = ?, explanation = ?, explanation_es = ?, computation = ?, unsure = ? where id = ?",
    [patch.ruleId, patch.dueDate, patch.explanation, patch.explanationEs, patch.computation, patch.unsure, id],
  );
}

export async function setTenantReminder(userId: string, id: string, date: string | null) {
  const row = await one<{ unit_id: string }>("select unit_id from deadlines where id = ?", [id]);
  if (!row) throw new HttpError("Reminder not found.");
  await requireWritable(userId, row.unit_id);
  await run("update deadlines set tenant_reminder_on = ? where id = ?", [date, id]);
}

export async function insertCustomReminder(userId: string, unitId: string, label: string, date: string) {
  await requireWritable(userId, unitId);
  await insertDeadline({
    unitId,
    ruleId: "tenant-reminder",
    kind: "custom_reminder",
    anchorDate: null,
    dueDate: null,
    explanation: label,
    explanationEs: label,
    computation: "Tenant-added reminder. Not a date from the rules library.",
    sourceId: null,
    status: "open",
    unsure: false,
    tenantReminderOn: date,
  });
}

export async function listDueNudges() {
  return await all<{
    id: string; unit_id: string; tenant_reminder_on: string; explanation: string; kind: string;
  }>("select id, unit_id, tenant_reminder_on, explanation, kind from deadlines where status = 'open' and tenant_reminder_on is not null");
}

export async function openDeadlines() {
  return await all<{
    id: string; unit_id: string; rule_id: string; kind: string; due_date: string; explanation: string;
  }>("select id, unit_id, rule_id, kind, due_date, explanation from deadlines where status = 'open' and due_date is not null");
}

export async function reminderSlotsSent(deadlineId: string) {
  return (await all<{ slot: string }>("select slot from reminder_sent where deadline_id = ?", [deadlineId])).map((row) => row.slot);
}

export async function markReminder(deadlineId: string, slot: string, channel: string) {
  await run("insert into reminder_sent (deadline_id, slot, sent_at, channel) values (?, ?, ?, ?) on conflict do nothing", [
    deadlineId, slot, new Date().toISOString(), channel,
  ]);
}

export async function unitMemberUserIds(unitId: string) {
  return (await all<{ user_id: string }>("select user_id from unit_members where unit_id = ?", [unitId])).map((row) => row.user_id);
}

export async function addNotification(userId: string, title: string, body: string, href: string) {
  await run("insert into notifications (id, user_id, title, body, href, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), userId, title, body, href, new Date().toISOString(),
  ]);
}

export async function listNotifications(userId: string) {
  return await all<{ id: string; title: string; body: string; href: string | null; created_at: string; read_at: string | null }>(
    "select * from notifications where user_id = ? order by created_at desc limit 20",
    [userId],
  );
}

export async function saveFile(userId: string, unitId: string | null, name: string, mime: string, bytes: Buffer) {
  if (unitId) await requireUnit(userId, unitId);
  if (bytes.length > 8 * 1024 * 1024) throw new HttpError("Files must be 8 MB or smaller.");
  const id = randomUUID();
  await putBlob(id, encryptStringBuffer(bytes));
  await run("insert into files (id, user_id, unit_id, name, mime, bytes, created_at) values (?, ?, ?, ?, ?, ?, ?)", [
    id, userId, unitId, name, mime, bytes.length, new Date().toISOString(),
  ]);
  return id;
}

function encryptStringBuffer(bytes: Buffer): Buffer {
  return Buffer.from(encryptString(bytes.toString("base64")), "utf8");
}

export async function readFileForUser(userId: string, fileId: string) {
  const row = await one<{ user_id: string; unit_id: string | null; name: string; mime: string }>("select * from files where id = ?", [fileId]);
  if (!row) return null;
  if (row.user_id !== userId) {
    if (!row.unit_id || !await membership(userId, row.unit_id)) return null;
  }
  const blob = await getBlob(fileId);
  if (!blob) return null;
  const bytes = Buffer.from(decryptString(blob.toString("utf8")), "base64");
  return { name: row.name, mime: row.mime, bytes };
}

function monthWindow(monthStart: string): [string, string] {
  const [yearText, monthText] = monthStart.slice(0, 7).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return [`${yearText}-${monthText}-01`, next];
}

export async function countLeaseReviewsThisMonth(userId: string, monthStart: string) {
  const [start, end] = monthWindow(monthStart);
  const row = await one<{ n: number }>(
    "select count(*)::int as n from lease_reviews where user_id = ? and cached = false and created_at >= ? and created_at < ?",
    [userId, start, end],
  );
  return row?.n || 0;
}

export async function findCachedReview(unitId: string, textHash: string, rulesVersion: string) {
  const row = await one<{ id: string; result: string; model: string | null; created_at: string }>(
    "select * from lease_reviews where unit_id = ? and text_hash = ? and rules_version = ? order by created_at desc limit 1",
    [unitId, textHash, rulesVersion],
  );
  return row;
}

export async function saveLeaseReview(input: {
  unitId: string;
  userId: string;
  filename: string;
  textHash: string;
  rulesVersion: string;
  model: string | null;
  cached: boolean;
  result: LeaseReview;
}) {
  await requireWritable(input.userId, input.unitId);
  const id = randomUUID();
  await run(
    `insert into lease_reviews (id, unit_id, user_id, filename, text_hash, rules_version, model, cached, result, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.unitId, input.userId, input.filename, input.textHash, input.rulesVersion, input.model,
      input.cached, JSON.stringify(input.result), new Date().toISOString(),
    ],
  );
  return id;
}

export async function listLeaseReviews(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  return (await all<{ id: string; filename: string | null; model: string | null; cached: number; result: string; created_at: string; rules_version: string }>(
    "select * from lease_reviews where unit_id = ? order by created_at desc",
    [unitId],
  )).map((row) => ({
    id: row.id,
    filename: row.filename,
    model: row.model,
    cached: isOn(row.cached),
    result: parseJson<LeaseReview>(row.result, {} as LeaseReview),
    createdAt: row.created_at,
    rulesVersion: row.rules_version,
  }));
}

export async function addFeedback(userId: string, reviewId: string, note: string) {
  const row = await one<{ unit_id: string }>("select unit_id from lease_reviews where id = ?", [reviewId]);
  if (!row) throw new HttpError("Review not found.");
  await requireWritable(userId, row.unit_id);
  await run("insert into feedback (id, user_id, review_id, note, created_at) values (?, ?, ?, ?, ?)", [
    randomUUID(), userId, reviewId, note, new Date().toISOString(),
  ]);
}

export async function getDeposit(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  return await one<{
    amount_cents: number | null; received_date: string | null; move_out_date: string | null;
    forwarding_address: string; landlord_deductions: string; tenant_notes: string; updated_at: string;
  }>("select * from deposits where unit_id = ?", [unitId]);
}

export async function saveDeposit(userId: string, unitId: string, input: {
  amountCents: number | null;
  receivedDate: string | null;
  moveOutDate: string | null;
  forwardingAddress: string;
  landlordDeductions: string;
  tenantNotes: string;
}) {
  await requireWritable(userId, unitId);
  const now = new Date().toISOString();
  await run(
    `insert into deposits (unit_id, amount_cents, received_date, move_out_date, forwarding_address, landlord_deductions, tenant_notes, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(unit_id) do update set
       amount_cents=excluded.amount_cents, received_date=excluded.received_date, move_out_date=excluded.move_out_date,
       forwarding_address=excluded.forwarding_address, landlord_deductions=excluded.landlord_deductions,
       tenant_notes=excluded.tenant_notes, updated_at=excluded.updated_at`,
    [unitId, input.amountCents, input.receivedDate, input.moveOutDate, input.forwardingAddress, input.landlordDeductions, input.tenantNotes, now],
  );
}

export async function listLedger(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  return await all<{
    id: string; amount_cents: number; period_start: string | null; period_end: string | null; paid_on: string;
    method: string; notes: string; receipt_file_id: string | null; voided_at: string | null; created_at: string;
  }>("select * from ledger_entries where unit_id = ? order by paid_on desc", [unitId]);
}

export async function addLedger(userId: string, unitId: string, input: {
  amountCents: number; periodStart: string | null; periodEnd: string | null; paidOn: string; method: string; notes: string;   receiptFileId: string | null;
}) {
  await requireWritable(userId, unitId);
  const id = randomUUID();
  await run(
    `insert into ledger_entries (id, unit_id, user_id, amount_cents, period_start, period_end, paid_on, method, notes, receipt_file_id, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, unitId, userId, input.amountCents, input.periodStart, input.periodEnd, input.paidOn, input.method, input.notes, input.receiptFileId, new Date().toISOString()],
  );
  return id;
}

export async function voidLedger(userId: string, id: string) {
  const row = await one<{ unit_id: string }>("select unit_id from ledger_entries where id = ?", [id]);
  if (!row) throw new HttpError("Payment not found.");
  await requireWritable(userId, row.unit_id);
  await run("update ledger_entries set voided_at = ? where id = ?", [new Date().toISOString(), id]);
}

export type ConditionRoom = { room: string; condition: string; issues: string[]; notes: string; photoFileId: string | null };

export async function listConditions(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  return (await all<{ id: string; kind: string; rooms: string; notes: string; content_hash: string | null; ack_token: string | null; acknowledged_at: string | null; ack_name: string | null; created_at: string }>(
    "select * from condition_reports where unit_id = ? order by created_at desc",
    [unitId],
  )).map((row) => ({
    id: row.id,
    kind: row.kind,
    rooms: parseJson<ConditionRoom[]>(row.rooms, []),
    notes: row.notes,
    contentHash: row.content_hash,
    ackToken: row.ack_token,
    acknowledgedAt: row.acknowledged_at,
    ackName: row.ack_name,
    createdAt: row.created_at,
  }));
}

export async function getCondition(userId: string, id: string) {
  const row = await one<{ unit_id: string }>("select unit_id from condition_reports where id = ?", [id]);
  if (!row) throw new HttpError("Report not found.");
  return (await listConditions(userId, row.unit_id)).find((item) => item.id === id)!;
}

export async function insertCondition(userId: string, unitId: string, kind: string, rooms: ConditionRoom[], notes: string) {
  await requireWritable(userId, unitId);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const token = randomToken();
  const payload = { id, unitId, kind, rooms, notes, createdAt };
  const contentHash = sha256(JSON.stringify(payload));
  await run(
    `insert into condition_reports (id, unit_id, user_id, kind, rooms, notes, content_hash, ack_token, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, unitId, userId, kind, JSON.stringify(rooms), notes, contentHash, token, createdAt],
  );
  return id;
}

export async function acknowledgeCondition(token: string, name: string): Promise<string> {
  if (hasUserActor()) return withActor(null, () => acknowledgeCondition(token, name));
  const row = await one<{ id: string; acknowledged_at: string | null }>("select * from condition_reports where ack_token = ?", [token]);
  if (!row) throw new HttpError("This acknowledgment link is not valid.");
  if (row.acknowledged_at) return row.id;
  await run("update condition_reports set acknowledged_at = ?, ack_name = ? where id = ?", [new Date().toISOString(), name.slice(0, 120), row.id]);
  return row.id;
}

export async function saveRentCheck(userId: string, unitId: string, input: unknown, result: RentIncreaseResult) {
  await requireWritable(userId, unitId);
  const id = randomUUID();
  await run("insert into rent_checks (id, unit_id, user_id, input, result, created_at) values (?, ?, ?, ?, ?, ?)", [
    id, unitId, userId, JSON.stringify(input), JSON.stringify(result), new Date().toISOString(),
  ]);
  return id;
}

export async function latestRentCheck(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  const row = await one<{ id: string; input: string; result: string; created_at: string }>(
    "select * from rent_checks where unit_id = ? order by created_at desc limit 1",
    [unitId],
  );
  if (!row) return null;
  return { id: row.id, input: parseJson<unknown>(row.input, {}), result: parseJson<RentIncreaseResult>(row.result, {} as RentIncreaseResult), createdAt: row.created_at };
}

export async function addAssistantMessage(userId: string, unitId: string | null, role: string, answer: { locale: string; content: string; ruleIds: string[]; unsure: boolean; createdAt?: string }) {
  const id = randomUUID();
  await run(
    "insert into assistant_messages (id, user_id, unit_id, role, locale, content, rule_ids, unsure, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, userId, unitId, role, answer.locale, answer.content, JSON.stringify(answer.ruleIds), answer.unsure, answer.createdAt || new Date().toISOString()],
  );
  return id;
}

export async function assistantMessageContent(userId: string, id: string) {
  const row = await one<{ content: string }>("select content from assistant_messages where id = ? and user_id = ?", [id, userId]);
  return row?.content ?? null;
}

export async function updateAssistantMessage(userId: string, id: string, answer: { content: string; ruleIds: string[]; unsure: boolean }) {
  const result = await run(
    "update assistant_messages set content = ?, rule_ids = ?, unsure = ? where id = ? and user_id = ? and role = 'assistant'",
    [answer.content, JSON.stringify(answer.ruleIds), answer.unsure, id, userId],
  );
  return Number(result.changes) > 0;
}

export type ChatDraft = {
  id: string;
  userId: string;
  unitId: string;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
};

export async function openChatDraft(userId: string) {
  const row = await one<{ id: string; user_id: string; unit_id: string; kind: string; payload: string; status: string }>(
    "select * from chat_drafts where user_id = ? and status = 'open' order by created_at desc limit 1",
    [userId],
  );
  if (!row) return null;
  return { id: row.id, userId: row.user_id, unitId: row.unit_id, kind: row.kind, payload: parseJson<Record<string, unknown>>(row.payload, {}), status: row.status };
}

export async function createChatDraft(userId: string, unitId: string, kind: string, payload: Record<string, unknown>) {
  await run("update chat_drafts set status = 'cancelled' where user_id = ? and status = 'open'", [userId]);
  const id = randomUUID();
  await run(
    "insert into chat_drafts (id, user_id, unit_id, kind, payload, status, created_at) values (?, ?, ?, ?, ?, 'open', ?)",
    [id, userId, unitId, kind, JSON.stringify(payload), new Date().toISOString()],
  );
  return { id, userId, unitId, kind, payload, status: "open" };
}

export async function closeChatDraft(userId: string, id: string, status: "sent" | "done" | "cancelled") {
  await run("update chat_drafts set status = ? where id = ? and user_id = ? and status = 'open'", [status, id, userId]);
}

export async function setChatDraftPayload(userId: string, id: string, payload: Record<string, unknown>) {
  await run("update chat_drafts set payload = ? where id = ? and user_id = ? and status = 'open'", [JSON.stringify(payload), id, userId]);
}

export async function listAssistant(userId: string, scope: "visible" | "all" = "all") {
  const visible = scope === "visible" ? " and archived_at is null" : "";
  return await all<{ role: string; content: string; rule_ids: string; unsure: number; created_at: string; locale: string }>(
    `select * from assistant_messages where user_id = ?${visible} order by created_at asc`,
    [userId],
  );
}

export async function archiveChat(userId: string) {
  const now = new Date().toISOString();
  await run("update assistant_messages set archived_at = ? where user_id = ? and archived_at is null", [now, userId]);
  await run("update chat_drafts set status = 'cancelled' where user_id = ? and status = 'open'", [userId]);
}

export async function countAssistantThisMonth(userId: string, monthStart: string) {
  const [start, end] = monthWindow(monthStart);
  const row = await one<{ n: number }>(
    "select count(*)::int as n from assistant_messages where user_id = ? and role = 'user' and created_at >= ? and created_at < ?",
    [userId, start, end],
  );
  return row?.n || 0;
}

export async function createInvite(userId: string, unitId: string) {
  const unit = await requireWritable(userId, unitId);
  if (unit.role !== "owner") throw new HttpError("Only the person who added the unit can invite a roommate.");
  const token = randomToken();
  await run("insert into invites (id, unit_id, token_hash, created_by, expires_at, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), unitId, hashToken(token), userId, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), new Date().toISOString(),
  ]);
  return token;
}

export async function acceptInvite(userId: string, token: string): Promise<void> {
  if (hasUserActor()) return withActor(null, () => acceptInvite(userId, token));
  const row = await one<{ id: string; unit_id: string; expires_at: string; accepted_by: string | null }>(
    "select * from invites where token_hash = ?",
    [hashToken(token)],
  );
  if (!row || row.accepted_by || row.expires_at < new Date().toISOString()) throw new HttpError("This invite is invalid or expired.");
  if (!await membership(userId, row.unit_id)) {
    await run("insert into unit_members (unit_id, user_id, role, created_at) values (?, ?, 'roommate', ?)", [
      row.unit_id, userId, new Date().toISOString(),
    ]);
  }
  await run("update invites set accepted_by = ? where id = ?", [userId, row.id]);
}

export async function logMailed(userId: string, unitId: string, logEntryId: string | null, receiptFileId: string | null) {
  await requireUnit(userId, unitId);
  await run("insert into mailed_notices (id, unit_id, log_entry_id, user_id, receipt_file_id, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), unitId, logEntryId, userId, receiptFileId, new Date().toISOString(),
  ]);
}

export async function listMailed(userId: string, unitId: string) {
  await requireUnit(userId, unitId);
  return await all<{ id: string; log_entry_id: string | null; receipt_file_id: string | null; created_at: string }>(
    "select * from mailed_notices where unit_id = ? order by created_at desc",
    [unitId],
  );
}

export async function savePush(userId: string, endpoint: string, p256dh: string, auth: string) {
  await run("insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), userId, endpoint, p256dh, auth, new Date().toISOString(),
  ]);
}

export async function listPush(userId: string) {
  return await all<{ endpoint: string; p256dh: string; auth: string }>("select * from push_subscriptions where user_id = ?", [userId]);
}

export async function deleteUserAccount(userId: string): Promise<void> {
  if (hasUserActor()) return withActor(null, () => deleteUserAccount(userId));
  const personal = await all<{ id: string }>("select id from files where user_id = ? and unit_id is null", [userId]);
  for (const file of personal) await deleteBlob(file.id);
  await run("delete from files where user_id = ? and unit_id is null", [userId]);
  const memberships = await all<{ unit_id: string }>("select unit_id from unit_members where user_id = ?", [userId]);
  for (const member of memberships) {
    const others = await one<{ n: number }>("select count(*)::int as n from unit_members where unit_id = ? and user_id != ?", [member.unit_id, userId]);
    if ((others?.n || 0) === 0) await deleteUnit(member.unit_id);
    else {
      await run(
        "update units set created_by = (select user_id from unit_members where unit_id = ? and user_id != ? limit 1) where id = ? and created_by = ?",
        [member.unit_id, userId, member.unit_id, userId],
      );
      await run("delete from unit_members where unit_id = ? and user_id = ?", [member.unit_id, userId]);
    }
  }
  await run("delete from assistant_messages where user_id = ?", [userId]);
  await run("delete from chat_drafts where user_id = ?", [userId]);
  await run("delete from notifications where user_id = ?", [userId]);
  await run("delete from push_subscriptions where user_id = ?", [userId]);
  await run("delete from feedback where user_id = ?", [userId]);
  const user = await getUser(userId);
  if (user) await run("delete from magic_links where email = ?", [user.email]);
  await run("delete from profiles where id = ?", [userId]);
  let authDeleteFailed = false;
  try {
    await run("delete from auth.users where id = ?", [userId]);
  } catch {
    authDeleteFailed = true;
  }
  const removedByApi = await deleteSupabaseAuthUser(userId);
  if (authDeleteFailed && !removedByApi) throw new Error("Could not delete the account.");
}

async function deleteUnit(unitId: string) {
  const files = await all<{ id: string }>("select id from files where unit_id = ?", [unitId]);
  for (const file of files) await deleteBlob(file.id);
  await run("delete from files where unit_id = ?", [unitId]);
  await run("delete from reminder_sent where deadline_id in (select id from deadlines where unit_id = ?)", [unitId]);
  await run("delete from messages where unit_id = ?", [unitId]);
  await run("delete from log_entries where unit_id = ?", [unitId]);
  await run("delete from deadlines where unit_id = ?", [unitId]);
  await run("delete from condition_reports where unit_id = ?", [unitId]);
  await run("delete from deposits where unit_id = ?", [unitId]);
  await run("delete from ledger_entries where unit_id = ?", [unitId]);
  await run("delete from lease_reviews where unit_id = ?", [unitId]);
  await run("delete from rent_checks where unit_id = ?", [unitId]);
  await run("delete from landlord_responses where unit_id = ?", [unitId]);
  await run("delete from landlord_blocks where unit_id = ?", [unitId]);
  await run("delete from mailed_notices where unit_id = ?", [unitId]);
  await run("delete from chat_drafts where unit_id = ?", [unitId]);
  await run("delete from invites where unit_id = ?", [unitId]);
  await run("delete from unit_members where unit_id = ?", [unitId]);
  await run("delete from units where id = ?", [unitId]);
}

export async function exportUserData(userId: string) {
  const user = await getUser(userId);
  const memberships = await all<{ unit_id: string }>("select unit_id from unit_members where user_id = ?", [userId]);
  const units = [];
  for (const row of memberships) {
    const unit = await requireUnit(userId, row.unit_id);
    units.push({
      unit,
      logs: await listLogHistory(userId, unit.id),
      messages: await listMessages(userId, unit.id),
      deadlines: await listDeadlines(userId, unit.id),
      deposit: await getDeposit(userId, unit.id),
      ledger: await listLedger(userId, unit.id),
      conditions: await listConditions(userId, unit.id),
      leaseReviews: await listLeaseReviews(userId, unit.id),
      rentCheck: await latestRentCheck(userId, unit.id),
      responses: await listLandlordResponses(userId, unit.id),
    });
  }
  return {
    exportedAt: new Date().toISOString(),
    user,
    assistant: await listAssistant(userId),
    units,
    note: "Shared unit records stay if a roommate still has the unit. This export is your copy.",
  };
}

export function leaseTextHash(text: string, rulesVersion: string, rentCents: number | null, jurisdiction: string): string {
  return sha256(`${rulesVersion}\n${jurisdiction}\n${rentCents ?? ""}\n${text.replace(/\s+/g, " ").trim().toLowerCase()}`);
}

export type { AssistantAnswer };

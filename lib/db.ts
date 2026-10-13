import "server-only";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { decryptString, encryptString, hashToken, randomToken } from "@/lib/crypto";
import type { Locale } from "@/lib/disclaimer";
import type { LeaseReview } from "@/lib/lease/review";
import type { AssistantAnswer } from "@/lib/rules/assistant";
import type { Jurisdiction, RentIncreaseResult, RsoStatus, RstpoTier } from "@/lib/rules/engine";
import { deleteBlob, getBlob, putBlob } from "@/lib/storage";
import { chainHash, GENESIS_HASH, sha256 } from "@/lib/hash";

const SCHEMA = `
create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null default '',
  locale text not null default 'en',
  low_bandwidth integer not null default 0,
  phone text not null default '',
  created_at text not null
);
create table if not exists magic_links (
  id text primary key,
  email text not null,
  token_hash text not null,
  expires_at text not null,
  used_at text,
  created_at text not null
);
create table if not exists units (
  id text primary key,
  created_by text not null,
  street text not null,
  unit_number text not null default '',
  city text not null,
  postal_code text not null default '',
  region text not null default '',
  jurisdiction text not null,
  jurisdiction_confirmed integer not null default 0,
  rso_status text not null default 'unsure',
  rstpo_tier text not null default 'unsure',
  landlord_name text not null default '',
  landlord_email text not null default '',
  landlord_phone text not null default '',
  relay_local text not null unique,
  rent_cents integer,
  deposit_cents integer,
  move_in_date text,
  created_at text not null
);
create table if not exists unit_members (
  unit_id text not null,
  user_id text not null,
  role text not null,
  created_at text not null,
  primary key (unit_id, user_id)
);
create table if not exists invites (
  id text primary key,
  unit_id text not null,
  token_hash text not null,
  email text,
  created_by text not null,
  expires_at text not null,
  accepted_by text,
  created_at text not null
);
create table if not exists log_entries (
  id text primary key,
  unit_id text not null,
  user_id text not null,
  version_group text not null,
  version integer not null,
  revises_id text,
  type text not null,
  notice_kind text,
  severity text,
  room text,
  description text not null,
  flags text not null default '{}',
  photo_file_id text,
  prev_hash text not null,
  content_hash text not null,
  event_date text not null,
  created_at text not null
);
create table if not exists messages (
  id text primary key,
  unit_id text not null,
  user_id text,
  log_entry_id text,
  direction text not null,
  from_email text not null,
  to_email text not null,
  cc_email text,
  subject text not null,
  body_enc text not null,
  delivery_status text not null,
  delivery_detail text,
  open_indicative integer not null default 0,
  provider_id text,
  response_token text,
  created_at text not null,
  status_at text not null
);
create table if not exists deadlines (
  id text primary key,
  unit_id text not null,
  rule_id text not null,
  kind text not null,
  anchor_date text,
  due_date text,
  explanation text not null,
  explanation_es text not null,
  computation text not null,
  source_id text,
  status text not null default 'open',
  unsure integer not null default 0,
  created_at text not null
);
create table if not exists reminder_sent (
  deadline_id text not null,
  slot text not null,
  sent_at text not null,
  channel text not null,
  primary key (deadline_id, slot)
);
create table if not exists condition_reports (
  id text primary key,
  unit_id text not null,
  user_id text not null,
  kind text not null,
  rooms text not null,
  notes text not null default '',
  content_hash text,
  ack_token text,
  acknowledged_at text,
  ack_name text,
  created_at text not null
);
create table if not exists deposits (
  unit_id text primary key,
  amount_cents integer,
  received_date text,
  move_out_date text,
  forwarding_address text not null default '',
  landlord_deductions text not null default '',
  tenant_notes text not null default '',
  updated_at text not null
);
create table if not exists ledger_entries (
  id text primary key,
  unit_id text not null,
  user_id text not null,
  amount_cents integer not null,
  period_start text,
  period_end text,
  paid_on text not null,
  method text not null,
  notes text not null default '',
  receipt_file_id text,
  voided_at text,
  created_at text not null
);
create table if not exists lease_reviews (
  id text primary key,
  unit_id text not null,
  user_id text not null,
  filename text,
  text_hash text not null,
  rules_version text not null,
  model text,
  cached integer not null default 0,
  result text not null,
  created_at text not null
);
create table if not exists feedback (
  id text primary key,
  user_id text not null,
  review_id text not null,
  note text not null,
  created_at text not null
);
create table if not exists rent_checks (
  id text primary key,
  unit_id text not null,
  user_id text not null,
  input text not null,
  result text not null,
  created_at text not null
);
create table if not exists assistant_messages (
  id text primary key,
  user_id text not null,
  unit_id text,
  role text not null,
  locale text not null,
  content text not null,
  rule_ids text not null,
  unsure integer not null default 0,
  created_at text not null
);
create table if not exists files (
  id text primary key,
  user_id text not null,
  unit_id text,
  name text not null,
  mime text not null,
  bytes integer not null,
  created_at text not null
);
create table if not exists notifications (
  id text primary key,
  user_id text not null,
  title text not null,
  body text not null,
  href text,
  created_at text not null,
  read_at text
);
create table if not exists landlord_responses (
  id text primary key,
  unit_id text not null,
  message_id text,
  action text not null,
  note text,
  created_at text not null
);
create table if not exists landlord_blocks (
  unit_id text primary key,
  reason text,
  created_at text not null
);
create table if not exists abuse_reports (
  id text primary key,
  unit_id text,
  source text not null,
  note text not null,
  created_at text not null
);
create table if not exists push_subscriptions (
  id text primary key,
  user_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at text not null
);
create table if not exists mailed_notices (
  id text primary key,
  unit_id text not null,
  log_entry_id text,
  user_id text not null,
  receipt_file_id text,
  created_at text not null
);
create table if not exists chat_drafts (
  id text primary key,
  user_id text not null,
  unit_id text not null,
  kind text not null,
  payload text not null,
  status text not null,
  created_at text not null
);
`;

const globalForDb = globalThis as unknown as { rentRightDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.rentRightDb) {
    const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "rent-right.sqlite");
    mkdirSync(path.dirname(file), { recursive: true });
    const database = new DatabaseSync(file);
    database.exec("pragma foreign_keys = on");
    database.exec(SCHEMA);
    globalForDb.rentRightDb = database;
  }
  return globalForDb.rentRightDb;
}

function all<T>(sql: string, params: SQLInputValue[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}
function one<T>(sql: string, params: SQLInputValue[] = []): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}
function run(sql: string, params: SQLInputValue[] = []) {
  return getDb().prepare(sql).run(...params);
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
  created_at: string;
  role?: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    locale: row.locale === "es" ? "es" : "en",
    lowBandwidth: row.low_bandwidth === 1,
    phone: row.phone,
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
    jurisdictionConfirmed: row.jurisdiction_confirmed === 1,
    rsoStatus: (row.rso_status as RsoStatus) || "unsure",
    rstpoTier: (row.rstpo_tier as RstpoTier) || "unsure",
    landlordName: row.landlord_name,
    landlordEmail: row.landlord_email,
    landlordPhone: row.landlord_phone,
    relayLocal: row.relay_local,
    rentCents: row.rent_cents,
    depositCents: row.deposit_cents,
    moveInDate: row.move_in_date,
    createdAt: row.created_at,
    role,
  };
}

export function unitAddress(unit: Unit): string {
  return [unit.street, unit.unitNumber ? `Unit ${unit.unitNumber}` : "", unit.city, "CA", unit.postalCode]
    .filter(Boolean)
    .join(", ")
    .replace(", CA,", " CA");
}

export function getUser(id: string): User | null {
  const row = one<UserRow>("select * from users where id = ?", [id]);
  return row ? mapUser(row) : null;
}

export function createNamedUser(email: string, name: string, locale: Locale = "en"): User {
  const id = randomUUID();
  run("insert into users (id, email, name, locale, created_at) values (?, ?, ?, ?, ?)", [
    id,
    email.toLowerCase(),
    name,
    locale,
    new Date().toISOString(),
  ]);
  return getUser(id)!;
}

export function getUserByEmail(email: string): User | null {
  const row = one<UserRow>("select * from users where email = ?", [email.toLowerCase()]);
  return row ? mapUser(row) : null;
}

export function createMagicLink(email: string): { token: string } {
  const normalized = email.toLowerCase().trim();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = one<{ n: number }>("select count(*) as n from magic_links where email = ? and created_at > ?", [normalized, since]);
  if ((recent?.n || 0) >= 5) throw new HttpError("Too many sign-in emails. Wait an hour and try again.");
  const token = randomToken();
  const now = new Date().toISOString();
  run("insert into magic_links (id, email, token_hash, expires_at, created_at) values (?, ?, ?, ?, ?)", [
    randomUUID(),
    normalized,
    hashToken(token),
    new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    now,
  ]);
  return { token };
}

export function consumeMagicLink(token: string): User {
  const row = one<{ id: string; email: string; expires_at: string; used_at: string | null }>(
    "select * from magic_links where token_hash = ?",
    [hashToken(token)],
  );
  if (!row || row.used_at || row.expires_at < new Date().toISOString()) {
    throw new HttpError("That sign-in link is invalid or expired.");
  }
  run("update magic_links set used_at = ? where id = ?", [new Date().toISOString(), row.id]);
  const existing = getUserByEmail(row.email);
  if (existing) return existing;
  const id = randomUUID();
  const now = new Date().toISOString();
  run("insert into users (id, email, name, created_at) values (?, ?, '', ?)", [id, row.email, now]);
  return getUser(id)!;
}

export function updateUser(id: string, patch: Partial<Pick<User, "name" | "locale" | "lowBandwidth" | "phone">>) {
  const current = getUser(id);
  if (!current) throw new HttpError("Account not found.");
  run("update users set name = ?, locale = ?, low_bandwidth = ?, phone = ? where id = ?", [
    patch.name ?? current.name,
    patch.locale ?? current.locale,
    (patch.lowBandwidth ?? current.lowBandwidth) ? 1 : 0,
    patch.phone ?? current.phone,
    id,
  ]);
}

export function membership(userId: string, unitId: string): "owner" | "roommate" | null {
  const row = one<{ role: string }>("select role from unit_members where user_id = ? and unit_id = ?", [userId, unitId]);
  if (!row) return null;
  return row.role === "owner" ? "owner" : "roommate";
}

export function requireUnit(userId: string, unitId: string): Unit {
  const role = membership(userId, unitId);
  if (!role) throw new HttpError("You do not have access to that unit.");
  const row = one<UnitRow>("select * from units where id = ?", [unitId]);
  if (!row) throw new HttpError("Unit not found.");
  return mapUnit(row, role);
}

export function peekUnit(id: string): Unit | null {
  const row = one<UnitRow>("select * from units where id = ?", [id]);
  return row ? mapUnit(row, "owner") : null;
}

export function primaryUnit(userId: string): Unit | null {
  const row = one<UnitRow & { role: string }>(
    `select u.*, m.role as role from units u
     join unit_members m on m.unit_id = u.id
     where m.user_id = ? order by m.created_at asc limit 1`,
    [userId],
  );
  if (!row) return null;
  return mapUnit(row, row.role === "owner" ? "owner" : "roommate");
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
};

export function createUnit(userId: string, input: UnitInput): Unit {
  const id = randomUUID();
  const now = new Date().toISOString();
  const relay = `u-${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
  run(
    `insert into units (
      id, created_by, street, unit_number, city, postal_code, region, jurisdiction, jurisdiction_confirmed,
      rso_status, rstpo_tier, landlord_name, landlord_email, landlord_phone, relay_local,
      rent_cents, deposit_cents, move_in_date, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, input.street, input.unitNumber, input.city, input.postalCode, input.region, input.jurisdiction,
      input.jurisdictionConfirmed ? 1 : 0, input.rsoStatus, input.rstpoTier, input.landlordName, input.landlordEmail,
      input.landlordPhone, relay, input.rentCents, input.depositCents, input.moveInDate, now,
    ],
  );
  run("insert into unit_members (unit_id, user_id, role, created_at) values (?, ?, 'owner', ?)", [id, userId, now]);
  return requireUnit(userId, id);
}

export function updateUnit(userId: string, unitId: string, input: UnitInput): Unit {
  const unit = requireUnit(userId, unitId);
  if (unit.role !== "owner") throw new HttpError("Only the person who added the unit can edit the landlord and address.");
  run(
    `update units set street=?, unit_number=?, city=?, postal_code=?, region=?, jurisdiction=?, jurisdiction_confirmed=?,
     rso_status=?, rstpo_tier=?, landlord_name=?, landlord_email=?, landlord_phone=?, rent_cents=?, deposit_cents=?, move_in_date=?
     where id=?`,
    [
      input.street, input.unitNumber, input.city, input.postalCode, input.region, input.jurisdiction,
      input.jurisdictionConfirmed ? 1 : 0, input.rsoStatus, input.rstpoTier, input.landlordName, input.landlordEmail,
      input.landlordPhone, input.rentCents, input.depositCents, input.moveInDate, unitId,
    ],
  );
  return requireUnit(userId, unitId);
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
    flags: JSON.parse(row.flags || "{}") as Record<string, unknown>,
    photoFileId: row.photo_file_id,
    prevHash: row.prev_hash,
    contentHash: row.content_hash,
    eventDate: row.event_date,
    createdAt: row.created_at,
  };
}

export function listLogs(userId: string, unitId: string): LogEntry[] {
  requireUnit(userId, unitId);
  const rows = all<LogRow>(
    `select * from log_entries e where unit_id = ? and version = (
      select max(version) from log_entries where version_group = e.version_group
    ) order by event_date desc, created_at desc`,
    [unitId],
  );
  return rows.map(mapLog);
}

export function listLogHistory(userId: string, unitId: string): LogEntry[] {
  requireUnit(userId, unitId);
  return all<LogRow>("select * from log_entries where unit_id = ? order by created_at asc", [unitId]).map(mapLog);
}

export function getLog(userId: string, id: string): LogEntry {
  const row = one<LogRow>("select * from log_entries where id = ?", [id]);
  if (!row) throw new HttpError("Log entry not found.");
  requireUnit(userId, row.unit_id);
  return mapLog(row);
}

export function insertLog(input: {
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
}): LogEntry {
  requireUnit(input.userId, input.unitId);
  const id = randomUUID();
  const createdAt = input.createdAt || new Date().toISOString();
  const prev = one<{ content_hash: string }>(
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
  run(
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
  return getLog(input.userId, id);
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
    openIndicative: row.open_indicative === 1,
    providerId: row.provider_id,
    responseToken: row.response_token,
    createdAt: row.created_at,
    statusAt: row.status_at,
  };
}

export function listMessages(userId: string, unitId: string): Message[] {
  requireUnit(userId, unitId);
  return all<MessageRow>("select * from messages where unit_id = ? order by created_at asc", [unitId]).map(mapMessage);
}

export function countOutboundSince(unitId: string, sinceIso: string): number {
  const row = one<{ n: number }>(
    "select count(*) as n from messages where unit_id = ? and direction = 'outbound' and created_at > ?",
    [unitId, sinceIso],
  );
  return row?.n || 0;
}

export function isBlocked(unitId: string): boolean {
  return Boolean(one("select unit_id from landlord_blocks where unit_id = ?", [unitId]));
}

export function insertMessage(input: {
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
}): Message {
  const id = randomUUID();
  const now = input.createdAt || new Date().toISOString();
  run(
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
  const row = one<MessageRow>("select * from messages where id = ?", [id])!;
  return mapMessage(row);
}

export function updateMessageStatus(providerId: string, status: string, detail: string, open = false) {
  run(
    "update messages set delivery_status = ?, delivery_detail = ?, status_at = ?, open_indicative = case when ? = 1 then 1 else open_indicative end where provider_id = ?",
    [status, detail, new Date().toISOString(), open ? 1 : 0, providerId],
  );
}

export function unitByRelay(local: string): Unit | null {
  const row = one<UnitRow>("select * from units where relay_local = ?", [local]);
  if (!row) return null;
  return mapUnit(row, "owner");
}

export function messageByToken(token: string): Message | null {
  const row = one<MessageRow>("select * from messages where response_token = ?", [token]);
  return row ? mapMessage(row) : null;
}

export function addLandlordResponse(unitId: string, messageId: string | null, action: string, note: string) {
  run("insert into landlord_responses (id, unit_id, message_id, action, note, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), unitId, messageId, action, note, new Date().toISOString(),
  ]);
}

export function listLandlordResponses(userId: string, unitId: string) {
  requireUnit(userId, unitId);
  return all<{ id: string; action: string; note: string | null; created_at: string; message_id: string | null }>(
    "select * from landlord_responses where unit_id = ? order by created_at asc",
    [unitId],
  );
}

export function blockLandlord(unitId: string, reason: string) {
  run("insert into landlord_blocks (unit_id, reason, created_at) values (?, ?, ?) on conflict(unit_id) do update set reason = excluded.reason", [
    unitId, reason, new Date().toISOString(),
  ]);
}

export function reportAbuse(unitId: string | null, source: string, note: string) {
  run("insert into abuse_reports (id, unit_id, source, note, created_at) values (?, ?, ?, ?, ?)", [
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
  createdAt: string;
};

export function insertDeadline(input: Omit<Deadline, "id" | "createdAt">) {
  run(
    `insert into deadlines (
      id, unit_id, rule_id, kind, anchor_date, due_date, explanation, explanation_es, computation, source_id, status, unsure, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(), input.unitId, input.ruleId, input.kind, input.anchorDate, input.dueDate, input.explanation,
      input.explanationEs, input.computation, input.sourceId, input.status, input.unsure ? 1 : 0, new Date().toISOString(),
    ],
  );
}

export function replaceOpenDeadline(unitId: string, kind: string) {
  run("update deadlines set status = 'replaced' where unit_id = ? and kind = ? and status = 'open'", [unitId, kind]);
}

export function listDeadlines(userId: string, unitId: string): Deadline[] {
  requireUnit(userId, unitId);
  return all<{
    id: string; unit_id: string; rule_id: string; kind: string; anchor_date: string | null; due_date: string | null;
    explanation: string; explanation_es: string; computation: string; source_id: string | null; status: string;
    unsure: number; created_at: string;
  }>("select * from deadlines where unit_id = ? order by coalesce(due_date, '9999-99-99') asc", [unitId]).map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    ruleId: row.rule_id,
    kind: row.kind,
    anchorDate: row.anchor_date,
    dueDate: row.due_date,
    explanation: row.explanation,
    explanationEs: row.explanation_es,
    computation: row.computation,
    sourceId: row.source_id,
    status: row.status,
    unsure: row.unsure === 1,
    createdAt: row.created_at,
  }));
}

export function setDeadlineStatus(userId: string, id: string, status: "open" | "done") {
  const row = one<{ unit_id: string }>("select unit_id from deadlines where id = ?", [id]);
  if (!row) throw new HttpError("Deadline not found.");
  requireUnit(userId, row.unit_id);
  run("update deadlines set status = ? where id = ?", [status, id]);
}

export function openDeadlines() {
  return all<{
    id: string; unit_id: string; rule_id: string; kind: string; due_date: string; explanation: string;
  }>("select id, unit_id, rule_id, kind, due_date, explanation from deadlines where status = 'open' and due_date is not null");
}

export function reminderSlotsSent(deadlineId: string): string[] {
  return all<{ slot: string }>("select slot from reminder_sent where deadline_id = ?", [deadlineId]).map((row) => row.slot);
}

export function markReminder(deadlineId: string, slot: string, channel: string) {
  run("insert or ignore into reminder_sent (deadline_id, slot, sent_at, channel) values (?, ?, ?, ?)", [
    deadlineId, slot, new Date().toISOString(), channel,
  ]);
}

export function unitMemberUserIds(unitId: string): string[] {
  return all<{ user_id: string }>("select user_id from unit_members where unit_id = ?", [unitId]).map((row) => row.user_id);
}

export function addNotification(userId: string, title: string, body: string, href: string) {
  run("insert into notifications (id, user_id, title, body, href, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), userId, title, body, href, new Date().toISOString(),
  ]);
}

export function listNotifications(userId: string) {
  return all<{ id: string; title: string; body: string; href: string | null; created_at: string; read_at: string | null }>(
    "select * from notifications where user_id = ? order by created_at desc limit 20",
    [userId],
  );
}

export async function saveFile(userId: string, unitId: string | null, name: string, mime: string, bytes: Buffer): Promise<string> {
  if (unitId) requireUnit(userId, unitId);
  if (bytes.length > 8 * 1024 * 1024) throw new HttpError("Files must be 8 MB or smaller.");
  const id = randomUUID();
  await putBlob(id, encryptStringBuffer(bytes));
  run("insert into files (id, user_id, unit_id, name, mime, bytes, created_at) values (?, ?, ?, ?, ?, ?, ?)", [
    id, userId, unitId, name, mime, bytes.length, new Date().toISOString(),
  ]);
  return id;
}

function encryptStringBuffer(bytes: Buffer): Buffer {
  return Buffer.from(encryptString(bytes.toString("base64")), "utf8");
}

export async function readFileForUser(userId: string, fileId: string): Promise<{ name: string; mime: string; bytes: Buffer } | null> {
  const row = one<{ user_id: string; unit_id: string | null; name: string; mime: string }>("select * from files where id = ?", [fileId]);
  if (!row) return null;
  if (row.user_id !== userId) {
    if (!row.unit_id || !membership(userId, row.unit_id)) return null;
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

export function countLeaseReviewsThisMonth(userId: string, monthStart: string): number {
  const [start, end] = monthWindow(monthStart);
  const row = one<{ n: number }>(
    "select count(*) as n from lease_reviews where user_id = ? and cached = 0 and created_at >= ? and created_at < ?",
    [userId, start, end],
  );
  return row?.n || 0;
}

export function findCachedReview(unitId: string, textHash: string, rulesVersion: string) {
  const row = one<{ id: string; result: string; model: string | null; created_at: string }>(
    "select * from lease_reviews where unit_id = ? and text_hash = ? and rules_version = ? order by created_at desc limit 1",
    [unitId, textHash, rulesVersion],
  );
  return row;
}

export function saveLeaseReview(input: {
  unitId: string;
  userId: string;
  filename: string;
  textHash: string;
  rulesVersion: string;
  model: string | null;
  cached: boolean;
  result: LeaseReview;
}) {
  const id = randomUUID();
  run(
    `insert into lease_reviews (id, unit_id, user_id, filename, text_hash, rules_version, model, cached, result, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.unitId, input.userId, input.filename, input.textHash, input.rulesVersion, input.model,
      input.cached ? 1 : 0, JSON.stringify(input.result), new Date().toISOString(),
    ],
  );
  return id;
}

export function listLeaseReviews(userId: string, unitId: string) {
  requireUnit(userId, unitId);
  return all<{ id: string; filename: string | null; model: string | null; cached: number; result: string; created_at: string; rules_version: string }>(
    "select * from lease_reviews where unit_id = ? order by created_at desc",
    [unitId],
  ).map((row) => ({
    id: row.id,
    filename: row.filename,
    model: row.model,
    cached: row.cached === 1,
    result: JSON.parse(row.result) as LeaseReview,
    createdAt: row.created_at,
    rulesVersion: row.rules_version,
  }));
}

export function addFeedback(userId: string, reviewId: string, note: string) {
  const row = one<{ unit_id: string }>("select unit_id from lease_reviews where id = ?", [reviewId]);
  if (!row) throw new HttpError("Review not found.");
  requireUnit(userId, row.unit_id);
  run("insert into feedback (id, user_id, review_id, note, created_at) values (?, ?, ?, ?, ?)", [
    randomUUID(), userId, reviewId, note, new Date().toISOString(),
  ]);
}

export function getDeposit(userId: string, unitId: string) {
  requireUnit(userId, unitId);
  return one<{
    amount_cents: number | null; received_date: string | null; move_out_date: string | null;
    forwarding_address: string; landlord_deductions: string; tenant_notes: string; updated_at: string;
  }>("select * from deposits where unit_id = ?", [unitId]);
}

export function saveDeposit(userId: string, unitId: string, input: {
  amountCents: number | null;
  receivedDate: string | null;
  moveOutDate: string | null;
  forwardingAddress: string;
  landlordDeductions: string;
  tenantNotes: string;
}) {
  requireUnit(userId, unitId);
  const now = new Date().toISOString();
  run(
    `insert into deposits (unit_id, amount_cents, received_date, move_out_date, forwarding_address, landlord_deductions, tenant_notes, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(unit_id) do update set
       amount_cents=excluded.amount_cents, received_date=excluded.received_date, move_out_date=excluded.move_out_date,
       forwarding_address=excluded.forwarding_address, landlord_deductions=excluded.landlord_deductions,
       tenant_notes=excluded.tenant_notes, updated_at=excluded.updated_at`,
    [unitId, input.amountCents, input.receivedDate, input.moveOutDate, input.forwardingAddress, input.landlordDeductions, input.tenantNotes, now],
  );
}

export function listLedger(userId: string, unitId: string) {
  requireUnit(userId, unitId);
  return all<{
    id: string; amount_cents: number; period_start: string | null; period_end: string | null; paid_on: string;
    method: string; notes: string; receipt_file_id: string | null; voided_at: string | null; created_at: string;
  }>("select * from ledger_entries where unit_id = ? order by paid_on desc", [unitId]);
}

export function addLedger(userId: string, unitId: string, input: {
  amountCents: number; periodStart: string | null; periodEnd: string | null; paidOn: string; method: string; notes: string; receiptFileId: string | null;
}) {
  requireUnit(userId, unitId);
  const id = randomUUID();
  run(
    `insert into ledger_entries (id, unit_id, user_id, amount_cents, period_start, period_end, paid_on, method, notes, receipt_file_id, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, unitId, userId, input.amountCents, input.periodStart, input.periodEnd, input.paidOn, input.method, input.notes, input.receiptFileId, new Date().toISOString()],
  );
  return id;
}

export function voidLedger(userId: string, id: string) {
  const row = one<{ unit_id: string }>("select unit_id from ledger_entries where id = ?", [id]);
  if (!row) throw new HttpError("Payment not found.");
  requireUnit(userId, row.unit_id);
  run("update ledger_entries set voided_at = ? where id = ?", [new Date().toISOString(), id]);
}

export type ConditionRoom = { room: string; condition: string; issues: string[]; notes: string; photoFileId: string | null };

export function listConditions(userId: string, unitId: string) {
  requireUnit(userId, unitId);
  return all<{ id: string; kind: string; rooms: string; notes: string; content_hash: string | null; ack_token: string | null; acknowledged_at: string | null; ack_name: string | null; created_at: string }>(
    "select * from condition_reports where unit_id = ? order by created_at desc",
    [unitId],
  ).map((row) => ({
    id: row.id,
    kind: row.kind,
    rooms: JSON.parse(row.rooms) as ConditionRoom[],
    notes: row.notes,
    contentHash: row.content_hash,
    ackToken: row.ack_token,
    acknowledgedAt: row.acknowledged_at,
    ackName: row.ack_name,
    createdAt: row.created_at,
  }));
}

export function getCondition(userId: string, id: string) {
  const row = one<{ unit_id: string }>("select unit_id from condition_reports where id = ?", [id]);
  if (!row) throw new HttpError("Report not found.");
  return listConditions(userId, row.unit_id).find((item) => item.id === id)!;
}

export function insertCondition(userId: string, unitId: string, kind: string, rooms: ConditionRoom[], notes: string) {
  requireUnit(userId, unitId);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const token = randomToken();
  const payload = { id, unitId, kind, rooms, notes, createdAt };
  const contentHash = sha256(JSON.stringify(payload));
  run(
    `insert into condition_reports (id, unit_id, user_id, kind, rooms, notes, content_hash, ack_token, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, unitId, userId, kind, JSON.stringify(rooms), notes, contentHash, token, createdAt],
  );
  return id;
}

export function acknowledgeCondition(token: string, name: string) {
  const row = one<{ id: string; acknowledged_at: string | null }>("select * from condition_reports where ack_token = ?", [token]);
  if (!row) throw new HttpError("This acknowledgment link is not valid.");
  if (row.acknowledged_at) return row.id;
  run("update condition_reports set acknowledged_at = ?, ack_name = ? where id = ?", [new Date().toISOString(), name.slice(0, 120), row.id]);
  return row.id;
}

export function saveRentCheck(userId: string, unitId: string, input: unknown, result: RentIncreaseResult) {
  requireUnit(userId, unitId);
  const id = randomUUID();
  run("insert into rent_checks (id, unit_id, user_id, input, result, created_at) values (?, ?, ?, ?, ?, ?)", [
    id, unitId, userId, JSON.stringify(input), JSON.stringify(result), new Date().toISOString(),
  ]);
  return id;
}

export function latestRentCheck(userId: string, unitId: string) {
  requireUnit(userId, unitId);
  const row = one<{ id: string; input: string; result: string; created_at: string }>(
    "select * from rent_checks where unit_id = ? order by created_at desc limit 1",
    [unitId],
  );
  if (!row) return null;
  return { id: row.id, input: JSON.parse(row.input), result: JSON.parse(row.result) as RentIncreaseResult, createdAt: row.created_at };
}

export function addAssistantMessage(userId: string, unitId: string | null, role: string, answer: { locale: string; content: string; ruleIds: string[]; unsure: boolean; createdAt?: string }): string {
  const id = randomUUID();
  run(
    "insert into assistant_messages (id, user_id, unit_id, role, locale, content, rule_ids, unsure, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, userId, unitId, role, answer.locale, answer.content, JSON.stringify(answer.ruleIds), answer.unsure ? 1 : 0, answer.createdAt || new Date().toISOString()],
  );
  return id;
}

export function assistantMessageContent(userId: string, id: string): string | null {
  const row = one<{ content: string }>("select content from assistant_messages where id = ? and user_id = ?", [id, userId]);
  return row?.content ?? null;
}

export function updateAssistantMessage(userId: string, id: string, answer: { content: string; ruleIds: string[]; unsure: boolean }): boolean {
  const result = run(
    "update assistant_messages set content = ?, rule_ids = ?, unsure = ? where id = ? and user_id = ? and role = 'assistant'",
    [answer.content, JSON.stringify(answer.ruleIds), answer.unsure ? 1 : 0, id, userId],
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

export function openChatDraft(userId: string): ChatDraft | null {
  const row = one<{ id: string; user_id: string; unit_id: string; kind: string; payload: string; status: string }>(
    "select * from chat_drafts where user_id = ? and status = 'open' order by created_at desc limit 1",
    [userId],
  );
  if (!row) return null;
  return { id: row.id, userId: row.user_id, unitId: row.unit_id, kind: row.kind, payload: JSON.parse(row.payload) as Record<string, unknown>, status: row.status };
}

export function createChatDraft(userId: string, unitId: string, kind: string, payload: Record<string, unknown>): ChatDraft {
  run("update chat_drafts set status = 'cancelled' where user_id = ? and status = 'open'", [userId]);
  const id = randomUUID();
  run(
    "insert into chat_drafts (id, user_id, unit_id, kind, payload, status, created_at) values (?, ?, ?, ?, ?, 'open', ?)",
    [id, userId, unitId, kind, JSON.stringify(payload), new Date().toISOString()],
  );
  return { id, userId, unitId, kind, payload, status: "open" };
}

export function closeChatDraft(userId: string, id: string, status: "sent" | "done" | "cancelled") {
  run("update chat_drafts set status = ? where id = ? and user_id = ? and status = 'open'", [status, id, userId]);
}

export function setChatDraftPayload(userId: string, id: string, payload: Record<string, unknown>) {
  run("update chat_drafts set payload = ? where id = ? and user_id = ? and status = 'open'", [JSON.stringify(payload), id, userId]);
}

export function listAssistant(userId: string) {
  return all<{ role: string; content: string; rule_ids: string; unsure: number; created_at: string; locale: string }>(
    "select * from assistant_messages where user_id = ? order by created_at asc",
    [userId],
  );
}

export function countAssistantThisMonth(userId: string, monthStart: string): number {
  const [start, end] = monthWindow(monthStart);
  const row = one<{ n: number }>(
    "select count(*) as n from assistant_messages where user_id = ? and role = 'user' and created_at >= ? and created_at < ?",
    [userId, start, end],
  );
  return row?.n || 0;
}

export function createInvite(userId: string, unitId: string): string {
  const unit = requireUnit(userId, unitId);
  if (unit.role !== "owner") throw new HttpError("Only the person who added the unit can invite a roommate.");
  const token = randomToken();
  run("insert into invites (id, unit_id, token_hash, created_by, expires_at, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), unitId, hashToken(token), userId, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), new Date().toISOString(),
  ]);
  return token;
}

export function acceptInvite(userId: string, token: string) {
  const row = one<{ id: string; unit_id: string; expires_at: string; accepted_by: string | null }>(
    "select * from invites where token_hash = ?",
    [hashToken(token)],
  );
  if (!row || row.accepted_by || row.expires_at < new Date().toISOString()) throw new HttpError("This invite is invalid or expired.");
  if (!membership(userId, row.unit_id)) {
    run("insert into unit_members (unit_id, user_id, role, created_at) values (?, ?, 'roommate', ?)", [
      row.unit_id, userId, new Date().toISOString(),
    ]);
  }
  run("update invites set accepted_by = ? where id = ?", [userId, row.id]);
}

export function logMailed(userId: string, unitId: string, logEntryId: string | null, receiptFileId: string | null) {
  requireUnit(userId, unitId);
  run("insert into mailed_notices (id, unit_id, log_entry_id, user_id, receipt_file_id, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), unitId, logEntryId, userId, receiptFileId, new Date().toISOString(),
  ]);
}

export function listMailed(userId: string, unitId: string) {
  requireUnit(userId, unitId);
  return all<{ id: string; log_entry_id: string | null; receipt_file_id: string | null; created_at: string }>(
    "select * from mailed_notices where unit_id = ? order by created_at desc",
    [unitId],
  );
}

export function savePush(userId: string, endpoint: string, p256dh: string, auth: string) {
  run("insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) values (?, ?, ?, ?, ?, ?)", [
    randomUUID(), userId, endpoint, p256dh, auth, new Date().toISOString(),
  ]);
}

export function listPush(userId: string) {
  return all<{ endpoint: string; p256dh: string; auth: string }>("select * from push_subscriptions where user_id = ?", [userId]);
}

export async function deleteUserAccount(userId: string) {
  const memberships = all<{ unit_id: string }>("select unit_id from unit_members where user_id = ?", [userId]);
  for (const member of memberships) {
    const others = one<{ n: number }>("select count(*) as n from unit_members where unit_id = ? and user_id != ?", [member.unit_id, userId]);
    if ((others?.n || 0) === 0) await deleteUnit(member.unit_id);
    else run("delete from unit_members where unit_id = ? and user_id = ?", [member.unit_id, userId]);
  }
  run("delete from assistant_messages where user_id = ?", [userId]);
  run("delete from chat_drafts where user_id = ?", [userId]);
  run("delete from notifications where user_id = ?", [userId]);
  run("delete from push_subscriptions where user_id = ?", [userId]);
  run("delete from feedback where user_id = ?", [userId]);
  const user = getUser(userId);
  if (user) run("delete from magic_links where email = ?", [user.email]);
  run("delete from users where id = ?", [userId]);
}

async function deleteUnit(unitId: string) {
  const files = all<{ id: string }>("select id from files where unit_id = ?", [unitId]);
  for (const file of files) await deleteBlob(file.id);
  run("delete from files where unit_id = ?", [unitId]);
  run("delete from reminder_sent where deadline_id in (select id from deadlines where unit_id = ?)", [unitId]);
  run("delete from messages where unit_id = ?", [unitId]);
  run("delete from log_entries where unit_id = ?", [unitId]);
  run("delete from deadlines where unit_id = ?", [unitId]);
  run("delete from condition_reports where unit_id = ?", [unitId]);
  run("delete from deposits where unit_id = ?", [unitId]);
  run("delete from ledger_entries where unit_id = ?", [unitId]);
  run("delete from lease_reviews where unit_id = ?", [unitId]);
  run("delete from rent_checks where unit_id = ?", [unitId]);
  run("delete from landlord_responses where unit_id = ?", [unitId]);
  run("delete from landlord_blocks where unit_id = ?", [unitId]);
  run("delete from mailed_notices where unit_id = ?", [unitId]);
  run("delete from chat_drafts where unit_id = ?", [unitId]);
  run("delete from invites where unit_id = ?", [unitId]);
  run("delete from unit_members where unit_id = ?", [unitId]);
  run("delete from units where id = ?", [unitId]);
}

export async function exportUserData(userId: string) {
  const user = getUser(userId);
  const units = all<{ unit_id: string }>("select unit_id from unit_members where user_id = ?", [userId]).map((row) => {
    const unit = requireUnit(userId, row.unit_id);
    return {
      unit,
      logs: listLogHistory(userId, unit.id),
      messages: listMessages(userId, unit.id),
      deadlines: listDeadlines(userId, unit.id),
      deposit: getDeposit(userId, unit.id),
      ledger: listLedger(userId, unit.id),
      conditions: listConditions(userId, unit.id),
      leaseReviews: listLeaseReviews(userId, unit.id),
      rentCheck: latestRentCheck(userId, unit.id),
      responses: listLandlordResponses(userId, unit.id),
    };
  });
  return {
    exportedAt: new Date().toISOString(),
    user,
    assistant: listAssistant(userId),
    units,
    note: "Shared unit records stay if a roommate still has the unit. This export is your copy.",
  };
}

export function leaseTextHash(text: string, rulesVersion: string, rentCents: number | null, jurisdiction: string): string {
  return sha256(`${rulesVersion}\n${jurisdiction}\n${rentCents ?? ""}\n${text.replace(/\s+/g, " ").trim().toLowerCase()}`);
}

export type { AssistantAnswer };

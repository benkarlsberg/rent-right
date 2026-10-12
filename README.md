# Rent Right

Free records and general legal information for renters in the City of Los Angeles, unincorporated Los Angeles County, and the City of San Diego. It is not a law firm. Nothing in the app is legal advice, and using it does not create an attorney-client relationship.

Phase 1 covers the product plan’s “now” features only: email sign-in, a unit profile, lease review grounded in a versioned rules library, a timestamped request and notice log, landlord email through a per-unit relay, deadline tracking, a photo condition report, a 21-day security-deposit tracker with a letter the tenant sends, an AB 1482 / LA RSO rent-increase checker, an English and Spanish rights assistant, a rent ledger, and a factual evidence packet. There are no landlord ratings, no texts to landlords, no service referrals, and no paid features.

## What runs locally

`npm run dev` uses **SQLite** (`node:sqlite`) at `data/rent-right.sqlite`. No Supabase, Resend, Gemini, or R2 account is required.

`supabase/migrations/001_init.sql` is the Postgres schema for a later Supabase deploy. It enables row-level security on every table and does not use a public `using (true)` policy. **The Next.js server does not connect to Supabase.** Membership checks in `lib/db.ts` are the access control for the local app. When you do host Postgres, turn on MFA for the Supabase dashboard, and do not put the service-role key in the browser. A service-role key bypasses RLS.

Lease text, message bodies, and uploaded files are encrypted with AES-256-GCM before they are stored. Without `DATA_ENCRYPTION_KEY`, development uses a key derived from `AUTH_SECRET` and prints a warning. Production throws if either secret is missing.

The renter UI is an Expo app in `mobile/` (iOS, Android, and Expo web). The Next.js process is the API: auth, the rules engine, SQLite, encryption, and landlord email. `http://localhost:3000` is only a short note plus landlord reply links, terms, and privacy.

## Setup

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

In a second terminal:

```bash
cd mobile
npm install
npx expo start
```

Then:

- **Expo Go:** install Expo Go on your phone, scan the QR code, and keep the phone on the same Wi-Fi as this computer. The app calls the API on port 3000 of the computer running Metro. `npm run dev` listens on all interfaces so the phone can reach it.
- **iOS Simulator** (macOS): press `i` in the Expo terminal.
- **Android emulator:** press `a`. The emulator reaches the API at `http://10.0.2.2:3000` unless you set `EXPO_PUBLIC_API_URL`.
- **Browser preview:** press `w`, or run `npx expo start --web`.

If Metro and the API are on different hosts, set `EXPO_PUBLIC_API_URL` in `mobile/.env` (for example `http://192.168.1.20:3000`).

On the welcome screen, **View a sample Los Angeles tenancy** resets `demo@rentright.local` (Maya Chen, 1842 N Echo Park Ave, Unit 3) with a lease review, a repair log, a rent-increase notice inside 180 days of that repair, a chat thread of the relay mail, a deposit countdown, a rent check, a ledger, and a move-in condition report.

Magic links last 30 minutes. Without `RESEND_API_KEY` and `RESEND_FROM`, the phone signs you in directly. With Resend, the email link opens `/open` and shows a code you can paste on the welcome screen. Limit is 5 links per email per hour.

Legal results show one short line, “General information, not legal advice.” **Learn more** opens the full disclaimer. Citations, rule explanations, and email footers work the same way. Landlord mail is a chat: you on the right, the landlord on the left. Sending still writes the timestamped relay email.

## Environment

Copy `.env.example` to `.env.local`. Do not commit `.env.local` or any real secret.

| Variable | Role |
| --- | --- |
| `AUTH_SECRET` | Signs the session token (phone `Authorization: Bearer`, and the browser cookie for landlord links). Required in production. |
| `EXPO_PUBLIC_API_URL` | Optional. Set in `mobile/.env` when the phone cannot infer the API host. |
| `DATA_ENCRYPTION_KEY` | 32-byte base64 AES key. Required in production. |
| `NEXT_PUBLIC_APP_URL` | Absolute URL used in mail and response links. Default `http://localhost:3000`. |
| `DATABASE_PATH` | SQLite file. Default `data/rent-right.sqlite`. |
| `RELAY_DOMAIN` | Domain for `u-…@domain` relay addresses. |
| `RESEND_API_KEY`, `RESEND_FROM` | Outbound mail. Blank means the message is saved and marked `local_only`. |
| `EMAIL_WEBHOOK_SECRET` | Bearer token for `POST /api/email/inbound` and `POST /api/email/webhook`. |
| `GEMINI_API_KEY` | Optional. Paid Gemini tier for photo OCR and for filling clauses the library left as unsure. |
| `OPENAI_API_KEY` | Optional fallback when Gemini is unset. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Optional Cloudflare R2. Blank stores encrypted blobs in `data/blobs/`. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Documented for a future Postgres deploy. Not read at boot. |
| `CRON_SECRET` | Bearer token for `POST /api/cron/reminders`. |
| `VAPID_*` | Reserved. Reminders are in-app, plus email when Resend is set. Web push is not wired. |

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Rules library

`lib/rules/library.ts` is version `2026-10-12-draft1`. Every entry is a **placeholder**: `placeholder: true`, `clinicReview: "pending_clinic_review"`, and `spanishReview: "pending_volunteer_review"`. Each entry cites an official government URL. The phone shows “Rules pending clinic review.” The full clinic note opens from Learn more. Do not treat the percentages or clause labels as approved legal advice.

The deterministic engine in `lib/rules/engine.ts` owns dates and rent caps. The model is not allowed to invent a rule ID.

- Deposit return is 21 calendar days from move-out (Civil Code §1950.5), rule `CA-CC-1950.5`.
- Repair reminders use a 30-day product preset under §1942, and shorter presets (3 days for no heat, water, electricity, or a gas leak; 7 days for a leak, mold, or pests). Those shorter numbers are labeled as product presets, not statutory deadlines.
- Entry notice uses 24 hours (§1954).
- A rent increase of 10% or less uses a 30-day notice; above 10% uses 90 days (§827).
- Three-day notice math skips weekends and the placeholder judicial-holiday list and returns unsure outside 2026–2027.
- A notice inside 180 days of a logged repair is flagged (§1942.5). The flag does not say retaliation occurred.
- AB 1482 percentages are stored by period and county area. A date outside the table is unsure. LA RSO is 3% only inside the published windows in the library. Unincorporated LA County uses the RSTPO tier the tenant selects; the app does not verify the tier. City of San Diego has just cause in the library and uses the AB 1482 percentage, not a local cap. Other cities are not calculated.
- If jurisdiction or coverage is unknown, the checker does not state a single allowed rent. A claimed exemption does not change an over-cap result into within-cap.

Lease review quotes the clause and cites a library rule ID, or it says **unsure**. On the phone, the status is the headline and the quote, citation, and explanation open from Learn more. Identical text is cached and does not count against the 3 new reviews per month. The rights assistant shows a short headline from the library (40 questions a month). The library paragraph opens from Learn more. Eviction-strategy questions hand off to legal aid and do not give steps. The full disclaimer, opened from every legal result, is:

> This is general legal information, not legal advice, and no attorney-client relationship is created. Laws change and depend on your facts. For advice, contact a licensed California attorney or legal aid.

## Mail, files, and reminders

Outbound landlord mail is sent from `u-<id>@RELAY_DOMAIN`, with the tenant on CC, and a no-account response link (acknowledge, schedule, fixed, dispute, block non-essential mail, or report abuse). The daily cap is 20 messages per unit. The footer is “Sent with Rent Right, free for renters.” Delivery status is stored on the message. Open events from the webhook are marked indicative only. Without Resend, status stays `local_only`.

Inbound mail: `POST /api/email/inbound` with `Authorization: Bearer $EMAIL_WEBHOOK_SECRET` and JSON `{ "from", "to", "subject", "text" }`. `to` must contain the unit’s `u-…` local part. Provider events: `POST /api/email/webhook` with the same bearer token.

Reminders run at 7 days, 3 days, and the due day (the due-day slot also fires one day late so a missed day is not dropped, and older slots are not replayed). Call `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` once a day.

Uploaded PDFs are read with `pdfjs-dist` when the file has selectable text. Photos are read only when `GEMINI_API_KEY` is set. Otherwise paste the lease text. Before any model call, email addresses, phone numbers, and SSN-like strings are redacted. A model may only attach a rule ID that already exists in the library, and only to a clause the deterministic pass left as unsure.

Demand letters and certified-mail letters are templates. The app does not send them. The tenant’s explanation must be at least 20 characters. The evidence packet is a factual compilation: it does not state liability, recommend a claim, or suggest strategy.

## Privacy

Settings includes a JSON export (`GET /api/export`) and account deletion. The confirmation word is `DELETE`. Deleting the last member of a unit deletes that unit’s records. A roommate who remains keeps the shared unit. Roommates join only by an invite link.

## Scripts

- `npm run dev` — API on port 3000
- `npm test` — rules engine, lease review, phone presentation, and RLS-schema tests (Vitest)
- `npm run lint` — ESLint for the server
- `npm run build` — production API build
- `cd mobile && npx expo start` — Expo Go, simulator, or web

SQLite prints an experimental warning from Node. That is expected on Node 22.

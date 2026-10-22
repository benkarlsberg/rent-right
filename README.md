# Rent Right

Free records and general legal information for renters in California. It is not a law firm. Nothing in the app is legal advice, and using it does not create an attorney-client relationship.

> This is general legal information, not legal advice, and no attorney-client relationship is created. Laws change and depend on your facts. For advice, contact a licensed California attorney or legal aid.

The short line on a result is “General information, not legal advice.”

**Live demo:** [demo link placeholder](https://demo.rentright.example) — not deployed yet. The URL will replace this once Cloudflare and Supabase secrets are set. See [What Ben needs to go live](#what-ben-needs-to-go-live).

## Screenshots

The phone opens on a chat. The sample Los Angeles tenancy is Maya Chen at 1842 N Echo Park Ave, Unit 3.

![Chat with the sample tenancy](docs/images/chat.webp)

A repair stays “Not sent” until the tenant confirms. After confirmation the card shows the email was saved, and nothing is sent unless Resend is configured.

![Repair email after confirmation](docs/images/repair-confirmed.webp)

![Records for the sample tenancy](docs/images/records.webp)

## Architecture

```mermaid
flowchart LR
  phone["Expo app\niOS, Android, web"]
  worker["Next.js API\nCloudflare Worker via OpenNext"]
  db["Supabase Postgres\nRLS on every tenant table"]
  auth["Supabase Auth\nmagic link"]
  mail["Resend\noptional"]
  model["Gemini\noptional"]
  files["Encrypted files\nlocal disk, R2, or private tenant-files bucket"]

  phone -->|"HTTPS /api/v1"| worker
  worker --> db
  worker --> auth
  worker --> mail
  worker --> model
  worker --> files
```

The Expo app is the renter interface. The Next.js server is the API: auth, the rules engine, Postgres, encryption, and landlord email. `http://localhost:3000` is a short note plus landlord reply links, terms, and privacy.

Deadlines, caps, and coverage come from the rules engine. A model may choose an intent or explain a library answer. It does not invent a date, a percentage, or a citation. Every result quotes a library rule ID or says unsure.

## Demo walkthrough

1. Start Postgres, migrate, and run the API (`docker compose up -d`, `npm run db:migrate`, `npm run dev`).
2. In `mobile/`, run `npx expo start` and open Expo web or Expo Go. The phone guide is [docs/PHONE_DEMO.md](docs/PHONE_DEMO.md).
3. On the welcome screen, tap **View a sample Los Angeles tenancy**. That resets `demo@rentright.local` (Maya Chen, 1842 N Echo Park Ave Unit 3, landlord Elena Vasquez).
4. The chat shows the repair, the rent increase, and the deposit cards. Open **Learn more** for the full disclaimer and the rule.
5. Describe a new repair, for example “The kitchen sink is leaking.” The card says **Not sent**. Nothing is emailed.
6. Tap **Send to landlord**. The card updates to **Saved** when Resend is unset. The message is stored on the Landlord tab. With Resend configured, the same confirmation is what actually sends it.
7. Paste a lease or use the sample lease. The review quotes a library rule ID or **Unsure**. Identical text is cached.

Magic links last 30 minutes. Without Resend and without Supabase, the phone signs you in directly. Limit is 5 links per email per hour.

## Feature status

| Feature | Status |
| --- | --- |
| Chat-first phone (Chat, Landlord, Records) | Done |
| Sample Los Angeles tenancy | Done |
| Email magic link (local HMAC, or Supabase Auth when configured) | Done |
| Unit profile and roommate invite | Done |
| Lease review grounded in the rules library | Done |
| Repair log with confirm-before-send | Done |
| Landlord relay email | Done locally; delivery needs Resend |
| Deadline tracker, deposit countdown, rent ledger | Done |
| Condition report and factual evidence packet | Done |
| Demand letter the tenant fills and sends themselves | Done |
| English and Spanish UI | Done |
| Statewide rules and local placeholder packs | Done, pending clinic review |
| Postgres, migrations, RLS, encrypted message bodies and files | Done |
| GitHub Actions CI | Done |
| Cloudflare Worker + Pages deploy | Configured; waits on secrets |
| Live public demo | Placeholder |
| Clinic-approved rule text and cap percentages | Later |
| Volunteer Spanish legal review | Later |
| Photo OCR | Placeholder unless `GEMINI_API_KEY` is set |
| Web push | Later (VAPID names are reserved) |
| Landlord ratings, SMS, referrals, paid features | Later — out of scope |

Every library entry is `placeholder: true`, `clinicReview: "pending_clinic_review"`, `spanishReview: "pending_volunteer_review"`, version `2026-10-12-draft1`. The phone shows “Rules pending clinic review.” Do not treat the percentages or clause labels as approved legal advice. Coverage is listed in [docs/COVERAGE.md](docs/COVERAGE.md).

## Local setup

Node.js 22.13 or newer.

```bash
npm install
cd mobile && npm install && cd ..
docker compose up -d
cp .env.example .env.local
npm run db:migrate
npm test
npm run dev
```

`DATABASE_URL` defaults to `postgres://rent:rent@127.0.0.1:5432/rent_right` when it is unset in development. Tests use `rent_right_test` on that same server so they do not wipe the dev database. Create it once:

```bash
docker compose exec postgres createdb -U rent rent_right_test
```

Seed only the synthetic sample tenancy:

```bash
npm run db:seed
```

In a second terminal:

```bash
cd mobile
npx expo start
```

Without Docker, point `DATABASE_URL` at any Postgres 16 database and run `npm run db:migrate`. On a hosted Supabase project, `supabase db push` applies `supabase/migrations`. The local auth stub in `supabase/local/00_auth.sql` is applied only when `auth.uid()` does not already exist, so it is not loaded on hosted Supabase.

Lease text is not stored in full. Message bodies and uploaded files are encrypted with AES-256-GCM before they are stored. Without `DATA_ENCRYPTION_KEY`, development uses a key derived from `AUTH_SECRET` and prints a warning. Production throws if either secret is missing.

The private storage bucket is `tenant-files`. Object names are `{user_id}/{file_id}`. Bytes stay encrypted by the app. Row level security is enabled on every tenant table and on that bucket.

## What Ben needs to go live

Create these accounts. Turn on MFA for Supabase and Cloudflare.

| Account | What to create |
| --- | --- |
| [Supabase](https://supabase.com) | Project. Auth email provider. Postgres. Run the migrations. Private bucket `tenant-files` (the migration creates the policies when the storage tables exist). |
| [Cloudflare](https://dash.cloudflare.com) | Account. API token with Workers and Pages edit permission. Note the account ID. |
| [Google AI Studio](https://aistudio.google.com) | Gemini API key. Optional. Paid tier so prompts are not used for training. |
| [Resend](https://resend.com) | API key and a verified from-address. Optional. Without it, mail is saved and not sent. |

`DATABASE_URL` must be the Supabase **postgres** connection string (direct, or the session pooler). The API sets the `authenticated` role per request so RLS applies. Do not use the anon key as `DATABASE_URL`. Do not put `SUPABASE_SERVICE_ROLE_KEY` in the Expo app or any `EXPO_PUBLIC_` / `NEXT_PUBLIC_` variable.

Add these as **GitHub Actions secrets** on the repository (Settings → Secrets and variables → Actions). The deploy workflow skips cleanly when any required secret is missing.

| GitHub secret | Required to deploy | Where it comes from |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `DATABASE_URL` | Yes | Supabase postgres URI |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `DATA_ENCRYPTION_KEY` | Yes | 32-byte base64 key you generate |
| `AUTH_SECRET` | Yes | Long random string you generate |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Supabase service role. Server only. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public API origin, also baked into the Expo web export as `EXPO_PUBLIC_API_URL` |
| `GEMINI_API_KEY` | Optional | Google AI Studio |
| `RESEND_API_KEY` | Optional | Resend |
| `RESEND_FROM` | Optional | Verified Resend from-address |
| `RELAY_DOMAIN` | Optional | Domain for `u-…@domain` relay addresses |
| `EMAIL_WEBHOOK_SECRET` | Optional | Bearer token for inbound mail and delivery webhooks |
| `CRON_SECRET` | Optional | Bearer token for `POST /api/cron/reminders` |

After the secrets exist, a push to `main` builds the OpenNext Worker, deploys it, exports Expo web, and deploys that static site to Cloudflare Pages project `rent-right-web`. CI on pull requests does not deploy. CI runs lint, typecheck, unit and integration tests against Postgres 16, `next build`, and `npx expo export --platform web`.

Workers reach Postgres over TCP. Use the Supabase session pooler (or Cloudflare Hyperdrive pointed at it) as `DATABASE_URL`. The transaction pooler on port 6543 is a poor fit for the role-switching the API does.

Generate the encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Environment

Copy `.env.example` to `.env.local`. Do not commit `.env.local`.

| Variable | Role |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Required in production. |
| `AUTH_SECRET` | Signs the local session token. Required in production. |
| `DATA_ENCRYPTION_KEY` | 32-byte base64 AES key. Required in production. |
| `NEXT_PUBLIC_APP_URL` | Absolute URL used in mail and response links. |
| `EXPO_PUBLIC_API_URL` | Set in `mobile/.env` when the phone cannot infer the API host. |
| `RELAY_DOMAIN` | Domain for `u-…@domain` relay addresses. |
| `RESEND_API_KEY`, `RESEND_FROM` | Outbound mail. Blank means the message is saved and marked `local_only`. |
| `EMAIL_WEBHOOK_SECRET` | Bearer token for inbound mail and provider webhooks. |
| `GEMINI_API_KEY` | Optional photo OCR and for filling clauses the library left as unsure. |
| `OPENAI_API_KEY` | Optional fallback when Gemini is unset. |
| `R2_*` | Optional Cloudflare R2. Blank stores encrypted blobs in `data/blobs/`. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Turn on Supabase Auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Mints magic links. Bypasses RLS if misused. |
| `CRON_SECRET` | Bearer token for the reminder job. |
| `VAPID_*` | Reserved. Web push is not wired. |

## Rules library

`lib/rules/library.ts` assembles version `2026-10-12-draft1`. Statewide rules are `lib/rules/cities/statewide.ts`. Each loaded city is one file under `lib/rules/cities/` that exports `pack`. Statute text for the statewide rent cap is Civil Code §1947.12.

### Adding a city

Hand-written packs for the City of Los Angeles, unincorporated Los Angeles County, and the City of San Diego stay in their own files. Every other loaded ordinance is a record in `lib/rules/cities/catalog.ts`.

1. Add a record to `ORDINANCES`. Cite the official page in `sourceUrl`. Set `effectiveDate` only when that page states one.
2. Set `capStatus` to `"published"` only when the Attorney General chart, or the official page, states one percentage and the window it belongs to. Copy that figure. Do not invent one.
3. Regenerate `docs/COVERAGE.md` with `npx tsx scripts/render-coverage.ts` so the coverage test stays in lockstep.

The deterministic engine owns dates and rent caps.

- Deposit return is 21 calendar days from move-out (Civil Code §1950.5), rule `CA-CC-1950.5`.
- A rent increase of 10% or less uses a 30-day notice; above 10% uses 90 days (§827).
- AB 1482 percentages are stored by period and county area. A date outside the table is unsure.
- A claimed exemption does not change an over-cap result into within-cap.
- If jurisdiction or coverage is unknown, the checker does not state a single allowed rent.

Lease review quotes the clause and cites a library rule ID, or it says **unsure**. Eviction-strategy questions hand off to legal aid and do not give steps.

## Mail, files, and reminders

Outbound landlord mail is sent from `u-<id>@RELAY_DOMAIN`, with the tenant on CC, and a no-account response link. The daily cap is 20 messages per unit. Nothing is emailed until the tenant confirms. Without Resend, status stays `local_only`.

Inbound mail: `POST /api/email/inbound` with `Authorization: Bearer $EMAIL_WEBHOOK_SECRET`. Provider events: `POST /api/email/webhook` with the same bearer token.

Reminders run at 7 days, 3 days, and the due day. Call `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` once a day.

Demand letters and certified-mail letters are templates. The app does not send them. The evidence packet is a factual compilation: it does not state liability, recommend a claim, or suggest strategy.

## Privacy

Settings includes a JSON export (`GET /api/export`) and account deletion. The confirmation word is `DELETE`. Deleting the last member of a unit deletes that unit’s records. A roommate who remains keeps the shared unit.

## Scripts

- `npm run dev` — API on port 3000
- `npm run db:migrate` — apply `supabase/migrations`
- `npm run db:seed` — synthetic Los Angeles sample only
- `npm test` — unit tests plus Postgres isolation and workflow tests
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — production API build
- `cd mobile && npx expo export --platform web` — static phone web build

# Rent Right

Free records and general legal information for renters in California. It is not a law firm. Nothing in the app is legal advice, and using it does not create an attorney-client relationship.

> This is general legal information, not legal advice, and no attorney-client relationship is created. Laws change and depend on your facts. For advice, contact a licensed California attorney or legal aid.

The short line on a result is “General information, not legal advice.”

**Live demo:** [https://app.rentrightportal.com](https://app.rentrightportal.com). The API is [https://api.rentrightportal.com](https://api.rentrightportal.com).

## Screenshots

Phone-width pictures of the current app. Sign-in, privacy, and terms are [the live app](https://app.rentrightportal.com). The signed-in screens are the sample Los Angeles tenancy only: Maya Chen, 1842 N Echo Park Ave, Unit 3, landlord Elena Vasquez.

![Sign in with Google or email](docs/images/sign-in.webp)

The welcome screen shows the mark, **Continue with Google**, and **Email me a sign-in link**. Privacy and Terms are linked under the form.

![Where do you rent](docs/images/onboarding.webp)

A new account starts with the address. There are five short steps. **Do this later** skips them. Nothing is emailed while you fill this in.

![Chat for the sample tenancy](docs/images/chat.webp)

Chat is the home tab. A repair stays unsent until the tenant confirms. **Your next steps** sits at the end of the conversation.

![Landlord conversation](docs/images/landlord.webp)

The Landlord tab is that conversation, with the time on each message. Opening it does not send mail.

![Records, with next steps](docs/images/records.webp)

Records opens with **Your next steps** and the English / Español switch.

![A labeled date and a tenant reminder](docs/images/records-reminder.webp)

Each date card names what it is for, what started it, who owes what, and the due date. **Learn more** opens the library rule. **Your reminder** is the tenant’s own nudge. It does not change the computed date. **Edit reminder date** saves a different day, and **Add a reminder** adds one from scratch.

![Export my evidence packet](docs/images/records-export.webp)

**Export my evidence packet** downloads a timestamped PDF of the requests, notices, replies, and dates. The packet says it is a record of communications, not legal advice and not a court filing. The footer points to the California courts small-claims self-help page.

![Records in Spanish](docs/images/records-spanish.webp)

The same screen in Spanish. Words the tenant typed stay as they were written.

![Privacy policy](docs/images/privacy.webp)

![Terms of use](docs/images/terms.webp)

Privacy and terms are pages of their own: [app.rentrightportal.com/privacy](https://app.rentrightportal.com/privacy) and [app.rentrightportal.com/terms](https://app.rentrightportal.com/terms).

## Architecture

```mermaid
flowchart LR
  phone["Expo app\niOS, Android, web"]
  worker["Next.js API\nCloudflare Worker via OpenNext"]
  db["Supabase Postgres\nRLS on every tenant table"]
  auth["Supabase Auth\nemail link or Google"]
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

Open [https://app.rentrightportal.com](https://app.rentrightportal.com).

1. Sign in with **Continue with Google** or **Email me a sign-in link**. The link lasts 30 minutes. Privacy and Terms are on the welcome screen.
2. The first time, the app asks where you rent, then the unit, the landlord, optional lease dates, and a short note on which rules apply to that address. **Do this later** leaves chat available. Nothing is emailed during these steps.
3. Chat is the home tab. Describe a leak, a rent increase, or a deposit. A repair card stays **Not sent** until you tap **Send to landlord**. That confirmation is what emails the landlord, and only when mail delivery is configured.
4. **Landlord** shows the thread: messages you sent and replies, each with a time. **Your next steps** is at the end of chat, with at most three actions. Waiting sends nothing. Follow-up opens the Landlord tab and still waits for confirmation.
5. **Records** lists those next steps at the top. Deadline cards name the follow-up or the deposit accounting date, who owes what, and the due date. **Learn more** quotes the library rule. **Edit reminder date** saves your own nudge and leaves the computed date unchanged. **Export my evidence packet** downloads `rent-right-evidence-YYYY-MM-DD.pdf`.
6. Switch **English / Español** on Records. The labels follow that choice.
7. Read [Privacy](https://app.rentrightportal.com/privacy) and [Terms](https://app.rentrightportal.com/terms).

To walk the sample tenancy on your own computer, start Postgres, migrate, and run the API (`docker compose up -d`, `npm run db:migrate`, `npm run dev`). In `mobile/`, run `EXPO_PUBLIC_DEMO=1 npx expo start`. Tap **View a sample Los Angeles tenancy**. That resets the sample account for Maya Chen at 1842 N Echo Park Ave, Unit 3, landlord Elena Vasquez. The sample button is hidden unless that flag is set. The phone guide is [docs/PHONE_DEMO.md](docs/PHONE_DEMO.md).

Without Resend and without Supabase, a local sign-in completes in the app. The limit is 5 links per email per hour.

## Feature status

| Feature | Status |
| --- | --- |
| Chat, Landlord conversation, and Records | Done |
| Sign-in with email or Google | Done on [the live app](https://app.rentrightportal.com) |
| First-run address steps, with skip | Done |
| Sample Los Angeles tenancy | Done, local only (`EXPO_PUBLIC_DEMO=1`) |
| Unit profile and roommate invite | Done |
| Lease review grounded in the rules library | Done |
| Repair log with confirm-before-send | Done |
| Landlord relay email | Done; delivery needs Resend |
| Labeled deadlines, tenant reminders, and next steps | Done |
| Deposit countdown and rent ledger | Done |
| Evidence packet PDF | Done. A record of communications, not a court filing |
| Demand letter the tenant fills and sends themselves | Done |
| English and Spanish, switched on Records | Done |
| Privacy and terms pages | Done |
| Statewide rules and local placeholder packs | Done, pending clinic review |
| Postgres, migrations, RLS, encrypted message bodies and files | Done |
| GitHub Actions CI | Done |
| Cloudflare Worker and Pages | Live |
| Public app | [https://app.rentrightportal.com](https://app.rentrightportal.com) |
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

`DATABASE_URL` must be the Supabase **postgres** connection string (direct, or the session pooler). A database password is also accepted: deploy turns it into the session pooler URI using `SUPABASE_URL`. The API sets the `authenticated` role per request so RLS applies. `SUPABASE_ANON_KEY` accepts the publishable key (`sb_publishable_…`). `SUPABASE_SERVICE_ROLE_KEY` accepts the secret key (`sb_secret_…`) and stays on the server. Do not put that secret in the Expo app or any `EXPO_PUBLIC_` / `NEXT_PUBLIC_` variable. Set `NEXT_PUBLIC_APP_URL` to `https://app.rentrightportal.com`. When that secret is empty, deploy uses the same URL. In the Supabase Auth settings, allow `https://app.rentrightportal.com/auth/verify` as a redirect URL.

Google sign-in is off until `EXPO_PUBLIC_GOOGLE_AUTH` is `1`. That value is a GitHub Actions variable or secret of the same name. Leave it unset until the provider is configured. Then set it to `1` and run Deploy.

1. Google Cloud console → APIs & Services → Credentials → Create credentials → OAuth client ID → Application type **Web application**.
2. Authorized redirect URI: `https://ijpkxcsnkqgmxkvykzrs.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google. Turn it on. Paste the client ID and client secret.
4. Supabase → Authentication → URL Configuration → Redirect URLs. Add `https://app.rentrightportal.com/auth/verify`.

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
| `NEXT_PUBLIC_APP_URL` | Recommended | `https://app.rentrightportal.com`. Sign-in, invite, and reply links. |
| `GEMINI_API_KEY` | Optional | Google AI Studio |
| `RESEND_API_KEY` | Optional | Resend |
| `RESEND_FROM` | Optional | Verified Resend from-address |
| `RELAY_DOMAIN` | Optional | `rentrightportal.com`. Deploy uses this when the secret is empty. |
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
| `NEXT_PUBLIC_APP_URL` | Absolute URL used in mail and response links. Production value: `https://app.rentrightportal.com`. |
| `EXPO_PUBLIC_API_URL` | Set in `mobile/.env` when the phone cannot infer the API host. |
| `RELAY_DOMAIN` | Domain for `u-…@domain` relay addresses. Production value: `rentrightportal.com`. |
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

Outbound landlord mail uses `From: RESEND_FROM` and `Reply-To: u-<id>@RELAY_DOMAIN`, with the tenant on CC and a no-account response link. Set `RESEND_FROM` to `Rent Right <notices@rentrightportal.com>` and `RELAY_DOMAIN` to `rentrightportal.com`. The local part is `u-` plus eight letters or digits, generated per unit. The daily cap is 20 messages per unit. Nothing is emailed until the tenant confirms. Without Resend, status stays `local_only`. Tenant mail is sent only when both `RESEND_API_KEY` and `RESEND_FROM` are set.

Inbound mail is a JSON POST, not a Cloudflare Email Routing message and not a Resend Svix webhook. `POST /api/email/inbound` with `Authorization: Bearer $EMAIL_WEBHOOK_SECRET` and `{ "from", "to", "subject", "text" }`. `to` may be a string or a list. The handler stores the message when `to` contains `u-` plus letters or digits and that local part belongs to a unit. Anything else returns 202. Delivery events: `POST /api/email/webhook` with the same bearer and `{ "type", "data": { "email_id" } }` (or `data.id`). `type` is `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.opened`, or `email.complained`.

Cloudflare Email Routing can forward that JSON. Catch-all rules exist on the apex domain only, so the relay domain is `rentrightportal.com`. The Worker in `email/` is `rent-right-mail`. Deploy publishes it when `EMAIL_WEBHOOK_SECRET` is set. It POSTs `{ "from", "to", "subject", "text" }` to `https://api.rentrightportal.com/api/email/inbound` with `Authorization: Bearer $EMAIL_WEBHOOK_SECRET`. Add a custom address for `notices@rentrightportal.com` that drops mail, and point the catch-all at `rent-right-mail`. Enabling Email Routing writes the apex MX records and an apex SPF TXT for `include:_spf.mx.cloudflare.net`. Leave the Resend records on `send` as they are (`TXT v=spf1 include:amazonses.com ~all` and the `send` MX). If that wizard edits an apex SPF TXT, keep `include:_spf.mx.cloudflare.net` and do not remove an `include:amazonses.com` that was already on the apex. Those DNS changes need the dashboard, or Zone → DNS → Edit on the API token.

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

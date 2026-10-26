# Sign in with Apple

The app shows **Continue with Apple** only when the build flag `EXPO_PUBLIC_APPLE_AUTH` is `1`. On iPhone it uses the system Apple button and `expo-apple-authentication`. The identity token is sent to `POST /api/v1/auth/apple`, and the API exchanges it with Supabase `signInWithIdToken`. On the web, the button opens `/auth/apple`, which starts Supabase’s Apple OAuth redirect and returns to `/auth/verify`.

The preview and production profiles in `mobile/eas.json` set `EXPO_PUBLIC_APPLE_AUTH` to `1`. Deploy reads that file when no GitHub variable is set.

The bundle id in `mobile/app.json` is `com.rentrightportal.app`. The Apple Developer account is approved. Team ID: `B5RNR69S8U`. That id is set as `appleTeamId` on `submit.production.ios` in `mobile/eas.json`, and as `ios.appleTeamId` in `mobile/app.json` so EAS Build uses the same team.

Nothing in this file is a secret. Do not commit the `.p8` file, the generated client secret, or a private key.

## Apple Developer (only you can do this)

1. Open [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Register an **App ID**.
   - Description: Rent Right
   - Bundle ID, explicit: `com.rentrightportal.app`
   - Capability: **Sign in with Apple**
   - Leave the server-to-server notification endpoint blank. Supabase Auth does not use it.
3. Register a **Services ID** for the website.
   - Identifier: `com.rentrightportal.app.signin`
   - Enable **Sign in with Apple** and configure it against the App ID above.
   - Domains: `ijpkxcsnkqgmxkvykzrs.supabase.co`
   - Return URL: `https://ijpkxcsnkqgmxkvykzrs.supabase.co/auth/v1/callback`
4. Open **Keys** and create a key with **Sign in with Apple** enabled for that App ID.
   - Download `AuthKey_<Key ID>.p8` once. Apple will not offer it again.
   - Write down the **Key ID** (10 characters). The Team ID is `B5RNR69S8U`.
5. If people choose Hide My Email, Apple relays mail through a private address. Under **Services** → **Sign in with Apple for Email Communication**, register the email sources you send from. The app’s sign-in mail uses the address already configured for Resend.

## Supabase (only you can do this)

Project: Authentication → **Providers** → **Apple**. Turn the provider on.

| Dashboard field | What to enter |
| --- | --- |
| Client IDs | `com.rentrightportal.app.signin,com.rentrightportal.app` |
| Secret Key (for OAuth) | The client secret generated from the `.p8` (see below). This is for the web redirect. |
| Team ID | `B5RNR69S8U` |
| Key ID | The id of the Sign in with Apple key you created |

The **Services ID must be the first** Client ID. Supabase uses the first id for the web OAuth redirect. Native sign-in accepts any id in the list as the token audience. If the App ID is first, the iPhone button can work while the website is rejected by Apple.

Callback URL shown by Supabase: `https://ijpkxcsnkqgmxkvykzrs.supabase.co/auth/v1/callback`. It must match the Services ID return URL.

Generate the OAuth client secret on Supabase’s Apple guide (“generate a new Apple client secret”). The tool stays in the browser. Enter Team ID `B5RNR69S8U`, the Key ID, the Services ID `com.rentrightportal.app.signin`, and the contents of the `.p8`. Paste the generated secret into **Secret Key**. Do not put that secret in git.

Also confirm these existing Worker secrets are still set. The native exchange uses the anon key. Account deletion uses the service role.

- `SUPABASE_URL` = `https://ijpkxcsnkqgmxkvykzrs.supabase.co`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## After it works

`EXPO_PUBLIC_APPLE_AUTH` is `1` on the preview and production profiles in `mobile/eas.json`. The deploy workflow reads that value when the GitHub variable is empty, then exports the website. The iPhone build also needs the App ID capability, which `usesAppleSignIn` already requests in `mobile/app.json`. EAS Build signs that entitlement with your Apple team. The on-device name is `Rent Right` (`CFBundleDisplayName`). App Store Connect can keep the record name Rent Right Portal.

Official references: [Supabase Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) and [Expo Apple Authentication](https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/).

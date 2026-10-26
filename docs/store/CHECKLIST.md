# Store checklist

The repo can build the app. The accounts, signatures, and store forms below have to be done by you. Do them in order. Commands are run from the `mobile` directory unless a step says otherwise.

Bundle id and package name: `com.rentrightportal.app`. Apple Team ID: `B5RNR69S8U` (already in `mobile/eas.json`). The Apple Developer membership is approved.

## 1. Accounts

1. The Apple Developer account for team `B5RNR69S8U` is approved. Expo Go still cannot ship Sign in with Apple or the App Store build.
2. Create a [Google Play Console](https://play.google.com/console) developer account if you do not have one yet.
3. Install the EAS CLI on your computer: `npm install -g eas-cli`.
4. Sign in: `eas login`.
5. From `mobile`, run `eas init` and accept the project it links. That writes the EAS project id into the app config. Commit that id.

## 2. Sign in with Apple

Follow [docs/apple-sign-in.md](../apple-sign-in.md). In the Apple Developer portal, still to do:

1. Identifiers → App ID `com.rentrightportal.app` with the Sign in with Apple capability. Leave the server-to-server endpoint blank.
2. Identifiers → Services ID `com.rentrightportal.app.signin`, Sign in with Apple enabled, domain `ijpkxcsnkqgmxkvykzrs.supabase.co`, return URL `https://ijpkxcsnkqgmxkvykzrs.supabase.co/auth/v1/callback`.
3. Keys → a Sign in with Apple key. Download the `.p8` once and keep the Key ID.

Then in Supabase → Authentication → Providers → Apple, enter Team ID `B5RNR69S8U`, that Key ID, Client IDs `com.rentrightportal.app.signin,com.rentrightportal.app` (Services ID first), and the secret generated from the `.p8`. Preview and production builds, and the website deploy, read `EXPO_PUBLIC_APPLE_AUTH` from `mobile/eas.json`.

## 3. Reviewer login

Create three GitHub Actions secrets on this repository. Deploy copies them onto the Worker when they are present. Leave them unset until you are ready for review.

| Secret | Value |
| --- | --- |
| `REVIEWER_LOGIN` | `1` |
| `REVIEWER_EMAIL` | One address you choose for reviewers. It is not accepted for any other account. |
| `REVIEWER_CODE` | A code of at least 8 characters. The same code is reused so a reviewer can sign in again. |

The code is not a bypass. A different email is rejected even if the code matches. After eight tries in an hour, that address has to wait. The session opens the sample home (Maya Chen, 1842 N Echo Park Ave, Unit 3). That home does not email a landlord.

Put the email and the code in the App Store and Play review notes, using the template in [LISTING.md](LISTING.md). Do not put them in git.

## 4. Build

From `mobile`, with the API already deployed:

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

`preview` and `development` in `eas.json` are internal builds for TestFlight-style installs and your own devices. `EXPO_PUBLIC_API_URL` is `https://api.rentrightportal.com` in all three profiles.

The first iOS build asks you to sign in with the Apple ID for team `B5RNR69S8U` and to let EAS create the distribution certificate and provisioning profile. Accept that. The App ID must include Sign in with Apple before this build, because `mobile/app.json` sets `usesAppleSignIn`. That same file sets `appleTeamId` to `B5RNR69S8U` for the build. `eas.json` sends the team id on submit.

The first Android build asks you to let EAS create the upload keystore. Let EAS store it. Download a copy for yourself from the Expo website and keep it outside git.

## 5. TestFlight

1. In App Store Connect, create the app record **Rent Right** with bundle id `com.rentrightportal.app` on team `B5RNR69S8U`. The portal App ID has to exist before this record can be created.
2. `eas submit --platform ios --profile production` and choose the build from step 4. Or let `eas build` submit when it offers to.
3. Wait until the build finishes processing, then open TestFlight and add yourself as an internal tester.
4. Install from the TestFlight email and walk through sign-in, a sample question, Settings → Delete account (use a throwaway account, not the reviewer sample), and the evidence packet.

## 6. Store forms

Fill App Store Connect and Play Console from [LISTING.md](LISTING.md).

- Privacy URL: https://app.rentrightportal.com/privacy
- Account deletion URL: https://app.rentrightportal.com/delete-account
- Age rating: 4+ / Everyone, using the answers in the listing doc
- Apple privacy nutrition label and Google Data safety: use the tables in the listing doc
- Review notes: include the reviewer email and code
- Encryption: the app only uses standard HTTPS. `ITSAppUsesNonExemptEncryption` is already false, so answer that you do not use non-exempt encryption.

Play also asks for a content rating questionnaire and for screenshots. Capture those on a phone or simulator after TestFlight looks right. The README screenshots are a separate pass.

## 7. Submit

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Android `submit.production` uses the internal testing track. Promote that release to production in Play Console when you want it public.

iOS submit needs an App Store Connect app, and EAS will ask for an app-specific password or an App Store Connect API key. Create the API key under Users and Access → Integrations → App Store Connect API. Store the `.p8`, the key id, and the issuer id in EAS when it prompts you. Do not commit them.

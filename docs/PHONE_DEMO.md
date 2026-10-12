# Run the Rent Right demo on your phone

This guide is for someone who does not write code. You will start two programs on your computer, open the app on your iPhone or Android phone, and tap one button to see a sample Los Angeles tenancy.

The sample itself needs no Rent Right account, API key, or cloud service. The records stay on your computer. A physical iPhone does need a free Expo account so Expo Go can open the project. That step is below.

Keep two terminal windows open the whole time. Closing either one stops the demo.

## What to install first

1. **Node.js 22.13 or newer.** Download the installer from [nodejs.org](https://nodejs.org/). Version 24.3 or newer also works. The records server uses Node’s built-in SQLite (`node:sqlite` in `lib/db.ts`), which these versions include. After installing, open a terminal and run:

   ```bash
   node -v
   npm -v
   ```

   `node -v` should print `v22.13` or a higher number (for example `v22.14.0` or `v24.3.0`). `npm` comes with Node.

2. **Git.** Download it from [git-scm.com/downloads](https://git-scm.com/downloads). Check with:

   ```bash
   git --version
   ```

3. **Expo Go on the phone.** This demo is Expo SDK 57 (`"expo": "~57.0.28"` in `mobile/package.json`). The Expo Go app on the phone has to be the SDK 57 build. An older build shows “Project is incompatible with this version of Expo Go.”

   - **Android:** Install [Expo Go from the Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) and update it. If the phone later says the project needs a newer Expo Go, the Play Store copy is behind SDK 57. On the computer, run:

     ```bash
     npx expo-go url android 57
     ```

     That prints a download link for an `.apk` file (the SDK 57 Expo Go app). Open that link on the Android phone and install it. If Android says Expo Go is already installed, uninstall the Play Store copy first, then install the SDK 57 file. Android may ask you to allow installs from the browser.

   - **iPhone:** Install [Expo Go from the App Store](https://apps.apple.com/app/expo-go/id982107779) and update it. The current App Store version is Expo Go 57, which matches this demo. If the phone says the project is incompatible, the installed copy is older than SDK 57. Update it from the App Store. If the store still offers an older SDK, Expo’s fallback is an Apple Developer Program membership and this command on the computer:

     ```bash
     npx eas-cli@latest go
     ```

     Install [TestFlight](https://apps.apple.com/app/testflight/id899247664), add yourself as an internal tester, and install that build from the TestFlight email. The steps are in [Expo’s environment guide](https://docs.expo.dev/get-started/set-up-your-environment/) and the [version-mismatch page](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/).

     On a physical iPhone, Expo Go opens a project only when the computer and the phone are signed into the same free Expo account. On the computer, from the `mobile` folder after you have cloned the project:

     ```bash
     npx expo login
     ```

     A free account is at [expo.dev/signup](https://expo.dev/signup). In Expo Go, tap the account icon in the top-right corner and sign in with that same account. If the phone shows an account error, follow [“You need to be signed in to Expo Go and Expo CLI”](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required.md).

     `npx expo-go url ios 57` downloads a simulator archive (a `.tar.gz`). A phone cannot install that file.

## 1. Download the project

```bash
git clone https://github.com/benkarlsberg/rent-right.git
cd rent-right
```

Look for a folder named `mobile`. If it is missing, the phone demo is still on the pull-request branch. Run:

```bash
git checkout cursor/rent-right-mvp-2143
```

You should now see `mobile` next to `package.json`.

## 2. Install the project

Stay in the `rent-right` folder (the one that contains `package.json` and `mobile`):

```bash
npm install
cd mobile
npm install
cd ..
```

You can leave the API keys blank. The sample runs without them. Copying the template is optional:

```bash
cp .env.example .env.local
```

On Windows PowerShell, that copy is `Copy-Item .env.example .env.local`.

## 3. Start the records server

In the `rent-right` folder:

```bash
npm run dev
```

That command is `next dev -H 0.0.0.0`. The server listens on every network interface, on **port 3000**, so the phone can reach it. Leave this window open.

Node 22 prints `ExperimentalWarning: SQLite is an experimental feature`. That warning is expected. The server is still running.

On the computer, open [http://localhost:3000](http://localhost:3000). The page says “The app is on your phone.”

## 4. Start the phone app

Open a **second** terminal. From the `rent-right` folder:

```bash
cd mobile
npx expo start
```

A QR code appears. Expo uses your local network (LAN) and port **8081**. The address under the code looks like `exp://192.168.x.x:8081`. Leave this window open too.

## 5. Put the phone and the computer on the same Wi-Fi

Use the same home or office network for both. A guest network often blocks a phone from talking to a computer. If the network blocks it, turn on the phone’s hotspot and connect the computer to that hotspot, then start Expo again.

## 6. Tell the app your computer’s address, when you need to

Skip this step the first time. With `EXPO_PUBLIC_API_URL` unset, the app takes the computer address Expo already printed and calls port 3000 on it (`mobile/src/api.ts`). That is the right address when the QR code shows something like `exp://192.168.1.20:8081`.

Set the address when any of these happen:

- The QR code says `localhost` or `127.0.0.1`.
- **View a sample Los Angeles tenancy** shows an error.
- You start Expo with `--tunnel` (see Troubleshooting).

Find the computer’s Wi-Fi address:

- **Mac:** `ipconfig getifaddr en0`  
  If that prints nothing, try `ipconfig getifaddr en1`.
- **Windows:** run `ipconfig` and copy the **IPv4 Address** on the Wi-Fi adapter (it looks like `192.168.1.20`).
- **Linux:** `hostname -I` and use the first address.

Create a file named `.env` inside the `mobile` folder. One line, with your address and no slash at the end:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
```

Replace `192.168.1.20` with the address you found. This is the phone’s setting. It is separate from `.env.local` in the `rent-right` folder, which is the server’s file and can stay empty. Git ignores `mobile/.env`.

Stop Expo with Ctrl+C, then start it again so it reads the file:

```bash
npx expo start -c
```

`-c` clears the bundler cache. Expo bakes `EXPO_PUBLIC_API_URL` into the app when it starts, so a running Expo window keeps the old address until you restart it.

Check from the phone’s browser: open `http://192.168.1.20:3000` (your address). You should see “The app is on your phone.” If that page does not load, the sample button cannot load either. Fix the Wi-Fi or the firewall before scanning the code again.

## 7. Scan the QR code

- **iPhone:** Open the Camera app, point it at the QR code in the Expo terminal, and tap the banner. It opens in Expo Go.
- **Android:** Open Expo Go and tap **Scan QR code**. The Android camera often does not hand the code to Expo Go.

The first open can take a minute. The screen should say **Rent Right** and **Free for LA and San Diego renters.**

## 8. Open the sample

Tap **View a sample Los Angeles tenancy**.

That button calls `POST /api/v1/auth/demo` on your computer and opens a sample home for 1842 N Echo Park Ave, Unit 3. You do not type an email. Tapping it again resets the same sample.

You should land on Home and see short status cards (a repair date, a deposit date, a rent check). The tabs along the bottom are Home, Log, Chat, Dates, and More.

## Troubleshooting

### The QR code never connects: tunnel mode

Public Wi-Fi and some routers block the phone from reaching port 8081. Stop Expo (Ctrl+C) and, in the `mobile` folder, install the tunnel helper and start again:

```bash
npm i -g @expo/ngrok
npx expo start --tunnel
```

If the install says `EACCES`, on Mac or Linux run `sudo npm i -g @expo/ngrok` and then the same `npx expo start --tunnel`.

`--tunnel` is the same as `--host tunnel`. Expo then serves the app through a public address so the phone can download the screens. Scan the new QR code.

Set `EXPO_PUBLIC_API_URL` to `http://YOUR_LAN_IP:3000` before you do this, then restart with the tunnel command. Tunnel publishes Expo’s port. It does not publish the records server on port 3000. If the phone’s browser cannot open `http://YOUR_LAN_IP:3000`, the sample button still fails while the screens load. Use the phone’s hotspot, or allow port 3000 through the firewall, so the phone can reach the computer for that port.

Tunnel is slower than the same Wi-Fi. Use it when the QR code cannot connect.

### Firewall

Allow incoming connections for Node.js on a private network, for port **3000** (records) and port **8081** (Expo).

- **Mac:** When macOS asks to allow incoming connections for `node`, choose Allow. The switch is under System Settings → Network → Firewall.
- **Windows:** When Windows Security asks, allow Node.js on private networks.
- **Linux (ufw):**

  ```bash
  sudo ufw allow 3000/tcp
  sudo ufw allow 8081/tcp
  ```

### Port 3000

`npm run dev` uses port 3000. The phone calls that port unless `EXPO_PUBLIC_API_URL` names a different one. If the terminal says port 3000 is already in use, quit the other program using it and run `npm run dev` again.

If the server prints a URL on another port, either free port 3000, or set `EXPO_PUBLIC_API_URL` to that same port (`http://192.168.1.20:3001` if the server chose 3001) and restart Expo with `-c`.

### Clear the cache

From the `mobile` folder:

```bash
npx expo start -c
```

On the phone, shake it to open the developer menu and tap **Reload**.

### “Project is incompatible with this version of Expo Go”

The phone’s Expo Go and this project’s SDK do not match. This project is SDK 57.

- **Android:** Run `npx expo-go url android 57`, install that `.apk`, uninstall the older Expo Go if Android asks, then run `npx expo start` again.
- **iPhone:** Update Expo Go from the App Store so it is version 57. If the store copy is still an older SDK, use the TestFlight fallback at the top of this guide (`npx eas-cli@latest go`).

More detail: [Expo Go version mismatch](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/).

### The sample button says it could not open the sample

The phone reached Expo and did not reach the records server.

1. The first terminal should still be running `npm run dev`.
2. On the phone’s browser, open `http://YOUR_LAN_IP:3000`. The page should say “The app is on your phone.”
3. If that page fails, the phone and computer are on different networks, or a firewall is blocking port 3000.
4. If that page works and the button still fails, set `EXPO_PUBLIC_API_URL` in `mobile/.env` and restart with `npx expo start -c`.

### iPhone says you must be signed in

Run `npx expo login` in the `mobile` folder. In Expo Go, sign in with the same account from the account icon. Tap **Try Again** on the error, or scan the QR code again. See [Expo Go sign-in required](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required.md).

import { spawn } from "node:child_process";

const env = {
  ...process.env,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || "https://api.rentrightportal.com",
  EXPO_PUBLIC_APPLE_AUTH: process.env.EXPO_PUBLIC_APPLE_AUTH || "1",
  EXPO_PUBLIC_GOOGLE_AUTH: process.env.EXPO_PUBLIC_GOOGLE_AUTH || "1",
};

const child = spawn(
  "npx",
  ["eas-cli", "update", "--channel", "production", "--environment", "production", ...process.argv.slice(2)],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

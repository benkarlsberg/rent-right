import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3eee4",
        ink: "#1b2430",
        mute: "#5c6570",
        pine: {
          DEFAULT: "#0f5c4c",
          dark: "#0c3d34",
          soft: "#e5f3ee",
        },
        clay: {
          DEFAULT: "#b85a32",
          soft: "#f8efe8",
        },
        sand: "#fffdf8",
        line: "#e3d7c6",
        gold: {
          DEFAULT: "#8a5a12",
          soft: "#fbf4e6",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(27, 36, 48, 0.04), 0 12px 32px rgba(80, 55, 20, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;

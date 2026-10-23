import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F8FAF9",
        ink: "#14343C",
        mute: "#3D5A62",
        pine: {
          DEFAULT: "#0B5C6E",
          dark: "#084555",
          soft: "#E7F5F2",
        },
        accent: "#14A38B",
        clay: {
          DEFAULT: "#b85a32",
          soft: "#f8efe8",
        },
        sand: "#FFFFFF",
        line: "#D5E3E4",
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

import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111114", muted: "#6E6E73", faint: "#A1A1A6",
        line: "#ECECEE", accent: "#0E9D5A", accentSoft: "#E7F6EE",
      },
    },
  },
  plugins: [],
};
export default config;

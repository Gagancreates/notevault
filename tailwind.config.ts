import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      colors: { ink: "#14161c", accent: { DEFAULT: "#3d5afe", soft: "#eef1ff" } },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBF8F1",
        ink: "#1E2A26",
        muted: "#5F736B",
        mist: "#EAF0EB",
        canopy: {
          50: "#EDF5F1",
          100: "#D9E9E3",
          200: "#B7D2C7",
          500: "#177A62",
          600: "#0E6B55",
          700: "#0B5947",
        },
        marigold: {
          50: "#FDF6E8",
          100: "#FBEDCE",
          300: "#F7C65C",
          500: "#F2B23E",
          600: "#E69A17",
          700: "#A16207",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,42,38,0.05), 0 10px 30px -14px rgba(30,42,38,0.18)",
        lift: "0 16px 40px -16px rgba(14,107,85,0.35)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        wave: "wave 1.1s ease-in-out infinite",
        pop: "pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** “Runs from server .env” — privacy / no workspace key (see CURSOR_AI_PROVIDER_SETTINGS_GUIDE) */
        aiLocal: {
          DEFAULT: "#10b981",
          foreground: "#022c22",
          muted: "#6ee7b7",
          border: "#34d399",
          ring: "#34d399",
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          700: "#047857",
          900: "#064e3b",
        },
        /** “Workspace API keys” — remote OpenAI / Gemini */
        aiCloud: {
          DEFAULT: "#6366f1",
          foreground: "#e0e7ff",
          muted: "#a5b4fc",
          border: "#818cf8",
          ring: "#818cf8",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          700: "#4338ca",
          900: "#312e81",
        },
      },
    },
  },
  plugins: [],
};

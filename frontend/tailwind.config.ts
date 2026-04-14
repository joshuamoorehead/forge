import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          bg:           "#0c0c0e",
          "bg-raised":  "#151518",
          card:         "#1a1a1f",
          "card-hover": "#222228",
          border:       "#2a2a30",
          "border-light": "#36363e",
          text:         "#ececef",
          secondary:    "#9898a0",
          muted:        "#5c5c66",
          accent:       "#6b9fce",
          "accent-dim": "rgba(107, 159, 206, 0.10)",
          success:      "#5bbf8e",
          warning:      "#d4a34a",
          error:        "#d45858",
        },
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],       // 11px
        xs:    ["0.75rem",   { lineHeight: "1rem" }],        // 12px
        sm:    ["0.8125rem", { lineHeight: "1.25rem" }],     // 13px
        base:  ["0.875rem",  { lineHeight: "1.375rem" }],    // 14px
        lg:    ["1rem",      { lineHeight: "1.5rem" }],      // 16px
        xl:    ["1.25rem",   { lineHeight: "1.75rem" }],     // 20px
        "2xl": ["1.5rem",    { lineHeight: "2rem" }],        // 24px
      },
      fontFamily: {
        sans: [
          "system-ui", "-apple-system", "BlinkMacSystemFont",
          "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)", "SF Mono", "Menlo",
          "Monaco", "Consolas", "monospace",
        ],
      },
      maxWidth: {
        content: "1400px",
      },
    },
  },
  plugins: [],
};

export default config;

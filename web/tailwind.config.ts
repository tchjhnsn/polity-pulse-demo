import type { Config } from "tailwindcss";

// Tailwind config for the Polity Pulse demo SPA.
// Colors are wired to the CSS variables defined in src/styles/tokens.css,
// which are copied from apps/web/src/styles/tokens.css (the canonical
// Polity design tokens). See pulse-demo-ui-ux-plan-2026-07-19.md §4.

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-2": "var(--paper-2)",
        "paper-3": "var(--paper-3)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        rule: "var(--rule)",
        "rule-soft": "var(--rule-soft)",
        // Civic inks — reserved from party-bright.
        "accent-blue": "var(--accent-blue)",
        "accent-red": "var(--accent-red)",
        "accent-yellow": "var(--accent-yellow)",
        "accent-green": "var(--accent-green)",
        // Highlights (low-saturation washes).
        "hl-yellow": "var(--hl-yellow)",
        "hl-blue": "var(--hl-blue)",
        "hl-red": "var(--hl-red)",
        "hl-green": "var(--hl-green)",
        // shadcn semantic slots — mapped to the Polity palette so shadcn
        // primitives render in-brand without per-component overrides.
        border: "var(--rule-soft)",
        input: "var(--rule-soft)",
        ring: "var(--accent-blue)",
        background: "var(--paper)",
        foreground: "var(--ink)",
        primary: {
          DEFAULT: "var(--accent-blue)",
          foreground: "var(--paper)",
        },
        secondary: {
          DEFAULT: "var(--paper-2)",
          foreground: "var(--ink-2)",
        },
        destructive: {
          DEFAULT: "var(--accent-red)",
          foreground: "var(--paper)",
        },
        muted: {
          DEFAULT: "var(--paper-2)",
          foreground: "var(--ink-3)",
        },
        accent: {
          DEFAULT: "var(--paper-3)",
          foreground: "var(--ink)",
        },
        popover: {
          DEFAULT: "var(--paper)",
          foreground: "var(--ink)",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "var(--ink)",
        },
        warning: {
          DEFAULT: "var(--accent-yellow)",
          foreground: "var(--ink)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-clean)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        hand: ["var(--font-hand)", "Caveat", "cursive"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Mirrors the canonical tokens --fs-* scale.
        display: ["88px", { lineHeight: "1.05" }],
        h1: ["56px", { lineHeight: "1.1" }],
        h2: ["36px", { lineHeight: "1.15" }],
        h3: ["24px", { lineHeight: "1.2" }],
        body: ["15px", { lineHeight: "1.55" }],
        "body-lg": ["17px", { lineHeight: "1.6" }],
        small: ["13px", { lineHeight: "1.5" }],
        mono: ["11px", { lineHeight: "1.4" }],
        "mono-sm": ["10px", { lineHeight: "1.4" }],
      },
      borderRadius: {
        lg: "10px",
        md: "8px",
        sm: "6px",
      },
      keyframes: {
        beat: {
          "0%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(74,122,63,0.6)" },
          "50%": { transform: "scale(1.6)" },
          "100%": { transform: "scale(1)", boxShadow: "0 0 0 12px rgba(74,122,63,0)" },
        },
        "fade-wash": {
          "0%": { backgroundColor: "var(--hl-yellow)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        beat: "beat 0.8s ease",
        "fade-wash": "fade-wash 1.5s ease forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
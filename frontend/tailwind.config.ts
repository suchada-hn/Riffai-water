import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple-inspired neutral system (backed by CSS variables in globals.css)
        bg: "hsl(var(--bg))",
        fg: "hsl(var(--fg))",
        /* `soft` maps to --muted (avoid naming token `muted`: some tooling treats `bg-muted` oddly) */
        soft: "hsl(var(--muted))",
        "muted-fg": "hsl(var(--muted-fg))",
        surface: "hsl(var(--surface))",
        "surface-2": "hsl(var(--surface-2))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          fg: "hsl(var(--primary-fg))",

          // backwards compatible scale (existing UI uses primary-900 etc)
          50: "hsl(var(--bg))",
          100: "hsl(var(--muted))",
          200: "hsl(var(--border))",
          300: "hsl(var(--border))",
          400: "hsl(var(--muted-fg))",
          500: "hsl(var(--muted-fg))",
          600: "hsl(var(--fg))",
          700: "hsl(var(--fg))",
          800: "hsl(var(--fg))",
          900: "hsl(var(--primary))",
          950: "hsl(var(--primary))",
        },
        accent: {
          light: "hsl(var(--surface))",
          DEFAULT: "hsl(var(--primary))",
          dark: "hsl(var(--fg))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          fg: "hsl(var(--danger-fg))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        // layered shadows feel more "physical" than borders
        soft: "0 1px 1px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.08)",
        lift: "0 1px 1px rgba(0,0,0,0.04), 0 16px 45px rgba(0,0,0,0.12)",
        pop: "0 1px 1px rgba(0,0,0,0.05), 0 22px 60px rgba(0,0,0,0.16)",

        // backwards compatibility (existing components)
        mono: "0 1px 1px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.08)",
        "mono-lg": "0 1px 1px rgba(0,0,0,0.04), 0 16px 45px rgba(0,0,0,0.12)",
        "mono-xl": "0 1px 1px rgba(0,0,0,0.05), 0 22px 60px rgba(0,0,0,0.16)",
      },
      borderRadius: {
        // Apple-like radii (keep a base radius variable for concentric nesting)
        base: "var(--radius)",
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",

        // backwards compatibility
        mono: "12px",
      },
    },
  },
  plugins: [],
};
export default config;

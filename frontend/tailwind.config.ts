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
        energy: {
          50: '#eefcfb',
          100: '#d8f8f5',
          200: '#b0f0ea',
          300: '#7be5de',
          400: '#3dd5ce',
          500: '#16b8b1',
          600: '#0c9791',
          700: '#0e7a75',
          800: '#0e605c',
          900: '#0d4e4a',
        },
        // Monochrome Theme - Black & White Only
        primary: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        accent: {
          light: '#ffffff',
          DEFAULT: '#000000',
          dark: '#0a0a0a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'mono': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'mono-lg': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'mono-xl': '0 8px 32px rgba(0, 0, 0, 0.16)',
      },
      borderRadius: {
        'mono': '2px',
      },
    },
  },
  plugins: [],
};
export default config;

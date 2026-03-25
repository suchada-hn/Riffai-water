import type { Config } from 'tailwindcss'
const config: Config = {
  darkMode: false,
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        black: '#000000',
        white: '#FFFFFF',
        red: { DEFAULT: '#FF0000', 500: '#FF0000' },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        thai: ['IBM Plex Sans Thai', 'sans-serif'],
        sans: ['IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        xs:   ['11px', { lineHeight: '16px', letterSpacing: '0.08em' }],
        sm:   ['13px', { lineHeight: '20px', letterSpacing: '0.04em' }],
        base: ['16px', { lineHeight: '24px', letterSpacing: '0' }],
        lg:   ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        xl:   ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        '2xl':['40px', { lineHeight: '48px', letterSpacing: '-0.03em' }],
        '3xl':['56px', { lineHeight: '64px', letterSpacing: '-0.04em' }],
      },
      spacing: {
        '1': '8px', '2': '16px', '3': '24px', '4': '32px',
        '5': '40px', '6': '48px', '8': '64px', '10': '80px',
        '12': '96px', '16': '128px', '20': '160px', '24': '192px',
      },
      borderRadius: { DEFAULT: '0px', none: '0px', sm: '0px',
                      md: '0px', lg: '0px', xl: '0px', full: '0px' },
      boxShadow: {
        brutal: '4px 4px 0px 0px #000000',
        'brutal-sm': '2px 2px 0px 0px #000000',
        'brutal-red': '4px 4px 0px 0px #FF0000',
        none: 'none',
      },
      transitionDuration: { DEFAULT: '80ms' },
      transitionTimingFunction: { DEFAULT: 'linear' },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config

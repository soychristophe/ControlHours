/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0f0d',
          raised:  '#111a16',
          card:    '#172019',
          border:  '#1f3028',
        },
        accent: {
          DEFAULT: '#22c55e',
          muted:   '#16a34a',
          dim:     '#14532d',
          glow:    '#4ade80',
        },
        text: {
          primary:   '#e2ffe8',
          secondary: '#8fba9c',
          muted:     '#4d7a5e',
        },
        amber: {
          hr:    '#f59e0b',
          hrDim: '#78350f',
        },
        danger: {
          DEFAULT: '#ef4444',
          dim:     '#7f1d1d',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        pill: '999px',
      },
      keyframes: {
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.22s ease-out',
      },
    },
  },
  plugins: [],
}

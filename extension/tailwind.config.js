/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        vt: {
          bg: {
            base: '#0A0D14',
            surface: 'rgba(17, 24, 39, 0.85)',
            drawer: 'rgba(11, 15, 25, 0.94)',
            elevated: 'rgba(31, 41, 55, 0.70)',
          },
          border: {
            subtle: 'rgba(255, 255, 255, 0.08)',
            medium: 'rgba(255, 255, 255, 0.16)',
            glow: 'rgba(99, 102, 241, 0.35)',
          },
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
          indigo: '#6366F1',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

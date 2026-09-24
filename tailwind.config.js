/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1B365D', 700: '#16294a', 900: '#0f1e36' },
        // `cyan` stays the brand accent for fills, borders and glows.
        // `cyan.ink` is the darkened variant used wherever cyan carries text,
        // because #00B4D8 on white is only 2.5:1 and fails WCAG AA.
        cyan: {
          DEFAULT: '#00B4D8',
          hover: '#0097B2',
          bg: '#E0F7FA',
          ink: '#00708A',
          btn: '#00728C',
          btnHover: '#005D73',
        },
        ink: '#12151C',
        muted: '#4B5563',
        faint: '#667085',
        line: '#D7DEE8',
        line2: '#BFC9D6',
        canvas: '#EDF1F7',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['DM Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,30,54,.06), 0 4px 12px -6px rgba(16,30,54,.10)',
        lift: '0 10px 28px -14px rgba(16,30,54,.45)',
        tile: '0 2px 4px rgba(16,30,54,.07), 0 10px 24px -14px rgba(16,30,54,.30)',
      },
      borderRadius: { card: '12px' },
    },
  },
  plugins: [],
}

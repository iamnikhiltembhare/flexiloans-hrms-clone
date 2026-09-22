/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1B365D', 700: '#16294a', 900: '#0f1e36' },
        cyan: { DEFAULT: '#00B4D8', hover: '#0097B2', bg: '#E0F7FA' },
        ink: '#1A1D26',
        muted: '#6B7280',
        faint: '#9CA3AF',
        line: '#E5E7EB',
        canvas: '#F5F7FA',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['DM Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: { card: '0 1px 3px rgba(0,0,0,0.06)' },
      borderRadius: { card: '10px' },
    },
  },
  plugins: [],
}

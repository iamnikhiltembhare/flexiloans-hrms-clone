const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Theme-aware colours are RGB channel variables defined in index.css
      // (:root for light, html.dark for dark), so one class works in both
      // themes and opacity modifiers like bg-surface/95 still apply.
      colors: {
        // `navy` is the heading/strong-text colour: brand navy in light mode,
        // near-white in dark. `brand` is the fixed navy for dark backgrounds
        // that must stay navy in both themes (table headers, chips).
        navy: { DEFAULT: v('navy'), 700: '#16294a', 900: '#0f1e36' },
        brand: { DEFAULT: '#1B365D', 700: '#16294a', 900: '#0f1e36' },
        // `cyan` stays the brand accent for fills, borders and glows.
        // `cyan.ink` is the variant used wherever cyan carries text, because
        // #00B4D8 on white is only 2.5:1 and fails WCAG AA.
        cyan: {
          DEFAULT: '#00B4D8',
          hover: '#0097B2',
          bg: v('cyan-bg'),
          ink: v('cyan-ink'),
          btn: '#00728C',
          btnHover: '#005D73',
        },
        ink: v('ink'),
        body: v('body'),
        muted: v('muted'),
        faint: v('faint'),
        line: v('line'),
        line2: v('line2'),
        canvas: v('canvas'),
        surface: { DEFAULT: v('surface'), 2: v('surface-2') },
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

import { BRAND } from '../lib/brand.js'

// `light` is for dark backgrounds (the sidebar); `dark` follows the theme -
// navy on light surfaces, near-white in dark mode.
export default function Logo({ variant = 'light', size = 28, markOnly = false }) {
  const ink = variant === 'light' ? 'text-white' : 'text-navy'
  const sub = variant === 'light' ? 'text-white/55' : 'text-faint'
  return (
    <span className={'inline-flex items-center gap-2 ' + ink}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="none" stroke="#00B4D8" strokeWidth="5" />
        <path d="M25 20h16v6h-10v6h9v6h-9v12h-6z" fill="currentColor" />
      </svg>
      {!markOnly && <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">
          {BRAND.word1}<span style={{ color: '#00B4D8' }}>{BRAND.word2}</span>
        </span>
        <span className={'block text-[8px] tracking-[0.14em] uppercase ' + sub}>
          {BRAND.tagline}
        </span>
      </span>}
    </span>
  )
}

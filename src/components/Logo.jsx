export default function Logo({ variant = 'light', size = 28 }) {
  const mark = variant === 'light' ? '#FFFFFF' : '#1B365D'
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="none" stroke="#00B4D8" strokeWidth="5" />
        <path d="M25 20h16v6h-10v6h9v6h-9v12h-6z" fill={mark} />
      </svg>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight" style={{ color: mark }}>
          FLEXI<span style={{ color: '#00B4D8' }}>LOANS</span>
        </span>
        <span className="block text-[8px] tracking-[0.14em] uppercase" style={{ color: variant === 'light' ? 'rgba(255,255,255,0.55)' : '#6B7280' }}>
          Human Resources
        </span>
      </span>
    </span>
  )
}

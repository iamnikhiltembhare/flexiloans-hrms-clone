import { Search } from 'lucide-react'
import { useTilt, useCountUp, useReveal } from '../lib/motion.js'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5 rise">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, actions, className = '', bodyClass = 'p-4', children }) {
  const ref = useReveal()
  return (
    <section ref={ref} className={'card reveal ' + className}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <div>
            {title && <h2 className="h2">{title}</h2>}
            {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

const TONES = {
  green: 'bg-[rgba(22,163,74,0.1)] text-[#16A34A]',
  red: 'bg-[rgba(220,38,38,0.1)] text-[#DC2626]',
  amber: 'bg-[rgba(217,119,6,0.1)] text-[#D97706]',
  blue: 'bg-[rgba(37,99,235,0.1)] text-[#2563EB]',
  purple: 'bg-[rgba(124,58,237,0.1)] text-[#7C3AED]',
  cyan: 'bg-cyan-bg text-[#0097B2]',
  gray: 'bg-canvas text-muted',
}

export function Badge({ tone = 'gray', children }) {
  return <span className={'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium transition-transform duration-200 hover:scale-105 ' + (TONES[tone] || TONES.gray)}>{children}</span>
}

export function statusTone(status) {
  const s = String(status).toLowerCase()
  if (['approved','active','present','paid','verified','resolved','on track','met','permanent'].some((k) => s.includes(k))) return 'green'
  if (['rejected','absent','breached','behind','critical','high','on notice'].some((k) => s.includes(k))) return 'red'
  if (['pending','processing','probation','at risk','late','in progress','medium','half'].some((k) => s.includes(k))) return 'amber'
  if (['wfh','remote','interviewing','offer','open','info'].some((k) => s.includes(k))) return 'blue'
  if (['leave','comp off','contract'].some((k) => s.includes(k))) return 'purple'
  return 'gray'
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'cyan' }) {
  const ring = { cyan: 'bg-cyan-bg text-[#0097B2]', green: 'bg-[rgba(22,163,74,0.1)] text-[#16A34A]', amber: 'bg-[rgba(217,119,6,0.1)] text-[#D97706]', red: 'bg-[rgba(220,38,38,0.1)] text-[#DC2626]', blue: 'bg-[rgba(37,99,235,0.1)] text-[#2563EB]', purple: 'bg-[rgba(124,58,237,0.1)] text-[#7C3AED]' }[tone]
  const tilt = useTilt({ max: 6 })
  const shown = useCountUp(value)
  return (
    <div ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave}
      className="card tilt p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-faint">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold text-navy font-mono tabular-nums">{shown}</p>
        {hint && <p className="mt-1 text-[11px] text-muted truncate">{hint}</p>}
      </div>
      {Icon && <span className={'shrink-0 grid place-items-center h-9 w-9 rounded-lg transition-transform duration-300 group-hover:scale-110 ' + ring}><Icon size={17} /></span>}
    </div>
  )
}

export function Table({ columns, rows, empty = 'Nothing to show yet.' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={'th ' + (c.align === 'right' ? 'text-right' : '')}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td className="td text-center text-muted py-8" colSpan={columns.length}>{empty}</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id || i}
              className={'transition-colors duration-150 hover:bg-cyan-bg/50 ' + (i % 2 ? 'bg-canvas' : 'bg-white')}>
              {columns.map((c) => (
                <td key={c.key} className={'td ' + (c.align === 'right' ? 'text-right' : '') + (c.mono ? ' font-mono text-xs' : '')}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input className="input pl-8 py-1.5 text-xs" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function Select({ value, onChange, options, className = '' }) {
  return (
    <select className={'input py-1.5 text-xs w-auto ' + className} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function Progress({ value, color = '#00B4D8' }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
      <div className="h-full rounded-full bar-fill" style={{ width: Math.min(100, value) + '%', background: color }} />
    </div>
  )
}

export function Avatar({ name, size = 32 }) {
  const initials = String(name).split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="inline-grid place-items-center rounded-full text-white font-semibold shrink-0 transition-transform duration-200 hover:scale-105"
      style={{ width: size, height: size, fontSize: size * 0.36,
        background: 'linear-gradient(135deg,#1B365D 0%,#26507F 55%,#0097B2 100%)' }}>{initials}</span>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-5 border-b border-line mb-4 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={'relative pb-2.5 text-[13px] whitespace-nowrap transition-colors ' +
            (active === t ? 'text-navy font-medium' : 'text-muted hover:text-navy')}>
          {t}
          <span className={'absolute left-0 -bottom-px h-0.5 rounded-full bg-cyan transition-all duration-300 ' +
            (active === t ? 'w-full opacity-100' : 'w-0 opacity-0')} />
        </button>
      ))}
    </div>
  )
}

export function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="text-[13px] text-[#374151] mt-0.5">{value || '--'}</p>
    </div>
  )
}

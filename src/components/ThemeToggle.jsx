import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../lib/theme.js'
import { haptic } from '../lib/native.js'

/** Icon button for the top bar: flips between light and dark. */
export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'
  return (
    <button type="button" onClick={() => { haptic(); toggle() }}
      className="relative h-8 w-8 shrink-0 rounded-lg grid place-items-center text-navy hover:bg-canvas transition-transform duration-200 hover:scale-110 active:scale-95"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      {/* Both icons stay mounted so the swap can rotate and fade. */}
      <Sun size={18} className={'absolute transition-all duration-500 ' + (dark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100')} />
      <Moon size={17} className={'absolute transition-all duration-500 ' + (dark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50')} />
    </button>
  )
}

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** Segmented Light / Dark / System control for the menu sheet. */
export function ThemeSwitch() {
  const { choice, setTheme } = useTheme()
  const index = OPTIONS.findIndex((o) => o.value === choice)
  return (
    <div className="relative grid grid-cols-3 rounded-2xl bg-canvas p-1 border border-line" role="radiogroup" aria-label="Appearance">
      <span className="absolute top-1 bottom-1 left-1 rounded-xl bg-surface shadow-card transition-transform duration-300 ease-out"
        style={{ width: 'calc((100% - .5rem) / 3)', transform: `translateX(${index * 100}%)` }} aria-hidden="true" />
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={choice === value}
          onClick={() => { haptic(); setTheme(value) }}
          className={'relative z-10 flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-xl transition-colors ' +
            (choice === value ? 'text-navy' : 'text-muted')}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  )
}

/** Icon-only Light / Dark / System switch for the navy desktop sidebar. */
export function ThemeIconSwitch() {
  const { choice, setTheme } = useTheme()
  return (
    <div className="flex gap-0.5 rounded-xl bg-white/[.07] p-0.5" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={choice === value} title={label + ' theme'} aria-label={label + ' theme'}
          onClick={() => setTheme(value)}
          className={'h-7 w-7 grid place-items-center rounded-lg transition-colors ' +
            (choice === value ? 'bg-white/20 text-white shadow-sm' : 'text-white/55 hover:text-white hover:bg-white/10')}>
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}

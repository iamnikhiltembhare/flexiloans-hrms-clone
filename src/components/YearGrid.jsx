import { MONTHS, WEEKDAYS, parseDate } from '../data/holidays.js'

/**
 * Twelve month mini-calendars for one year, with holidays marked.
 * `marks` maps an ISO date to { kind: 'company' | 'optional' | 'applied', name }.
 */
export default function YearGrid({ year, marks, onPick }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {MONTHS.map((label, month) => (
        <Month key={label} year={year} month={month} label={label} marks={marks} onPick={onPick} />
      ))}
    </div>
  )
}

function Month({ year, month, label, marks, onPick }) {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Monday-first offset
  const lead = (first.getDay() + 6) % 7
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const iso = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const count = Object.keys(marks).filter((k) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length

  return (
    <section className="rounded-card border border-line bg-white p-3">
      <header className="flex items-baseline justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-navy">{label}</h3>
        {count > 0 && <span className="text-[10px] font-mono text-muted">{count}</span>}
      </header>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[9px] font-medium uppercase tracking-wide text-faint pb-1">{w[0]}</span>
        ))}

        {cells.map((day, i) => {
          if (!day) return <span key={'x' + i} />
          const key = iso(day)
          const mark = marks[key]
          const weekend = [0, 6].includes(parseDate(key).getDay())

          const tone =
            mark?.kind === 'applied' ? 'bg-[#16A34A] text-white font-semibold'
            : mark?.kind === 'company' ? 'bg-navy text-white font-semibold'
            : mark?.kind === 'optional' ? 'bg-cyan-bg text-[#0097B2] font-medium ring-1 ring-cyan/40'
            : weekend ? 'text-faint'
            : 'text-[#374151]'

          return (
            <button
              key={key}
              type="button"
              title={mark ? `${mark.name} - ${key}` : key}
              onClick={() => mark && onPick?.(key, mark)}
              className={'aspect-square grid place-items-center rounded text-[11px] transition-transform duration-150 ' +
                tone + (mark ? ' hover:scale-110 cursor-pointer' : ' cursor-default')}>
              {day}
            </button>
          )
        })}
      </div>
    </section>
  )
}

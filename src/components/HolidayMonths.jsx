import { MONTHS, parseDate, isWeekend } from '../data/holidays.js'

/**
 * Twelve month cards, each listing that month's holidays as rows:
 * day number + weekday on the left, occasion in the middle, and an
 * Apply action on the right for optional holidays.
 */
export default function HolidayMonths({ year, holidays, appliedDates, onApply, quotaLeft }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {MONTHS.map((label, i) => {
        const month = String(i + 1).padStart(2, '0')
        const rows = holidays.filter((h) => h.date.startsWith(`${year}-${month}`))
        return (
          <section key={label}
            className="rounded-card border border-line bg-white shadow-card overflow-hidden flex flex-col
                       transition-shadow duration-300 hover:shadow-[0_14px_30px_-20px_rgba(27,54,93,.45)]">
            <header className="px-4 pt-3.5 pb-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.07em] text-navy/70">
                {label.slice(0, 3)} {year}
              </h3>
            </header>

            <div className="flex-1 min-h-[9rem] px-1.5 pb-2">
              {rows.length === 0 ? (
                <p className="h-full grid place-items-center text-[12px] text-faint">No Holidays</p>
              ) : rows.map((h) => {
                const d = parseDate(h.date)
                const applied = appliedDates.includes(h.date)
                const weekendDay = isWeekend(h.date)
                return (
                  <div key={h.date + h.name}
                    className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-canvas">
                    <span className="w-9 shrink-0 text-center">
                      <span className="block text-[17px] font-semibold text-navy leading-none tabular-nums">
                        {String(d.getDate()).padStart(2, '0')}
                      </span>
                      <span className="block text-[10px] text-muted mt-0.5">
                        {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className={'block text-[13px] leading-snug ' + (h.optional ? 'text-[#2B3445]' : 'text-navy font-medium')}>
                        {h.name}
                      </span>
                      {weekendDay && (
                        <span className="block text-[10px] text-faint mt-0.5">Already a non-working day</span>
                      )}
                    </span>

                    {h.optional && (
                      applied ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#16A34A]">
                          Applied
                        </span>
                      ) : (
                        <button
                          onClick={() => onApply(h)}
                          className="shrink-0 text-[12px] font-semibold text-cyan-ink hover:text-cyan-btnHover hover:underline
                                     transition-transform duration-150 active:scale-95 disabled:text-faint disabled:no-underline"
                          title={quotaLeft <= 0 ? 'Optional holiday quota used - needs manager approval' : undefined}>
                          Apply
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

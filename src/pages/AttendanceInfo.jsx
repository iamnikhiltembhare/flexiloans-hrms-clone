import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, List, Clock, Timer, AlertTriangle, LogIn, LogOut, CalendarCheck } from 'lucide-react'
import { Card, StatCard, Badge, Table } from '../components/ui.jsx'
import { buildMonth, monthSummary, SHIFT, SHIFT_START, SHIFT_END } from '../data/attendance.js'
import { companyHolidays, MONTHS, WEEKDAYS } from '../data/holidays.js'
import { useApp } from '../context/DataContext.jsx'
import { localDate, isPunchedIn } from '../lib/actions.js'

// Each calendar day shows the first punch-in and the last punch-out, with a
// bar for the time worked against the shift. Today uses the real punches
// from the top bar's Punch in / Punch out button.

const STATUS_STYLE = {
  P: 'bg-[rgba(22,163,74,0.12)] text-[#16A34A]',
  A: 'bg-[rgba(220,38,38,0.12)] text-[#DC2626]',
  L: 'bg-[rgba(124,58,237,0.12)] text-[#7C3AED]',
  H: 'bg-cyan-bg text-[#0097B2]',
  WO: 'bg-canvas text-faint',
}
const CELL_TINT = {
  A: 'bg-[rgba(220,38,38,0.05)]',
  L: 'bg-[rgba(124,58,237,0.05)]',
  H: 'bg-cyan-bg/50',
  WO: 'bg-canvas/70',
}

// Bars span 08:00-22:00.
const DAY_FROM = 8 * 60
const DAY_TO = 22 * 60
const pct = (m) => Math.min(100, Math.max(0, ((m - DAY_FROM) / (DAY_TO - DAY_FROM)) * 100))
const duration = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h + 'h ' + String(m).padStart(2, '0') + 'm' }
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }

/** Worked time against the shift window, as a thin bar. */
function TimeBar({ r, tall = false }) {
  const h = tall ? 'h-3' : 'h-1.5'
  return (
    <span className={'relative block w-full rounded-full bg-line/70 overflow-hidden ' + h} aria-hidden="true">
      <span className="absolute inset-y-0 bg-[rgba(0,180,216,0.18)]" style={{ left: pct(SHIFT_START) + '%', width: pct(SHIFT_END) - pct(SHIFT_START) + '%' }} />
      <span className={'absolute inset-y-0 rounded-full ' + (r.late ? 'bg-[#D97706]' : 'bg-[#16A34A]') + (r.working ? ' animate-pulse' : '')}
        style={{ left: pct(r.inMin) + '%', width: Math.max(2, pct(r.outMin) - pct(r.inMin)) + '%' }} />
    </span>
  )
}

function DayCell({ r, active, onPick }) {
  const present = r.status === 'P'
  return (
    <button onClick={() => onPick(r.date)}
      className={'att-cell relative min-h-[4.25rem] sm:min-h-[6.25rem] rounded-lg border p-1 sm:p-1.5 text-left transition-all duration-150 hover:border-cyan flex flex-col ' +
        (active ? 'border-cyan ring-2 ring-cyan/30 ' : 'border-line ') +
        (r.isToday ? 'shadow-[inset_0_0_0_1.5px_rgb(0_180_216/.55)] ' : '') +
        (CELL_TINT[r.status] || 'bg-surface')}
      aria-label={r.date + ' ' + (r.label || '') + (present ? ', in ' + r.firstIn + (r.lastOut ? ', out ' + r.lastOut : '') : '')}>
      <span className="flex items-start justify-between gap-1">
        <span className={'text-[11px] sm:text-[12px] font-semibold ' + (r.isToday ? 'text-cyan-ink' : 'text-navy')}>
          {String(r.day).padStart(2, '0')}
        </span>
        {r.isToday && <span className="hidden sm:inline rounded-full bg-cyan px-1.5 text-[8.5px] font-bold uppercase tracking-wide text-white">Today</span>}
        {!r.isToday && r.status && r.status !== 'P' && (
          <span className={'rounded px-1 text-[8.5px] font-semibold ' + (STATUS_STYLE[r.status] || '')}>{r.status}</span>
        )}
        {present && r.late && !r.isToday && <span className="hidden sm:inline rounded px-1 text-[8.5px] font-semibold bg-[rgba(217,119,6,0.14)] text-[#B45309]">Late</span>}
      </span>

      {present ? (
        <span className="mt-auto block space-y-0.5 sm:space-y-1">
          <span className="flex items-center gap-1 font-mono text-[9.5px] sm:text-[11px] leading-none">
            <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (r.late ? 'bg-[#D97706]' : 'bg-[#16A34A]')} />
            <span className={r.late ? 'text-[#B45309]' : 'text-body'}>{r.firstIn}</span>
          </span>
          <span className="flex items-center gap-1 font-mono text-[9.5px] sm:text-[11px] leading-none">
            <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (r.working ? 'bg-cyan animate-pulse' : 'bg-[#DC2626]/80')} />
            <span className={r.working ? 'text-cyan-ink' : 'text-body'}>{r.working ? 'now' : r.lastOut}</span>
          </span>
          <span className="hidden sm:block pt-0.5"><TimeBar r={r} /></span>
        </span>
      ) : (
        <span className="mt-auto hidden sm:block text-[9.5px] text-muted leading-tight">{r.label}</span>
      )}
    </button>
  )
}

const LEGEND = [
  ['bg-[#16A34A]', 'On time'], ['bg-[#D97706]', 'Late (after 10:15)'], ['bg-cyan', 'Working now'],
  ['bg-[#DC2626]', 'Absent'], ['bg-[#7C3AED]', 'Leave'], ['bg-[#0097B2]', 'Holiday'],
]

export default function AttendanceInfo() {
  const { punch } = useApp()
  const todayISO = localDate()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [selected, setSelected] = useState(todayISO)
  const [view, setView] = useState('grid')

  // Keep "working now" bars growing while the page is open.
  const [nowMin, setNowMin] = useState(nowMinutes)
  useEffect(() => { const t = setInterval(() => setNowMin(nowMinutes()), 60000); return () => clearInterval(t) }, [])

  // Real punches: the saved history, plus today's punch from the seed data
  // (which predates history) when nothing else is recorded for today.
  const history = useMemo(() => {
    const h = { ...(punch?.history || {}) }
    if (!h[todayISO] && punch?.inAt && (!punch.date || punch.date === todayISO)) h[todayISO] = { in: punch.inAt, out: punch.outAt }
    // Back in after a punch-out: today counts as "working now" again.
    if (h[todayISO] && isPunchedIn(punch)) h[todayISO] = { ...h[todayISO], out: null }
    return h
  }, [punch, todayISO])

  const holidayDates = companyHolidays.map((h) => h.date)
  const rows = useMemo(() => buildMonth(cursor.y, cursor.m, holidayDates, history, todayISO, nowMin), [cursor, history, todayISO, nowMin]) // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => monthSummary(rows), [rows])
  const day = rows.find((r) => r.date === selected) || rows.find((r) => r.isToday) || rows.find((r) => r.status === 'P')

  const step = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }
  const goToday = () => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); setSelected(todayISO) }

  const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7
  const cells = [...Array(lead).fill(null), ...rows]

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Avg work hrs" value={summary.avgWork} hint="first in to last out" icon={Clock} tone="cyan" />
        <StatCard label="Avg hrs in shift" value={summary.avgActual} hint={'within ' + SHIFT.window} icon={Timer} tone="blue" />
        <StatCard label="Late arrivals" value={rows.filter((r) => r.late).length} hint="punched in after 10:15" icon={AlertTriangle} tone={rows.some((r) => r.late) ? 'amber' : 'green'} />
        <StatCard label="Days present" value={summary.present} hint={`${summary.leave} leave, ${summary.penaltyDays} absent`} icon={CalendarCheck} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card bodyClass="p-2.5 sm:p-3">
          <header className="flex items-center justify-between gap-2 sm:gap-3 px-1 pb-3">
            <div className="flex items-center gap-1.5">
              <button className="btn-ghost px-2 py-1" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft size={13} /></button>
              <button className="btn-ghost px-2 py-1" onClick={() => step(1)} aria-label="Next month"><ChevronRight size={13} /></button>
              <button className="btn-ghost px-2 py-1 hidden sm:inline-flex" onClick={goToday}>Today</button>
            </div>
            <h2 className="h2">{MONTHS[cursor.m]} {cursor.y}</h2>
            <span className="flex rounded-lg border border-line overflow-hidden">
              <button onClick={() => setView('grid')} aria-label="Calendar view"
                className={'px-2 py-1.5 ' + (view === 'grid' ? 'bg-cyan text-white' : 'text-muted hover:bg-canvas')}><LayoutGrid size={13} /></button>
              <button onClick={() => setView('list')} aria-label="List view"
                className={'px-2 py-1.5 ' + (view === 'list' ? 'bg-cyan text-white' : 'text-muted hover:bg-canvas')}><List size={13} /></button>
            </span>
          </header>

          {view === 'grid' ? (
            <>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="text-[10px] font-medium uppercase tracking-wide text-faint text-center pb-1">{w}</span>
                ))}
                {cells.map((r, i) => r
                  ? <DayCell key={r.date} r={r} active={r.date === selected} onPick={setSelected} />
                  : <span key={'x' + i} />)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[10.5px] text-muted">
                {LEGEND.map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className={'h-2 w-2 rounded-full inline-block ' + c} />{l}</span>)}
                <span className="flex items-center gap-1.5"><i className="h-2 w-4 rounded-sm inline-block bg-[rgba(0,180,216,0.25)]" />Shift {SHIFT.window}</span>
              </div>
            </>
          ) : (
            <Table
              columns={[
                { key: 'date', header: 'Date', mono: true },
                { key: 'status', header: 'Status', render: (r) => r.status
                  ? <Badge tone={r.status === 'P' ? (r.late ? 'amber' : 'green') : r.status === 'A' ? 'red' : r.status === 'L' ? 'purple' : 'gray'}>{r.late ? 'Late' : r.label}</Badge>
                  : <span className="text-faint">--</span> },
                { key: 'firstIn', header: 'Punch in', mono: true, render: (r) => r.firstIn || '--' },
                { key: 'lastOut', header: 'Last punch out', mono: true, render: (r) => (r.working ? 'Working' : r.lastOut) || '--' },
                { key: 'totalWork', header: 'Total', mono: true, render: (r) => (r.totalWork ? duration(r.totalWork) : '--') },
                { key: 'bar', header: 'Timeline', render: (r) => (r.status === 'P' ? <span className="block w-32"><TimeBar r={r} /></span> : null) },
              ]}
              rows={rows}
            />
          )}
        </Card>

        {/* Selected day */}
        <div className="space-y-4">
          <Card bodyClass="p-4">
            {day ? (
              <>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
                  <div>
                    <p className="text-2xl font-semibold text-navy font-mono leading-none">{String(day.day).padStart(2, '0')}</p>
                    <p className="text-[11px] text-muted mt-1">
                      {new Date(day.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', month: 'short', year: 'numeric' })}
                      {day.isToday && <span className="ml-1.5 font-semibold text-cyan-ink">Today</span>}
                    </p>
                  </div>
                  <div className="text-right min-w-0">
                    <p className="text-[12px] font-medium text-navy">{SHIFT.label}</p>
                    <p className="text-[10px] text-muted">Shift: {SHIFT.window}</p>
                    <p className="text-[10px] text-faint">{SHIFT.scheme}</p>
                  </div>
                </div>

                {day.status === 'P' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 mt-3">
                      <div className="rounded-xl border border-line bg-surface-2 p-3">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint"><LogIn size={12} className={day.late ? 'text-[#D97706]' : 'text-[#16A34A]'} /> Punch in</p>
                        <p className={'mt-1 text-[22px] font-mono font-semibold leading-none ' + (day.late ? 'text-[#B45309]' : 'text-navy')}>{day.firstIn}</p>
                        <p className="mt-1 text-[10.5px] text-muted">{day.late ? 'Late by ' + duration(day.lateIn) : 'On time'}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-2 p-3">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint"><LogOut size={12} className="text-[#DC2626]" /> Last punch out</p>
                        <p className={'mt-1 text-[22px] font-mono font-semibold leading-none ' + (day.working ? 'text-cyan-ink' : 'text-navy')}>{day.working ? 'Working' : day.lastOut}</p>
                        <p className="mt-1 text-[10.5px] text-muted">{day.working ? 'Still punched in' : day.earlyOut !== '00:00' ? 'Left ' + duration(day.earlyOut) + ' early' : 'Full shift'}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-[9.5px] font-mono text-faint mb-1"><span>08:00</span><span>12:00</span><span>16:00</span><span>22:00</span></div>
                      <TimeBar r={day} tall />
                      <p className="mt-1.5 text-[11px] text-muted">
                        <span className="font-semibold text-navy">{duration(day.totalWork)}</span> {day.working ? 'so far' : 'worked'}
                        {day.excess !== '00:00' && <> - <span className="text-[#16A34A] font-medium">{duration(day.excess)} over</span></>}
                        {day.shortfall !== '00:00' && !day.working && <> - <span className="text-[#B45309] font-medium">{duration(day.shortfall)} short</span></>}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-4">
                      {[
                        ['Late in', day.lateIn], ['Early out', day.earlyOut],
                        ['Hrs in shift', day.inShift], ['Shortfall', day.shortfall],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-2 border-b border-line/70 pb-1">
                          <span className="text-[10px] text-muted">{k}</span>
                          <span className="text-[11px] font-mono text-navy">{v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-[12px] text-muted">
                    {day.isToday ? 'You have not punched in yet today. Use Punch in at the top of the screen.' : day.label || 'Nothing recorded for this day yet.'}
                  </p>
                )}
              </>
            ) : <p className="text-[12px] text-muted">Pick a day from the calendar.</p>}
          </Card>

          <Card title="Session details" bodyClass="p-0">
            <Table
              columns={[
                { key: 'name', header: 'Session' },
                { key: 'timing', header: 'Shift', mono: true },
                { key: 'first', header: 'First in', mono: true },
                { key: 'last', header: 'Last out', mono: true },
              ]}
              rows={day?.sessions || []}
              empty="No sessions recorded."
            />
          </Card>
        </div>
      </div>
    </>
  )
}

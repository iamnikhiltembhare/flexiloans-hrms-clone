import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, List, Clock, Timer, AlertTriangle } from 'lucide-react'
import { Card, StatCard, Badge, Table } from '../components/ui.jsx'
import { buildMonth, monthSummary, SHIFT } from '../data/attendance.js'
import { companyHolidays, MONTHS, WEEKDAYS, prettyDate } from '../data/holidays.js'

const STATUS_STYLE = {
  P: 'bg-[rgba(22,163,74,0.12)] text-[#16A34A]',
  A: 'bg-[rgba(220,38,38,0.12)] text-[#DC2626]',
  L: 'bg-[rgba(124,58,237,0.12)] text-[#7C3AED]',
  H: 'bg-cyan-bg text-[#0097B2]',
  WO: 'bg-canvas text-faint',
}

export default function AttendanceInfo() {
  const [cursor, setCursor] = useState({ y: 2026, m: 8 })   // September 2026
  const [selected, setSelected] = useState('2026-09-23')
  const [view, setView] = useState('grid')

  const holidayDates = companyHolidays.map((h) => h.date)
  const rows = useMemo(() => buildMonth(cursor.y, cursor.m, holidayDates), [cursor]) // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => monthSummary(rows), [rows])
  const day = rows.find((r) => r.date === selected) || rows.find((r) => r.status === 'P')

  const step = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7
  const cells = [...Array(lead).fill(null), ...rows]

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Avg work hrs" value={summary.avgWork} hint="per present day" icon={Clock} tone="cyan" />
        <StatCard label="Avg actual work hrs" value={summary.avgActual} hint="within shift time" icon={Timer} tone="blue" />
        <StatCard label="Penalty days" value={summary.penaltyDays} hint="unapproved absences" icon={AlertTriangle} tone={summary.penaltyDays ? 'red' : 'green'} />
        <StatCard label="Days present" value={summary.present} hint={`${summary.leave} leave, ${summary.weeklyOff} weekly off`} icon={Clock} tone="green" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card bodyClass="p-3">
          <header className="flex items-center justify-between gap-3 px-1 pb-3">
            <button className="btn-ghost px-2 py-1" onClick={() => step(-1)}><ChevronLeft size={13} /> Prev</button>
            <h2 className="h2">{MONTHS[cursor.m]} {cursor.y}</h2>
            <div className="flex items-center gap-2">
              <button className="btn-ghost px-2 py-1" onClick={() => step(1)}>Next <ChevronRight size={13} /></button>
              <span className="flex rounded-lg border border-line overflow-hidden">
                <button onClick={() => setView('grid')} aria-label="Grid view"
                  className={'px-2 py-1.5 ' + (view === 'grid' ? 'bg-cyan text-white' : 'text-muted hover:bg-canvas')}>
                  <LayoutGrid size={13} />
                </button>
                <button onClick={() => setView('list')} aria-label="List view"
                  className={'px-2 py-1.5 ' + (view === 'list' ? 'bg-cyan text-white' : 'text-muted hover:bg-canvas')}>
                  <List size={13} />
                </button>
              </span>
            </div>
          </header>

          {view === 'grid' ? (
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[10px] font-medium uppercase tracking-wide text-faint text-center pb-1">{w}</span>
              ))}
              {cells.map((r, i) => {
                if (!r) return <span key={'x' + i} />
                const active = r.date === selected
                return (
                  <button key={r.date} onClick={() => setSelected(r.date)}
                    className={'min-h-[4.5rem] rounded-lg border p-1.5 text-left transition-all duration-150 hover:border-cyan ' +
                      (active ? 'border-cyan ring-2 ring-cyan/25 bg-cyan-bg/40' : 'border-line bg-white')}>
                    <span className="flex items-start justify-between">
                      <span className={'text-[12px] font-medium ' + (active ? 'text-cyan-hover' : 'text-navy')}>
                        {String(r.day).padStart(2, '0')}
                      </span>
                      {r.status && (
                        <span className={'rounded px-1 text-[9px] font-semibold ' + (STATUS_STYLE[r.status] || '')}>
                          {r.status}
                        </span>
                      )}
                    </span>
                    {r.status === 'P' && (
                      <span className="block mt-2 text-[9px] font-mono text-faint text-right">{SHIFT.label.slice(-5, -1)}</span>
                    )}
                    {['H', 'L', 'A'].includes(r.status) && (
                      <span className="block mt-2 text-[9px] text-muted leading-tight">{r.label}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <Table
              columns={[
                { key: 'date', header: 'Date', mono: true },
                { key: 'status', header: 'Status', render: (r) => r.status
                  ? <Badge tone={r.status === 'P' ? 'green' : r.status === 'A' ? 'red' : r.status === 'L' ? 'purple' : 'gray'}>{r.label}</Badge>
                  : <span className="text-faint">--</span> },
                { key: 'firstIn', header: 'First in', mono: true, render: (r) => r.firstIn || '--' },
                { key: 'lastOut', header: 'Last out', mono: true, render: (r) => r.lastOut || '--' },
                { key: 'totalWork', header: 'Total work', mono: true, render: (r) => r.totalWork || '--' },
                { key: 'excess', header: 'Excess', mono: true, render: (r) => r.excess || '--' },
              ]}
              rows={rows}
            />
          )}
        </Card>

        {/* Day detail panel */}
        <div className="space-y-4">
          <Card bodyClass="p-4">
            {day ? (
              <>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
                  <div>
                    <p className="text-2xl font-semibold text-navy font-mono leading-none">{String(day.day).padStart(2, '0')}</p>
                    <p className="text-[11px] text-muted mt-1">{new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                  </div>
                  <div className="text-right min-w-0">
                    <p className="text-[12px] font-medium text-navy">{SHIFT.label}</p>
                    <p className="text-[10px] text-muted">Shift: {SHIFT.window}</p>
                    <p className="text-[10px] text-muted mt-1">{SHIFT.name}</p>
                    <p className="text-[10px] text-faint">{SHIFT.scheme}</p>
                  </div>
                </div>

                {day.status === 'P' ? (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-faint mt-3 mb-2">Processed on</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {[
                        ['First in', day.firstIn], ['Last out', day.lastOut],
                        ['Late in', day.lateIn], ['Early out', day.earlyOut],
                        ['Total work hrs', day.totalWork], ['Break hrs', day.breakHrs],
                        ['Work hrs in shift', day.inShift], ['Shortfall hrs', day.shortfall],
                        ['Excess hrs', day.excess],
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
                    {day.label || 'Nothing recorded for this day yet.'}
                  </p>
                )}
              </>
            ) : <p className="text-[12px] text-muted">Pick a day from the calendar.</p>}
          </Card>

          <Card title="Status details" bodyClass="p-0">
            <Table
              columns={[
                { key: 'status', header: 'Status' },
                { key: 'remarks', header: 'Remarks' },
              ]}
              rows={day ? [{ status: day.label || '--', remarks: day.status === 'A' ? 'Regularisation pending' : '--' }] : []}
            />
          </Card>

          <Card title="Session details" bodyClass="p-0">
            <Table
              columns={[
                { key: 'name', header: 'Session' },
                { key: 'timing', header: 'Timing', mono: true },
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

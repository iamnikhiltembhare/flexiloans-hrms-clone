import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, CalendarCheck, Sparkles, RefreshCw, Download, Check,
  Info, CloudOff, Cloud, MapPin,
} from 'lucide-react'
import {
  PageHeader, Card, Table, Badge, StatCard, Tabs, SearchInput, Select, statusTone,
} from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import YearGrid from '../components/YearGrid.jsx'
import HolidayMonths from '../components/HolidayMonths.jsx'
import {
  HOLIDAY_YEAR, YEARS, holidayList, companyHolidays, optionalHolidays,
  OPTIONAL_HOLIDAY_QUOTA, prettyDate, weekdayOf, isWeekend,
} from '../data/holidays.js'
import { fetchGoogleHolidays, isConfigured, SYNC_LABEL } from '../lib/googleCalendar.js'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { downloadCSV } from '../lib/download.js'
import { usePersistentState } from '../lib/persist.js'
import { BRAND } from '../lib/brand.js'

export default function Holidays() {
  const { addLeaveRequest, toast, notify } = useApp()
  const { user } = useAuth()

  const [tab, setTab] = useState('Calendar')
  const [year, setYear] = useState(HOLIDAY_YEAR)
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('All regions')
  const [applied, setApplied] = usePersistentState('appliedHolidays', [])          // ISO dates taken as optional holidays
  const [pick, setPick] = useState(null)              // holiday awaiting confirmation
  const [sync, setSync] = useState({ status: 'idle', items: [], error: null })
  const [syncing, setSyncing] = useState(false)

  // --- Google Calendar sync -------------------------------------------------
  const runSync = async (force = false) => {
    setSyncing(true)
    const res = await fetchGoogleHolidays(HOLIDAY_YEAR, { force })
    setSync(res)
    setSyncing(false)
    if (force) {
      if (res.status === 'live') toast('Holidays synced', res.items.length + ' entries pulled from Google Calendar')
      else if (res.status === 'not-configured') toast('Google sync not configured', 'Add VITE_GOOGLE_API_KEY to enable live sync', 'warning')
      else toast('Sync unavailable', res.error || 'Showing the bundled 2026 list', 'warning')
    }
  }
  useEffect(() => { runSync(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const googleLive = sync.status === 'live' || sync.status === 'cached'

  // --- Data -----------------------------------------------------------------
  const scopes = useMemo(
    () => ['All regions', ...new Set(optionalHolidays.map((h) => h.scope))],
    [])

  const optional = useMemo(() => optionalHolidays.filter((h) =>
    h.name.toLowerCase().includes(q.toLowerCase())
    && (scope === 'All regions' || h.scope === scope)
  ), [q, scope])

  const marks = useMemo(() => {
    const m = {}
    companyHolidays.forEach((h) => { m[h.date] = { kind: 'company', name: h.name } })
    optionalHolidays.forEach((h) => { if (!m[h.date]) m[h.date] = { kind: 'optional', name: h.name } })
    applied.forEach((d) => { m[d] = { kind: 'applied', name: (m[d]?.name || 'Optional holiday') + ' (applied)' } })
    return m
  }, [applied])

  const remaining = OPTIONAL_HOLIDAY_QUOTA - applied.length
  const upcoming = companyHolidays.filter((h) => new Date(h.date) >= new Date('2026-09-22')).length
  const longWeekends = companyHolidays.filter((h) => {
    const d = new Date(h.date).getDay()
    return d === 1 || d === 5
  }).length

  // --- Apply for an optional holiday ---------------------------------------
  const confirmApply = () => {
    if (!pick) return
    addLeaveRequest({
      employee: user.name, empId: user.id, type: 'Optional Holiday',
      from: pick.date, to: pick.date, days: 1, reason: pick.name,
    })
    setApplied((a) => [...a, pick.date])
    notify({
      title: 'Optional holiday requested',
      detail: pick.name + ' on ' + prettyDate(pick.date),
      to: '/leave', kind: 'leave',
    })
    toast('Optional holiday applied', pick.name + ' sent to your manager for approval')
    setPick(null)
  }

  const exportCalendar = () => {
    downloadCSV(`flexiloans-holiday-calendar-${HOLIDAY_YEAR}.csv`, [
      { header: 'Date', key: 'date' },
      { header: 'Day', key: 'day', value: (r) => weekdayOf(r.date) },
      { header: 'Holiday', key: 'name' },
      { header: 'Category', key: 'category' },
      { header: 'Applies to', key: 'scope' },
    ], [
      ...companyHolidays.map((h) => ({ ...h, category: 'Company holiday' })),
      ...optionalHolidays.map((h) => ({ ...h, category: 'Optional holiday' })),
    ])
    toast('Calendar exported', companyHolidays.length + optionalHolidays.length + ' holidays written to CSV')
  }

  return (
    <>
      <PageHeader
        title={`Holiday calendar ${year}`}
        subtitle="Company holidays, optional holidays and what you have left to take"
        actions={<>
          <Select value={String(year)} onChange={(v) => setYear(Number(v))} options={YEARS.map(String)} />
          <button className="btn-secondary" onClick={exportCalendar}><Download size={13} /> Export</button>
          <button className="btn-secondary" onClick={() => runSync(true)} disabled={syncing}>
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync with Google'}
          </button>
        </>}
      />

      {/* Sync status */}
      <div className={'mb-4 flex items-start gap-2.5 rounded-card border-l-[3px] px-3.5 py-3 ' +
        (googleLive ? 'border-[#16A34A] bg-[rgba(22,163,74,0.07)]' : 'border-cyan bg-cyan-bg')}>
        {googleLive ? <Cloud size={15} className="mt-0.5 shrink-0 text-[#16A34A]" />
                    : <CloudOff size={15} className="mt-0.5 shrink-0 text-[#0097B2]" />}
        <div className="min-w-0">
          <p className="text-[12px] text-[#374151]">
            <strong className="text-navy">{SYNC_LABEL[sync.status] || 'Loading holidays...'}</strong>
            {googleLive
              ? ` - ${sync.items.length} entries from the public "Holidays in India" calendar.`
              : isConfigured()
                ? ` ${sync.error || ''} The published ${BRAND.company} ${HOLIDAY_YEAR} calendar is shown instead.`
                : ` Showing the published ${BRAND.company} ${HOLIDAY_YEAR} calendar. Add a Google Calendar API key as VITE_GOOGLE_API_KEY to also pull the public India holiday feed.`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Company holidays" value={companyHolidays.length} hint={`declared for ${HOLIDAY_YEAR}`} icon={CalendarDays} tone="cyan" />
        <StatCard label="Still to come" value={upcoming} hint="from today onwards" icon={CalendarCheck} tone="green" />
        <StatCard label="Optional holidays left" value={`${remaining} of ${OPTIONAL_HOLIDAY_QUOTA}`} hint={applied.length + ' applied'} icon={Sparkles} tone="purple" />
        <StatCard label="Long weekends" value={longWeekends} hint="holidays on a Monday or Friday" icon={MapPin} tone="amber" />
      </div>

      <Tabs tabs={['Calendar', 'Year grid', 'Company holidays', 'Optional holidays']} active={tab} onChange={setTab} />

      {tab === 'Calendar' && (
        year === HOLIDAY_YEAR ? (
          <HolidayMonths
            year={year}
            holidays={holidayList}
            appliedDates={applied}
            quotaLeft={remaining}
            onApply={(h) => setPick(h)}
          />
        ) : (
          <Card bodyClass="p-10">
            <p className="text-center text-[13px] text-muted">
              No holiday calendar published for {year} yet.
            </p>
          </Card>
        )
      )}

      {tab === 'Year grid' && (
        <Card title={`${HOLIDAY_YEAR} calendar`} subtitle="Click a highlighted date for details">
          <div className="flex flex-wrap gap-4 mb-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-navy inline-block" /> Company holiday</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-cyan-bg ring-1 ring-cyan/40 inline-block" /> Optional holiday</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-[#16A34A] inline-block" /> Applied</span>
          </div>
          <YearGrid
            year={HOLIDAY_YEAR}
            marks={marks}
            onPick={(date, mark) => {
              const opt = optionalHolidays.find((h) => h.date === date)
              if (mark.kind === 'optional' && opt) setPick(opt)
              else toast(mark.name, prettyDate(date) + ' - ' + weekdayOf(date), 'info')
            }}
          />
        </Card>
      )}

      {tab === 'Company holidays' && (
        <Card subtitle="Offices are closed on these days - no application needed" bodyClass="p-0">
          <Table
            columns={[
              { key: 'date', header: 'Date', mono: true, render: (r) => prettyDate(r.date) },
              { key: 'day', header: 'Day', render: (r) => (
                <span className={isWeekend(r.date) ? 'text-faint' : ''}>{weekdayOf(r.date)}</span>
              )},
              { key: 'name', header: 'Occasion', render: (r) => (
                <span className="flex items-center gap-2">
                  <span className="text-[13px] text-navy">{r.name}</span>
                  {r.lunar && <span title="Date depends on moon sighting"><Info size={11} className="text-faint" /></span>}
                </span>
              )},
              { key: 'type', header: 'Type', render: (r) => <Badge tone={r.type === 'National' ? 'blue' : 'purple'}>{r.type}</Badge> },
              { key: 'scope', header: 'Applies to' },
              { key: 'weekend', header: '', align: 'right', render: (r) => isWeekend(r.date)
                ? <Badge tone="gray">Falls on a weekend</Badge> : null },
            ]}
            rows={companyHolidays}
          />
        </Card>
      )}

      {tab === 'Optional holidays' && (
        <Card bodyClass="p-0"
          subtitle={`Choose any ${OPTIONAL_HOLIDAY_QUOTA} from this list - ${remaining} remaining`}>
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
            <div className="w-full sm:w-64"><SearchInput value={q} onChange={setQ} placeholder="Search holidays..." /></div>
            <Select value={scope} onChange={setScope} options={scopes} />
            {remaining === 0 && <Badge tone="amber">Quota used - further requests need manager approval</Badge>}
          </div>
          <Table
            columns={[
              { key: 'date', header: 'Date', mono: true, render: (r) => prettyDate(r.date) },
              { key: 'day', header: 'Day', render: (r) => (
                <span className={isWeekend(r.date) ? 'text-faint' : ''}>{weekdayOf(r.date)}</span>
              )},
              { key: 'name', header: 'Occasion' },
              { key: 'scope', header: 'Commonly observed in', render: (r) => <Badge tone="blue">{r.scope}</Badge> },
              { key: 'action', header: '', align: 'right', render: (r) => applied.includes(r.date)
                ? <Badge tone="green"><Check size={10} className="inline" /> Applied</Badge>
                : isWeekend(r.date)
                  ? <span className="text-[11px] text-faint">Already a non-working day</span>
                  : <button className="btn-secondary px-2 py-1" onClick={() => setPick(r)}>Apply</button>
              },
            ]}
            rows={optional}
            empty="No optional holidays match these filters."
          />
        </Card>
      )}

      <Modal
        open={Boolean(pick)}
        onClose={() => setPick(null)}
        title="Apply for an optional holiday"
        subtitle="Creates a leave request for your manager to approve"
        footer={<>
          <button className="btn-ghost" onClick={() => setPick(null)}>Cancel</button>
          <button className="btn-primary" onClick={confirmApply} disabled={applied.includes(pick?.date)}>
            Apply for this day
          </button>
        </>}>
        {pick && (
          <div className="space-y-3">
            <div className="rounded-lg bg-canvas p-3.5">
              <p className="h2">{pick.name}</p>
              <p className="text-[12px] text-muted mt-1 font-mono">{prettyDate(pick.date)} - {weekdayOf(pick.date)}</p>
              <p className="text-[11px] text-muted mt-1">Commonly observed in {pick.scope}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-line p-3">
                <p className="text-[10px] uppercase tracking-wide text-faint">Quota</p>
                <p className="text-[13px] text-navy mt-0.5">{applied.length} of {OPTIONAL_HOLIDAY_QUOTA} used</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-[10px] uppercase tracking-wide text-faint">Deducted from</p>
                <p className="text-[13px] text-navy mt-0.5">Optional holiday quota</p>
              </div>
            </div>
            {remaining <= 0 && (
              <p className="text-[12px] text-[#D97706]">
                You have used both optional holidays for {HOLIDAY_YEAR}. This request will need
                explicit manager approval.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

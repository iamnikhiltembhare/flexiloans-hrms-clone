import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Clock, CheckCircle2, XCircle, Home, Download, CalendarPlus, Check, X } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, Tabs, statusTone } from '../components/ui.jsx'
import RegulariseModal from '../components/RegulariseModal.jsx'
import AttendanceInfo from './AttendanceInfo.jsx'
import { attendanceLog, attendanceSummary, attendanceTrend } from '../data/mock.js'
import { companyHolidays, prettyDate, weekdayOf } from '../data/holidays.js'
import { Link } from 'react-router-dom'
import { useApp } from '../context/DataContext.jsx'
import { downloadCSV } from '../lib/download.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'
import { localDate } from '../lib/actions.js'

export default function Attendance() {
  const { toast, regularisations } = useApp()
  const { user, can } = useAuth()
  const [tab, setTab] = useState('Attendance info')
  // Regularisation form: opened from the header button or any calendar day.
  const [reg, setReg] = useState(null)
  const openReg = (prefill) => setReg({ ...prefill, opened: Date.now() })
  const approver = can(PERMS.HR_PEOPLE)
  const waiting = regularisations.filter((r) => r.status === 'Pending' && r.empId !== user?.id).length
  const regTab = approver && waiting ? 'Regularisations (' + waiting + ')' : 'Regularisations'

  const exportLog = () => {
    downloadCSV('flexiloans-attendance-sep-2026.csv', [
      { header: 'Date', key: 'date' }, { header: 'Day', key: 'day' },
      { header: 'Check in', key: 'checkIn' }, { header: 'Check out', key: 'checkOut' },
      { header: 'Hours', key: 'hours' }, { header: 'Status', key: 'status' },
    ], attendanceLog)
    toast('Export ready', attendanceLog.length + ' attendance rows exported to CSV')
  }


  const hoursData = attendanceLog
    .filter((d) => d.hours !== '--')
    .slice(0, 12)
    .reverse()
    .map((d) => ({ date: d.date.slice(8), hours: parseFloat(d.hours) }))

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="September 2026 - 22 working days"
        actions={<>
          <button className="btn-secondary" onClick={exportLog}><Download size={13} /> Export</button>
          <button className="btn-primary" onClick={() => openReg({ date: localDate() })}><CalendarPlus size={13} /> Regularise</button>
        </>}
      />

      {tab !== 'Attendance info' && !tab.startsWith('Regularisations') && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Present" value={attendanceSummary.present} hint="days this month" icon={CheckCircle2} tone="green" />
        <StatCard label="Absent" value={attendanceSummary.absent} hint="1 unapproved" icon={XCircle} tone="red" />
        <StatCard label="Work from home" value={attendanceSummary.wfh} hint="within policy limit of 8" icon={Home} tone="blue" />
        <StatCard label="Average hours" value={attendanceSummary.avgHours} hint={attendanceSummary.lateMarks + ' late marks'} icon={Clock} tone="cyan" />
      </div>}

      <Tabs tabs={['Attendance info', regTab, 'My attendance', 'Team view', 'Holiday calendar']}
        active={tab.startsWith('Regularisations') ? regTab : tab} onChange={setTab} />

      {tab === 'Attendance info' && (
        <AttendanceInfo onRegularise={(day) => openReg({ date: day.date, recordedIn: day.firstIn, recordedOut: day.lastOut })} />
      )}

      {tab.startsWith('Regularisations') && <Regularisations />}

      {tab === 'My attendance' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Daily log" subtitle="Most recent first" className="lg:col-span-2" bodyClass="p-0">
            <Table
              columns={[
                { key: 'date', header: 'Date', mono: true },
                { key: 'day', header: 'Day' },
                { key: 'checkIn', header: 'Check in', mono: true },
                { key: 'checkOut', header: 'Check out', mono: true },
                { key: 'hours', header: 'Hours', mono: true },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
              ]}
              rows={attendanceLog}
            />
          </Card>

          <Card title="Hours logged" subtitle="Last 12 working days">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 12]} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Bar dataKey="hours" fill="#00B4D8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted mt-2">Standard shift is 9 hours including a 1-hour break.</p>
          </Card>
        </div>
      )}

      {tab === 'Team view' && (
        <Card title="Team attendance" subtitle="Company-wide, current week">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceTrend} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Bar dataKey="present" stackId="a" fill="#1B365D" />
                <Bar dataKey="wfh" stackId="a" fill="#00B4D8" />
                <Bar dataKey="absent" stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {tab === 'Holiday calendar' && (
        <Card title="Holiday calendar 2026" subtitle="Declared holidays for all India locations" bodyClass="p-0"
          actions={<Link to="/holidays" className="text-[11px] text-cyan-ink font-medium hover:underline">Open full calendar</Link>}>
          <Table
            columns={[
              { key: 'date', header: 'Date', mono: true, render: (r) => prettyDate(r.date) },
              { key: 'day', header: 'Day', render: (r) => weekdayOf(r.date) },
              { key: 'name', header: 'Occasion' },
              { key: 'type', header: 'Type', render: (r) => <Badge tone={r.type === 'National' ? 'blue' : 'purple'}>{r.type}</Badge> },
            ]}
            rows={companyHolidays}
          />
        </Card>
      )}

      <RegulariseModal prefill={reg} onClose={() => setReg(null)} />
    </>
  )
}

// Requests to correct a day's attendance. Employees see their own; HR sees
// everyone's and approves or rejects other people's pending requests.
function Regularisations() {
  const { regularisations, decideRegularisation, toast } = useApp()
  const { user, can } = useAuth()
  const approver = can(PERMS.HR_PEOPLE)
  const pending = regularisations.filter((r) => r.status === 'Pending' && r.empId !== user?.id)
  const mine = regularisations.filter((r) => r.empId === user?.id)

  const decide = (r, status) => {
    decideRegularisation(r.id, status)
    toast('Regularisation ' + status.toLowerCase(), r.employee + ' - ' + r.date, status === 'Approved' ? 'success' : 'warning')
  }

  const cols = (withEmployee, withActions) => [
    { key: 'id', header: 'Request', mono: true },
    ...(withEmployee ? [{ key: 'employee', header: 'Employee', render: (r) => (
      <span><span className="block text-[13px] text-navy font-medium">{r.employee}</span><span className="block text-[11px] text-muted font-mono">{r.empId}</span></span>
    ) }] : []),
    { key: 'date', header: 'Date', mono: true },
    { key: 'type', header: 'Type' },
    { key: 'in', header: 'Punch in', mono: true, render: (r) => r.in || '--' },
    { key: 'out', header: 'Punch out', mono: true, render: (r) => r.out || '--' },
    { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-[18rem] whitespace-normal text-[12.5px]">{r.reason}</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <span className="flex flex-col items-start gap-0.5">
        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
        {r.decidedBy && <span className="text-[10px] text-faint">by {r.decidedBy}</span>}
      </span>
    ) },
    ...(withActions ? [{ key: 'action', header: '', align: 'right', render: (r) => (
      <span className="flex gap-1.5 justify-end">
        <button className="btn bg-[#DCFCE7] text-[#15803D] ring-1 ring-[#15803D]/25 hover:bg-[#BBF7D0] px-2 py-1" onClick={() => decide(r, 'Approved')}><Check size={12} /> Approve</button>
        <button className="btn bg-[#FEE2E2] text-[#B91C1C] ring-1 ring-[#B91C1C]/25 hover:bg-[#FECACA] px-2 py-1" onClick={() => decide(r, 'Rejected')}><X size={12} /> Reject</button>
      </span>
    ) }] : []),
  ]

  return (
    <div className="grid gap-4">
      {approver && (
        <Card title="Pending my approval" subtitle="Approved times replace what was punched on the employee's calendar" bodyClass="p-0">
          <Table columns={cols(true, true)} rows={pending} empty="Nothing waiting for approval." />
        </Card>
      )}
      <Card title="My requests" subtitle="Click any date on the Attendance info calendar to raise one" bodyClass="p-0">
        <Table columns={cols(false, false)} rows={mine} empty="You have not asked to regularise any day yet." />
      </Card>
      {approver && (
        <Card title="All requests" bodyClass="p-0">
          <Table columns={cols(true, false)} rows={regularisations} />
        </Card>
      )}
    </div>
  )
}

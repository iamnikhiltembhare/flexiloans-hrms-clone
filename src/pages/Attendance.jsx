import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Clock, CheckCircle2, XCircle, Home, Download, CalendarPlus } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, Tabs, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { attendanceLog, attendanceSummary, attendanceTrend, holidays } from '../data/mock.js'
import { useApp } from '../context/DataContext.jsx'
import { downloadCSV } from '../lib/download.js'

const BLANK = { date: '', checkIn: '', checkOut: '', reason: '' }

export default function Attendance() {
  const { toast, notify } = useApp()
  const [tab, setTab] = useState('My attendance')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')

  const exportLog = () => {
    downloadCSV('flexiloans-attendance-sep-2026.csv', [
      { header: 'Date', key: 'date' }, { header: 'Day', key: 'day' },
      { header: 'Check in', key: 'checkIn' }, { header: 'Check out', key: 'checkOut' },
      { header: 'Hours', key: 'hours' }, { header: 'Status', key: 'status' },
    ], attendanceLog)
    toast('Export ready', attendanceLog.length + ' attendance rows exported to CSV')
  }

  const submitReg = (e) => {
    e.preventDefault()
    if (!form.date) { setErr('Pick the date you want regularised.'); return }
    notify({ title: 'Regularisation submitted', detail: form.date + ' sent to Aarti Deshmukh', to: '/attendance', kind: 'task' })
    toast('Regularisation submitted', form.date + ' is pending manager approval')
    setForm(BLANK); setErr(''); setOpen(false)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

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
          <button className="btn-primary" onClick={() => setOpen(true)}><CalendarPlus size={13} /> Regularise</button>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <StatCard label="Present" value={attendanceSummary.present} hint="days this month" icon={CheckCircle2} tone="green" />
        <StatCard label="Absent" value={attendanceSummary.absent} hint="1 unapproved" icon={XCircle} tone="red" />
        <StatCard label="Work from home" value={attendanceSummary.wfh} hint="within policy limit of 8" icon={Home} tone="blue" />
        <StatCard label="Average hours" value={attendanceSummary.avgHours} hint={attendanceSummary.lateMarks + ' late marks'} icon={Clock} tone="cyan" />
      </div>

      <Tabs tabs={['My attendance', 'Team view', 'Holiday calendar']} active={tab} onChange={setTab} />

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
        <Card title="Holiday calendar 2026" subtitle="Declared holidays for all India locations" bodyClass="p-0">
          <Table
            columns={[
              { key: 'date', header: 'Date', mono: true },
              { key: 'day', header: 'Day' },
              { key: 'name', header: 'Occasion' },
              { key: 'type', header: 'Type', render: (r) => <Badge tone={r.type === 'National' ? 'blue' : 'purple'}>{r.type}</Badge> },
            ]}
            rows={holidays}
          />
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Regularise attendance" subtitle="For a missed punch or an incorrect entry"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={submitReg}>Submit</button>
        </>}>
        <form onSubmit={submitReg} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Date *</label><input type="date" className="input" value={form.date} onChange={set('date')} /></div>
          <div><label className="label">Check in</label><input type="time" className="input" value={form.checkIn} onChange={set('checkIn')} /></div>
          <div><label className="label">Check out</label><input type="time" className="input" value={form.checkOut} onChange={set('checkOut')} /></div>
          <div className="sm:col-span-2"><label className="label">Reason</label><textarea className="input min-h-[80px]" value={form.reason} onChange={set('reason')} placeholder="Client visit, network issue, forgot to punch out..." /></div>
          {err && <p className="sm:col-span-2 text-[12px] text-[#DC2626]">{err}</p>}
        </form>
      </Modal>
    </>
  )
}

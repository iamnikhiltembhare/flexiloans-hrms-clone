import { useState } from 'react'
import { Plus, Check, X, Download } from 'lucide-react'
import { PageHeader, Card, Table, Badge, Tabs, Progress, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { leaveBalances, holidays } from '../data/mock.js'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { downloadCSV } from '../lib/download.js'

const BLANK = { type: 'Casual Leave', from: '', to: '', reason: '' }

export default function Leave() {
  const { leaveRequests, addLeaveRequest, setLeaveStatus, toast, notify } = useApp()
  const { user } = useAuth()
  const [tab, setTab] = useState('My requests')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')

  const act = (r, status) => {
    setLeaveStatus(r.id, status)
    toast('Leave ' + status.toLowerCase(), r.id + ' for ' + r.employee + ' was ' + status.toLowerCase(),
      status === 'Approved' ? 'success' : 'warning')
    notify({ title: 'Leave ' + status.toLowerCase(), detail: r.employee + ' - ' + r.type + ' (' + r.days + 'd)', to: '/leave', kind: 'leave' })
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.from || !form.to) { setErr('Pick both a start and an end date.'); return }
    if (new Date(form.to) < new Date(form.from)) { setErr('The end date cannot be before the start date.'); return }
    const days = Math.max(1, Math.round((new Date(form.to) - new Date(form.from)) / 86400000) + 1)
    addLeaveRequest({
      employee: user.name, empId: user.id, type: form.type,
      from: form.from, to: form.to, days, reason: form.reason.trim() || 'Personal',
    })
    notify({ title: 'Leave request submitted', detail: days + ' day' + (days > 1 ? 's' : '') + ' of ' + form.type + ' sent to Aarti Deshmukh', to: '/leave', kind: 'leave' })
    toast('Request submitted', days + ' day' + (days > 1 ? 's' : '') + ' of ' + form.type + ' sent for approval')
    setForm(BLANK); setErr(''); setOpen(false); setTab('My requests')
  }

  const exportLeave = () => {
    downloadCSV('flexiloans-leave-requests.csv', [
      { header: 'Request', key: 'id' }, { header: 'Employee', key: 'employee' }, { header: 'Type', key: 'type' },
      { header: 'From', key: 'from' }, { header: 'To', key: 'to' }, { header: 'Days', key: 'days' },
      { header: 'Reason', key: 'reason' }, { header: 'Status', key: 'status' },
    ], leaveRequests)
    toast('Export ready', leaveRequests.length + ' leave records exported to CSV')
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const baseCols = [
    { key: 'id', header: 'Request', mono: true },
    { key: 'type', header: 'Leave type' },
    { key: 'from', header: 'From', mono: true },
    { key: 'to', header: 'To', mono: true },
    { key: 'days', header: 'Days', align: 'right', mono: true },
    { key: 'reason', header: 'Reason' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  ]

  const approvalCols = [
    { key: 'employee', header: 'Employee', render: (r) => (
      <span><span className="block text-[13px] text-navy font-medium">{r.employee}</span>
      <span className="block text-[11px] text-muted font-mono">{r.empId}</span></span>
    )},
    ...baseCols.slice(1, 6),
    { key: 'action', header: 'Action', align: 'right', render: (r) => r.status === 'Pending' ? (
      <span className="flex gap-1.5 justify-end">
        <button className="btn bg-[rgba(22,163,74,0.1)] text-[#16A34A] hover:bg-[rgba(22,163,74,0.18)] px-2 py-1" onClick={() => act(r, 'Approved')}><Check size={12} /> Approve</button>
        <button className="btn bg-[rgba(220,38,38,0.1)] text-[#DC2626] hover:bg-[rgba(220,38,38,0.18)] px-2 py-1" onClick={() => act(r, 'Rejected')}><X size={12} /> Reject</button>
      </span>
    ) : <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  ]

  const pending = leaveRequests.filter((r) => r.empId !== user.id)

  return (
    <>
      <PageHeader
        title="Leave management"
        subtitle="Financial year 2026-27"
        actions={<>
          <button className="btn-secondary" onClick={exportLeave}><Download size={13} /> Export</button>
          <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={13} /> Apply for leave</button>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 mb-4">
        {leaveBalances.map((l) => (
          <Card key={l.code} bodyClass="p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] font-medium uppercase tracking-wide text-faint">{l.type}</p>
              <span className="text-[10px] font-mono text-faint">{l.code}</span>
            </div>
            <p className="mt-1.5 text-2xl font-semibold font-mono" style={{ color: l.color }}>
              {l.total - l.used}<span className="text-sm text-faint"> / {l.total}</span>
            </p>
            <div className="mt-2"><Progress value={l.total ? ((l.total - l.used) / l.total) * 100 : 0} color={l.color} /></div>
            <p className="text-[10px] text-muted mt-1.5">{l.used} used</p>
          </Card>
        ))}
      </div>

      <Tabs tabs={['My requests', 'Pending my approval', 'Upcoming holidays']} active={tab} onChange={setTab} />

      {tab === 'My requests' && <Card bodyClass="p-0"><Table columns={baseCols} rows={leaveRequests} /></Card>}

      {tab === 'Pending my approval' && (
        <Card bodyClass="p-0">
          <Table columns={approvalCols} rows={pending} empty="Nothing awaiting your approval." />
        </Card>
      )}

      {tab === 'Upcoming holidays' && (
        <Card bodyClass="p-0">
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

      <Modal open={open} onClose={() => setOpen(false)} title="Apply for leave" subtitle="Goes to your reporting manager for approval"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Submit request</button>
        </>}>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Leave type</label>
            <select className="input" value={form.type} onChange={set('type')}>
              {leaveBalances.map((l) => <option key={l.code}>{l.type}</option>)}
            </select>
          </div>
          <div><label className="label">From *</label><input type="date" className="input" value={form.from} onChange={set('from')} /></div>
          <div><label className="label">To *</label><input type="date" className="input" value={form.to} onChange={set('to')} /></div>
          <div className="sm:col-span-2"><label className="label">Reason</label><textarea className="input min-h-[80px]" value={form.reason} onChange={set('reason')} placeholder="Helps your manager decide faster" /></div>
          {err && <p className="sm:col-span-2 text-[12px] text-[#DC2626]">{err}</p>}
        </form>
      </Modal>
    </>
  )
}

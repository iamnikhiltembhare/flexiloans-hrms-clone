import { useMemo, useState } from 'react'
import { Plus, Inbox, Loader, CheckCircle2, AlertTriangle } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, SearchInput, Select, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const CATEGORIES = ['Payroll', 'IT', 'HR Records', 'Finance', 'Benefits']
const BLANK = { subject: '', category: 'IT', priority: 'Medium', description: '' }

export default function Helpdesk() {
  const { tickets, addTicket, setTicketStatus, toast, notify } = useApp()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [cat, setCat] = useState('All categories')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')

  const rows = useMemo(() => tickets.filter((t) =>
    (t.subject + t.id + t.raisedBy).toLowerCase().includes(q.toLowerCase())
    && (status === 'All statuses' || t.status === status)
    && (cat === 'All categories' || t.category === cat)
  ), [tickets, q, status, cat])

  const submit = (e) => {
    e.preventDefault()
    if (!form.subject.trim()) { setErr('Please describe the issue in the subject line.'); return }
    const id = addTicket({ subject: form.subject.trim(), category: form.category, priority: form.priority, raisedBy: user.name })
    notify({ title: 'Ticket ' + id + ' raised', detail: form.subject.trim(), to: '/helpdesk', kind: 'task' })
    toast('Ticket raised', id + ' has been sent to the ' + form.category + ' desk')
    setForm(BLANK); setErr(''); setOpen(false)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <PageHeader
        title="Helpdesk"
        subtitle="Employee queries across HR, Payroll, IT and Finance"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={13} /> Raise a ticket</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Open" value={tickets.filter((t) => t.status === 'Open').length} icon={Inbox} tone="blue" />
        <StatCard label="In progress" value={tickets.filter((t) => t.status === 'In Progress').length} icon={Loader} tone="amber" />
        <StatCard label="Resolved" value={tickets.filter((t) => t.status === 'Resolved').length} icon={CheckCircle2} tone="green" />
        <StatCard label="SLA breached" value={tickets.filter((t) => t.sla === 'Breached').length} icon={AlertTriangle} tone="red" />
      </div>

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <div className="w-full sm:w-64"><SearchInput value={q} onChange={setQ} placeholder="Search tickets..." /></div>
          <Select value={status} onChange={setStatus} options={['All statuses', 'Open', 'In Progress', 'Resolved']} />
          <Select value={cat} onChange={setCat} options={['All categories', ...CATEGORIES]} />
        </div>
        <Table
          columns={[
            { key: 'id', header: 'Ticket', mono: true },
            { key: 'subject', header: 'Subject' },
            { key: 'category', header: 'Category', render: (r) => <Badge tone="blue">{r.category}</Badge> },
            { key: 'raisedBy', header: 'Raised by' },
            { key: 'assignee', header: 'Assigned to' },
            { key: 'priority', header: 'Priority', render: (r) => <Badge tone={statusTone(r.priority)}>{r.priority}</Badge> },
            { key: 'sla', header: 'SLA', render: (r) => <Badge tone={r.sla === 'Breached' ? 'red' : r.sla === 'Met' ? 'green' : 'amber'}>{r.sla}</Badge> },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
            { key: 'action', header: '', align: 'right', render: (r) => (
              <span className="flex gap-1.5 justify-end">
                {r.status === 'Open' && (
                  <button className="btn-secondary px-2 py-1" onClick={() => { setTicketStatus(r.id, 'In Progress'); toast('Ticket picked up', r.id + ' moved to In Progress') }}>Start</button>
                )}
                {r.status !== 'Resolved' && (
                  <button className="btn bg-[rgba(22,163,74,0.1)] text-[#16A34A] hover:bg-[rgba(22,163,74,0.18)] px-2 py-1"
                    onClick={() => { setTicketStatus(r.id, 'Resolved'); toast('Ticket resolved', r.id + ' has been closed') }}>Resolve</button>
                )}
                {r.status === 'Resolved' && (
                  <button className="btn-ghost px-2 py-1" onClick={() => { setTicketStatus(r.id, 'Open'); toast('Ticket reopened', r.id + ' is open again', 'warning') }}>Reopen</button>
                )}
              </span>
            )},
          ]}
          rows={rows}
          empty="No tickets match these filters."
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Raise a ticket" subtitle="Goes to the relevant desk with an SLA clock"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Submit ticket</button>
        </>}>
        <form onSubmit={submit} className="grid gap-3">
          <div><label className="label">Subject *</label><input className="input" value={form.subject} onChange={set('subject')} placeholder="Briefly describe the issue" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Category</label>
              <select className="input" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div><label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={set('priority')}><option>Low</option><option>Medium</option><option>High</option></select>
            </div>
          </div>
          <div><label className="label">Details</label><textarea className="input min-h-[90px]" value={form.description} onChange={set('description')} placeholder="Anything that helps the desk resolve this faster" /></div>
          {err && <p className="text-[12px] text-[#DC2626]">{err}</p>}
        </form>
      </Modal>
    </>
  )
}

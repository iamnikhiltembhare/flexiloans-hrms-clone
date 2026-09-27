import { useMemo, useState } from 'react'
import { Plus, Inbox, Loader, CheckCircle2, AlertTriangle, ShieldCheck, Check, X } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, SearchInput, Select, Tabs, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'
import { TICKET_DESKS, TICKET_STATUSES, needsAdminApproval, ticketClosed } from '../lib/actions.js'
import { haptic } from '../lib/native.js'

const CATEGORIES = Object.keys(TICKET_DESKS)
// Another department's ticket still waiting for a super admin's decision.
const awaitingApproval = (t) => needsAdminApproval(t.category) && !ticketClosed(t.status) && t.status !== 'Approved'
const BLANK = { subject: '', category: 'IT', priority: 'Medium', description: '' }

export default function Helpdesk() {
  const { tickets, addTicket, setTicketStatus, toast, notify } = useApp()
  const { user, can } = useAuth()
  const admin = can(PERMS.ADMIN_SYSTEM)
  const [view, setView] = useState('all') // 'all' | 'approval'
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [cat, setCat] = useState('All categories')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')

  const pendingApproval = tickets.filter(awaitingApproval)
  const approvalTab = 'Needs approval (' + pendingApproval.length + ')'

  const rows = useMemo(() => tickets.filter((t) =>
    (view !== 'approval' || awaitingApproval(t))
    && (t.subject + t.id + t.raisedBy).toLowerCase().includes(q.toLowerCase())
    && (status === 'All statuses' || t.status === status)
    && (cat === 'All categories' || t.category === cat)
  ), [tickets, q, status, cat, view])

  const submit = (e) => {
    e.preventDefault()
    if (!form.subject.trim()) { setErr('Please describe the issue in the subject line.'); return }
    const id = addTicket({ subject: form.subject.trim(), category: form.category, priority: form.priority, raisedBy: user.name })
    notify({ title: 'Ticket ' + id + ' raised', detail: form.subject.trim(), to: '/helpdesk', kind: 'task' })
    toast('Ticket raised', id + ' has been sent to the ' + form.category + ' desk')
    setForm(BLANK); setErr(''); setOpen(false)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const decide = (t, status) => {
    haptic(status === 'Approved' ? 'success' : 'warning')
    setTicketStatus(t.id, status)
    toast('Ticket ' + status.toLowerCase(), t.id + ' (' + t.category + ') was ' + status.toLowerCase() + ' - ' + t.raisedBy + ' has been told',
      status === 'Approved' ? 'success' : 'warning')
  }
  const move = (t, status, title, detail, kind) => { setTicketStatus(t.id, status); toast(title, detail, kind) }

  // What this person can do with a ticket: HR works HR-owned tickets; a
  // super admin approves other departments' tickets and can work any ticket.
  const actions = (r) => {
    const other = needsAdminApproval(r.category)
    if (other && !admin) {
      return awaitingApproval(r) ? <Badge tone="amber">Awaiting admin approval</Badge> : null
    }
    if (other && awaitingApproval(r)) {
      return (
        <>
          <button className="btn bg-[#DCFCE7] text-[#15803D] ring-1 ring-[#15803D]/25 hover:bg-[#BBF7D0] px-2 py-1" onClick={() => decide(r, 'Approved')}><Check size={12} /> Approve</button>
          <button className="btn bg-[#FEE2E2] text-[#B91C1C] ring-1 ring-[#B91C1C]/25 hover:bg-[#FECACA] px-2 py-1" onClick={() => decide(r, 'Rejected')}><X size={12} /> Reject</button>
        </>
      )
    }
    if (ticketClosed(r.status)) {
      return <button className="btn-ghost px-2 py-1" onClick={() => move(r, 'Open', 'Ticket reopened', r.id + ' is open again', 'warning')}>Reopen</button>
    }
    return (
      <>
        {r.status === 'Open' && <button className="btn-secondary px-2 py-1" onClick={() => move(r, 'In Progress', 'Ticket picked up', r.id + ' moved to In Progress')}>Start</button>}
        <button className="btn bg-[#DCFCE7] text-[#15803D] ring-1 ring-[#15803D]/25 hover:bg-[#BBF7D0] px-2 py-1"
          onClick={() => move(r, 'Resolved', 'Ticket resolved', r.id + ' has been closed')}>Resolve</button>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Helpdesk"
        subtitle="Employee queries across HR, Payroll, IT and Finance"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={13} /> Raise a ticket</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-4 stagger">
        <StatCard label="Open" value={tickets.filter((t) => t.status === 'Open').length} icon={Inbox} tone="blue" />
        <StatCard label="In progress" value={tickets.filter((t) => t.status === 'In Progress').length} icon={Loader} tone="amber" />
        <StatCard label="Awaiting approval" value={pendingApproval.length} hint="IT and Finance tickets" icon={ShieldCheck} tone="purple" />
        <StatCard label="Resolved" value={tickets.filter((t) => t.status === 'Resolved' || t.status === 'Approved').length} icon={CheckCircle2} tone="green" />
        <StatCard label="SLA breached" value={tickets.filter((t) => t.sla === 'Breached').length} icon={AlertTriangle} tone="red" />
      </div>

      {admin && <Tabs tabs={['All tickets', approvalTab]} active={view === 'approval' ? approvalTab : 'All tickets'} onChange={(t) => setView(t === 'All tickets' ? 'all' : 'approval')} />}
      {!admin && pendingApproval.length > 0 && (
        <p className="mb-3 text-[12px] text-muted">IT and Finance tickets belong to other departments and are approved by a super admin. HR can see them but not change them.</p>
      )}

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <div className="w-full sm:w-64"><SearchInput value={q} onChange={setQ} placeholder="Search tickets..." /></div>
          <Select value={status} onChange={setStatus} options={['All statuses', ...TICKET_STATUSES]} />
          <Select value={cat} onChange={setCat} options={['All categories', ...CATEGORIES]} />
        </div>
        <Table
          columns={[
            { key: 'id', header: 'Ticket', mono: true },
            { key: 'subject', header: 'Subject' },
            { key: 'category', header: 'Category', render: (r) => (
              <span className="flex flex-col items-start gap-0.5">
                <Badge tone={needsAdminApproval(r.category) ? 'purple' : 'blue'}>{r.category}</Badge>
                <span className="text-[10px] text-faint">{TICKET_DESKS[r.category]?.team === 'HR' ? 'HR desk' : (TICKET_DESKS[r.category]?.team || 'HR') + ' dept'}</span>
              </span>
            )},
            { key: 'raisedBy', header: 'Raised by' },
            { key: 'assignee', header: 'Assigned to' },
            { key: 'priority', header: 'Priority', render: (r) => <Badge tone={statusTone(r.priority)}>{r.priority}</Badge> },
            { key: 'sla', header: 'SLA', render: (r) => <Badge tone={r.sla === 'Breached' ? 'red' : r.sla === 'Met' ? 'green' : 'amber'}>{r.sla}</Badge> },
            { key: 'status', header: 'Status', render: (r) => (
              <span className="flex flex-col items-start gap-0.5">
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                {r.decidedBy && <span className="text-[10px] text-faint">by {r.decidedBy}</span>}
              </span>
            )},
            { key: 'action', header: '', align: 'right', render: (r) => <span className="flex gap-1.5 justify-end">{actions(r)}</span> },
          ]}
          rows={rows}
          empty={view === 'approval' ? 'Nothing is waiting for approval.' : 'No tickets match these filters.'}
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

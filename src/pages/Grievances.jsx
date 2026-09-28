import { useState } from 'react'
import { ShieldAlert, Lock, Clock, AlertOctagon, CheckCircle2, Plus, EyeOff } from 'lucide-react'
import { PageHeader, Card, Badge, StatCard, Tabs, Table } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'
import { GRIEVANCE_CATEGORIES, GRIEVANCE_SEVERITIES, GRIEVANCE_STATUSES, SLA_DAYS, grievanceSla, severityFor } from '../lib/hr/growth.js'
import { localDate } from '../lib/actions.js'
import { visibleTo } from '../../server/rules.js'

const sevTone = (s) => ({ Critical: 'red', High: 'amber', Medium: 'blue', Low: 'gray' }[s] || 'gray')
const stTone = (s) => ({ Submitted: 'amber', 'Under investigation': 'blue', 'Action taken': 'green', Closed: 'gray' }[s] || 'gray')

function SlaBadge({ g }) {
  const sla = grievanceSla(g, localDate())
  if (!sla.open) return <Badge tone="gray">Done</Badge>
  if (sla.overdue) return <Badge tone="red">Escalated - {-sla.daysLeft}d over</Badge>
  return <Badge tone={sla.daysLeft <= 1 ? 'amber' : 'green'}>{sla.daysLeft}d left</Badge>
}

function Timeline({ g }) {
  const items = [{ at: g.created + 'T09:00:00.000Z', by: g.anonymous && !g.raisedBy ? 'Anonymous' : g.raisedBy || 'You', note: 'Case raised', internal: false, first: true }, ...(g.updates || [])]
  return (
    <ol className="relative border-l border-line ml-2 space-y-3">
      {items.map((u, i) => (
        <li key={i} className="ml-4">
          <span className={'absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ' + (u.internal ? 'bg-[#7C3AED]' : u.fromRaiser ? 'bg-[#D97706]' : 'bg-cyan')} />
          <p className="text-[11px] text-faint">{u.at.slice(0, 16).replace('T', ' ')} - {u.by}{u.status ? ' - ' + u.status : ''}</p>
          <p className={'text-[13px] mt-0.5 ' + (u.first ? 'text-muted' : 'text-body')}>{u.note}</p>
          {u.internal && <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#7C3AED]"><Lock size={10} /> Internal note - not shown to the raiser</span>}
        </li>
      ))}
    </ol>
  )
}

function CaseModal({ g, hr, me, onClose }) {
  const { hrAction, toast } = useApp()
  const [f, setF] = useState({ status: g?.status, assignedTo: g?.assignedTo || '', note: '', internal: false })
  const [reply, setReply] = useState('')
  if (!g) return null
  const own = g.raisedById === me
  const manage = hr && !own && g.status !== 'Closed'
  const save = () => {
    const r = hrAction('grievance.update', { id: g.id, ...f })
    if (r.ok) { toast('Case updated', g.id + ' - ' + f.status); onClose() }
  }
  const send = () => {
    const r = hrAction('grievance.reply', { id: g.id, note: reply })
    if (r.ok) { toast('Reply sent', 'HR will see it on ' + g.id); setReply('') }
  }
  return (
    <Modal open onClose={onClose} width="max-w-2xl" title={g.id + ' - ' + g.subject} subtitle={g.category + ' - raised ' + g.created}
      footer={manage ? <><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save update</button></> : <button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge tone={sevTone(g.severity)}>{g.severity}</Badge><Badge tone={stTone(g.status)}>{g.status}</Badge><SlaBadge g={g} />
        {g.anonymous && <Badge tone="purple">Anonymous</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4 text-[12px]">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">Raised by</p><p className="text-body mt-0.5">{g.raisedBy ? g.raisedBy + (own ? ' (you)' : '') : 'Hidden - anonymous case'}</p></div>
        <div><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">Handled by</p><p className="text-body mt-0.5">{g.assignedTo || 'Not assigned yet'}</p></div>
      </div>
      <p className="rounded-xl bg-canvas p-3 text-[13px] text-body mb-4 whitespace-pre-wrap">{g.description}</p>
      <Timeline g={g} />

      {own && g.status !== 'Closed' && (
        <div className="mt-4">
          <label className="label">Add information or reply to HR{g.anonymous ? ' (stays anonymous)' : ''}</label>
          <textarea className="input min-h-[70px]" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex justify-end mt-2"><button className="btn-secondary" onClick={send}>Send reply</button></div>
        </div>
      )}
      {hr && own && <p className="mt-4 text-[12px] text-muted">This is your own case, so someone else in HR handles it.</p>}
      {manage && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-xl border border-line p-3">
          <div><label className="label">Status</label><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{GRIEVANCE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label">Investigator</label><input className="input" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })} placeholder="Internal Committee, a named HRBP..." /></div>
          <div className="sm:col-span-2"><label className="label">Note {f.status !== g.status ? '(required for a status change)' : ''}</label><textarea className="input min-h-[70px]" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-body"><input type="checkbox" checked={f.internal} onChange={(e) => setF({ ...f, internal: e.target.checked })} /> Internal note - hide it from the person who raised the case</label>
        </div>
      )}
    </Modal>
  )
}

const BLANK = { category: GRIEVANCE_CATEGORIES[2], severity: 'Medium', subject: '', description: '', anonymous: false }

export default function Grievances() {
  const { grievances: all = [], hrAction, toast } = useApp()
  const { user, can } = useAuth()
  // The server already applies this; the offline demo relies on it here.
  const grievances = visibleTo({ id: user?.id, perms: user?.perms || [] }, 'grievances', all)
  const hr = can(PERMS.HR_PEOPLE)
  const [tab, setTab] = useState(hr ? 'Case queue' : 'My cases')
  const [openId, setOpenId] = useState(null)
  const [raising, setRaising] = useState(false)
  const [f, setF] = useState(BLANK)
  const today = localDate()
  const mine = grievances.filter((g) => g.raisedById === user?.id)
  const queue = hr ? grievances : []
  const openCases = queue.filter((g) => grievanceSla(g, today).open)
  const escalated = openCases.filter((g) => grievanceSla(g, today).overdue)

  const raise = () => {
    const r = hrAction('grievance.add', { grievance: f })
    if (r.ok) { toast('Case raised', r.result + ' - HR will respond within ' + SLA_DAYS[severityFor(f.category, f.severity)] + ' days'); setRaising(false); setF(BLANK); setTab('My cases') }
  }
  const current = grievances.find((g) => g.id === openId)
  const columns = (withRaiser) => [
    { key: 'id', header: 'Case', mono: true, render: (r) => <button className="font-mono text-navy hover:underline" onClick={() => setOpenId(r.id)}>{r.id}</button> },
    { key: 'subject', header: 'Subject', render: (r) => <span><span className="block text-[13px] text-navy">{r.subject}</span><span className="block text-[11px] text-muted">{r.category}</span></span> },
    ...(withRaiser ? [{ key: 'raisedBy', header: 'Raised by', render: (r) => (r.raisedBy ? r.raisedBy : <span className="inline-flex items-center gap-1 text-muted"><EyeOff size={12} /> Anonymous</span>) }] : []),
    { key: 'severity', header: 'Severity', render: (r) => <Badge tone={sevTone(r.severity)}>{r.severity}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={stTone(r.status)}>{r.status}</Badge> },
    { key: 'sla', header: 'SLA', render: (r) => <SlaBadge g={r} /> },
    { key: 'created', header: 'Raised', mono: true },
  ]

  return (
    <>
      <PageHeader title={hr ? 'Grievances' : 'Speak up'} subtitle="Confidential - only HR case handlers see a case. Anonymous cases never show who raised them."
        actions={<button className="btn-primary" onClick={() => setRaising(true)}><Plus size={13} /> Raise a concern</button>} />

      {hr && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
          <StatCard label="Open cases" value={openCases.length} hint={queue.filter((g) => g.status === 'Submitted').length + ' not picked up'} icon={ShieldAlert} tone="cyan" />
          <StatCard label="Escalated" value={escalated.length} hint="past their SLA" icon={AlertOctagon} tone={escalated.length ? 'red' : 'green'} />
          <StatCard label="POSH cases" value={queue.filter((g) => g.category === 'Harassment (POSH)' && grievanceSla(g, today).open).length} hint="with the Internal Committee" icon={Lock} tone="purple" />
          <StatCard label="Resolved" value={queue.length - openCases.length} hint="action taken or closed" icon={CheckCircle2} tone="green" />
        </div>
      )}

      {hr && <Tabs tabs={['Case queue', 'My cases']} active={tab} onChange={setTab} />}
      {tab === 'Case queue' && hr && <Card bodyClass="p-0"><Table columns={columns(true)} rows={[...queue].sort((a, b) => Number(grievanceSla(b, today).overdue) - Number(grievanceSla(a, today).overdue) || b.created.localeCompare(a.created))} /></Card>}
      {tab === 'My cases' && (
        mine.length ? <Card bodyClass="p-0"><Table columns={columns(false)} rows={mine} /></Card>
          : <Card><div className="py-10 text-center">
              <ShieldAlert size={28} className="mx-auto text-faint" />
              <p className="text-[13px] text-navy font-medium mt-3">You have not raised any concerns</p>
              <p className="text-[12px] text-muted mt-1 max-w-md mx-auto">Harassment, discrimination, safety, pay or manager conduct - raise it here, with your name or anonymously. Retaliation against anyone who speaks up is a disciplinary offence.</p>
            </div></Card>
      )}

      <CaseModal key={openId} g={current} hr={hr} me={user?.id} onClose={() => setOpenId(null)} />

      <Modal open={raising} onClose={() => setRaising(false)} title="Raise a concern" subtitle="Goes to HR case handlers only"
        footer={<><button className="btn-ghost" onClick={() => setRaising(false)}>Cancel</button><button className="btn-primary" onClick={raise}>Submit</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{GRIEVANCE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">How serious is it?</label><select className="input" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{GRIEVANCE_SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label">Subject *</label><input className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">What happened? *</label><textarea className="input min-h-[110px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="When, where, who was involved, and anything you have already tried." /></div>
          <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-line p-3 text-[13px] text-body">
            <input type="checkbox" className="mt-0.5" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} />
            <span><span className="font-medium text-navy">Raise anonymously</span><span className="block text-[11px] text-muted mt-0.5">HR will not see your name, here or in the audit log. You can still follow the case and reply. Anonymous cases can be harder to investigate.</span></span>
          </label>
          <p className="sm:col-span-2 text-[11px] text-muted"><Clock size={11} className="inline -mt-0.5" /> Response time: {SLA_DAYS[severityFor(f.category, f.severity)]} days for {severityFor(f.category, f.severity).toLowerCase()} cases{f.category === 'Harassment (POSH)' ? ' - POSH cases go straight to the Internal Committee' : ''}. Overdue cases escalate automatically.</p>
        </div>
      </Modal>
    </>
  )
}

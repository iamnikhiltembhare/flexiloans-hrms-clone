import { useMemo, useState } from 'react'
import { ClipboardCheck, UserPlus, CheckCircle2, Clock, ShieldCheck, Rocket } from 'lucide-react'
import { PageHeader, Card, Badge, StatCard, Progress, Avatar } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'
import { onboardingProgress } from '../lib/hr/people.js'
import { departments } from '../data/mock.js'

const OWNER_TONE = { HR: 'purple', IT: 'blue', Finance: 'green', Admin: 'amber', Manager: 'cyan', 'New joiner': 'red' }

function Checklist({ rec, canTick }) {
  const { hrAction } = useApp()
  const todayISO = new Date().toISOString().slice(0, 10)
  const tick = (t) => hrAction('onboarding.task', { id: rec.id, taskId: t.id, done: !t.done })
  const ack = (policy) => hrAction('onboarding.ack', { id: rec.id, policy })
  const acked = new Set((rec.acknowledgements || []).map((a) => a.policy))
  const { user } = useAuth()
  const isJoiner = rec.empId && rec.empId === user?.id

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-faint mb-2">Checklist</h3>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rec.tasks.map((t) => {
            const allowed = canTick(t)
            const late = !t.done && t.due < todayISO
            return (
              <li key={t.id} className="flex items-start gap-3 px-3 py-2.5">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#16A34A]" checked={t.done} disabled={!allowed}
                  onChange={() => tick(t)} aria-label={t.task} />
                <div className="min-w-0 flex-1">
                  <p className={'text-[13px] ' + (t.done ? 'text-muted line-through' : 'text-navy')}>{t.task}</p>
                  <p className="text-[11px] text-faint mt-0.5">Due {t.due}{t.done && t.doneBy ? ' - done by ' + t.doneBy : ''}</p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={OWNER_TONE[t.owner] || 'gray'}>{t.owner}</Badge>
                  {late && <Badge tone="red">Overdue</Badge>}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <div>
        <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-faint mb-2">Policy acknowledgements</h3>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {(rec.policies || []).map((p) => (
            <li key={p} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[13px] text-navy"><ShieldCheck size={14} className={acked.has(p) ? 'text-[#16A34A]' : 'text-faint'} />{p}</span>
              {acked.has(p) ? <Badge tone="green">Acknowledged</Badge>
                : isJoiner ? <button className="btn-secondary px-2 py-1" onClick={() => ack(p)}>I have read this</button>
                : <Badge tone="amber">Pending</Badge>}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-faint mt-2">Only the new joiner can acknowledge a policy. Documents go to the Document Center.</p>
      </div>
    </div>
  )
}

const BLANK = { source: '', name: '', role: '', department: 'Engineering', startDate: '', empId: '' }

export default function Onboarding() {
  const { onboarding = [], candidates, employees, hrAction, toast } = useApp()
  const { user, can } = useAuth()
  const hr = can(PERMS.HR_PEOPLE)
  const [openId, setOpenId] = useState(null)
  const [starting, setStarting] = useState(false)
  const [f, setF] = useState(BLANK)

  const mine = onboarding.filter((r) => r.empId === user?.id)
  const list = hr ? onboarding : mine
  const active = list.filter((r) => r.status !== 'Completed')
  const todayISO = new Date().toISOString().slice(0, 10)
  const overdue = active.reduce((s, r) => s + r.tasks.filter((t) => !t.done && t.due < todayISO).length, 0)
  const hired = useMemo(() => candidates.filter((c) => c.status === 'Hired' && !onboarding.some((r) => r.candidate === c.name)), [candidates, onboarding])
  const canTick = (rec) => (t) => hr || (rec.empId === user?.id && t.owner === 'New joiner')

  const pick = (e) => {
    const v = e.target.value
    const c = hired.find((x) => 'c:' + x.name === v)
    const emp = employees.find((x) => 'e:' + x.id === v)
    if (c) setF({ ...f, source: v, name: c.name, role: c.role.replace(/\s*\(x\d+\)$/, ''), empId: '' })
    else if (emp) setF({ ...f, source: v, name: emp.name, role: emp.designation, department: emp.department, startDate: emp.joinDate, empId: emp.id })
    else setF({ ...BLANK, source: v })
  }
  const start = (e) => {
    e.preventDefault()
    const candidate = f.source.startsWith('c:') ? f.name : ''
    const r = hrAction('onboarding.start', { record: { ...f, candidate } })
    if (r.ok) { toast('Onboarding started', f.name + ' - ' + r.result); setStarting(false); setF(BLANK); setOpenId(r.result) }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // An employee sees their own checklist straight away.
  if (!hr) {
    return (
      <>
        <PageHeader title="My onboarding" subtitle="Your first-month checklist and the policies to read" />
        {mine.length === 0 ? (
          <Card><div className="py-10 text-center">
            <Rocket size={28} className="mx-auto text-faint" />
            <p className="text-[13px] text-navy font-medium mt-3">You have no onboarding in progress</p>
            <p className="text-[12px] text-muted mt-1">HR starts a checklist when someone new joins.</p>
          </div></Card>
        ) : mine.map((rec) => {
          const p = onboardingProgress(rec)
          return (
            <Card key={rec.id} title={rec.role + ' - ' + rec.department} subtitle={'Started ' + rec.startDate + ' - ' + p.done + ' of ' + p.total + ' done'}
              actions={<Badge tone={rec.status === 'Completed' ? 'green' : 'amber'}>{rec.status}</Badge>} className="mb-4">
              <div className="mb-4"><Progress value={p.percent} color="#16A34A" /></div>
              <Checklist rec={rec} canTick={canTick(rec)} />
            </Card>
          )
        })}
      </>
    )
  }

  const current = onboarding.find((r) => r.id === openId)
  return (
    <>
      <PageHeader title="Onboarding" subtitle="New-joiner checklists across HR, IT, Finance, Admin and managers"
        actions={<button className="btn-primary" onClick={() => setStarting(true)}><UserPlus size={13} /> Start onboarding</button>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="In progress" value={active.length} hint="new joiners being set up" icon={ClipboardCheck} tone="cyan" />
        <StatCard label="Completed" value={list.length - active.length} hint="all tasks and policies done" icon={CheckCircle2} tone="green" />
        <StatCard label="Overdue tasks" value={overdue} hint="past their due date" icon={Clock} tone={overdue ? 'red' : 'green'} />
        <StatCard label="Hires to onboard" value={hired.length} hint="hired in Recruitment, not started" icon={UserPlus} tone="amber" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((rec) => {
          const p = onboardingProgress(rec)
          const late = rec.tasks.filter((t) => !t.done && t.due < todayISO).length
          return (
            <button key={rec.id} onClick={() => setOpenId(rec.id)} className="card p-4 text-left hover:shadow-tile transition-shadow">
              <div className="flex items-center gap-3">
                <Avatar name={rec.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-navy truncate">{rec.name}</p>
                  <p className="text-[11px] text-muted truncate">{rec.role} - {rec.department}</p>
                </div>
                <Badge tone={rec.status === 'Completed' ? 'green' : 'amber'}>{rec.status}</Badge>
              </div>
              <div className="mt-3"><Progress value={p.percent} color={rec.status === 'Completed' ? '#16A34A' : '#00B4D8'} /></div>
              <p className="mt-2 flex justify-between text-[11px] text-muted">
                <span>{p.done}/{p.total} done - starts {rec.startDate}</span>
                {late > 0 && <span className="text-[#DC2626] font-medium">{late} overdue</span>}
              </p>
            </button>
          )
        })}
      </div>

      <Modal open={!!current} onClose={() => setOpenId(null)} width="max-w-4xl" title={current?.name} subtitle={current ? current.id + ' - ' + current.role + ' - starts ' + current.startDate : ''}>
        {current && <Checklist rec={current} canTick={canTick(current)} />}
      </Modal>

      <Modal open={starting} onClose={() => setStarting(false)} title="Start onboarding" subtitle="Builds the checklist for the role and notifies the joiner"
        footer={<><button className="btn-ghost" onClick={() => setStarting(false)}>Cancel</button><button className="btn-primary" onClick={start}>Start</button></>}>
        <form onSubmit={start} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Who is joining?</label>
            <select className="input" value={f.source} onChange={pick}>
              <option value="">Someone new (type the details)</option>
              {hired.length > 0 && <optgroup label="Hired in Recruitment">{hired.map((c) => <option key={c.name} value={'c:' + c.name}>{c.name} - {c.role}</option>)}</optgroup>}
              <optgroup label="Recent joiners with a login">
                {employees.filter((e) => e.joinDate >= '2026-06-01' && !onboarding.some((r) => r.empId === e.id)).map((e) => <option key={e.id} value={'e:' + e.id}>{e.name} - {e.designation}</option>)}
              </optgroup>
            </select>
          </div>
          <div><label className="label">Name *</label><input className="input" value={f.name} onChange={set('name')} /></div>
          <div><label className="label">Role *</label><input className="input" value={f.role} onChange={set('role')} /></div>
          <div><label className="label">Department</label><select className="input" value={f.department} onChange={set('department')}>{departments.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className="label">Start date *</label><input className="input" type="date" value={f.startDate} onChange={set('startDate')} /></div>
        </form>
      </Modal>
    </>
  )
}

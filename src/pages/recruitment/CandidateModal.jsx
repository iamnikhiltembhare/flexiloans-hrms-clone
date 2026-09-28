import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Star, CheckCircle2, XCircle, UserCheck } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import { Badge, Field, Avatar } from '../../components/ui.jsx'
import { useApp } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { PERMS } from '../../data/accounts.js'
import { INTERVIEW_ROUNDS, INTERVIEW_MODES, RECOMMENDATIONS, CANDIDATE_SOURCES } from '../../lib/hr/people.js'

const recTone = (r) => ({ 'Strong hire': 'green', Hire: 'cyan', Hold: 'amber', 'No hire': 'red' }[r] || 'gray')

function Score({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={label + ' ' + n}
            className={'h-8 w-8 rounded-lg border text-[12px] font-semibold transition-colors ' +
              (n <= value ? 'bg-[#D97706] border-[#D97706] text-white' : 'border-line text-muted hover:border-[#D97706]')}>{n}</button>
        ))}
      </div>
    </div>
  )
}

/** One candidate: profile, interview schedule, scorecards and the hire decision. */
export default function CandidateModal({ candidate: c, onClose }) {
  const { hrAction, toast } = useApp()
  const { user, can } = useAuth()
  const [pane, setPane] = useState(null) // 'schedule' | 'evaluate' | 'reject'
  const [iv, setIv] = useState({ round: INTERVIEW_ROUNDS[0], at: '', interviewer: '', mode: INTERVIEW_MODES[0] })
  const [ev, setEv] = useState({ round: INTERVIEW_ROUNDS[0], technical: 0, communication: 0, culture: 0, recommendation: '', notes: '' })
  const [reason, setReason] = useState('')

  if (!c) return null
  const open = (c.status || 'Active') === 'Active'
  const close = () => { setPane(null); onClose() }

  const schedule = () => {
    const r = hrAction('candidate.schedule', { name: c.name, interview: iv })
    if (r.ok) { toast('Interview scheduled', iv.round + ' with ' + iv.interviewer); setPane(null); setIv({ ...iv, at: '', interviewer: '' }) }
  }
  const evaluate = () => {
    const r = hrAction('candidate.evaluate', { name: c.name, evaluation: ev })
    if (r.ok) { toast('Scorecard saved', ev.round + ' - ' + ev.recommendation); setPane(null); setEv({ ...ev, technical: 0, communication: 0, culture: 0, recommendation: '', notes: '' }) }
  }
  const decide = (decision) => {
    const r = hrAction('candidate.decide', { name: c.name, decision, reason })
    if (r.ok) { toast(decision === 'Hired' ? 'Candidate hired' : 'Candidate rejected', c.name + (decision === 'Hired' ? ' - start their onboarding next' : '')); setPane(null); setReason('') }
  }

  return (
    <Modal open onClose={close} width="max-w-2xl" title={c.name} subtitle={c.role}
      footer={open ? <>
        <button className="btn-ghost text-[#DC2626]" onClick={() => setPane('reject')}><XCircle size={13} /> Reject</button>
        <button className="btn-primary" onClick={() => decide('Hired')}><UserCheck size={13} /> Hire</button>
      </> : <button className="btn-secondary" onClick={close}>Close</button>}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={c.name} size={44} />
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="blue">{c.stage}</Badge>
          <Badge tone={c.status === 'Hired' ? 'green' : c.status === 'Rejected' ? 'red' : 'gray'}>{c.status || 'Active'}</Badge>
          <Badge tone="amber"><Star size={10} className="inline -mt-0.5 mr-0.5" />{c.rating ?? 'No score'}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Field label="Source" value={c.source} />
        <Field label="Applied" value={c.applied} />
        <Field label="Email" value={c.email} />
        <Field label="Experience" value={c.experience} />
      </div>

      {c.decision && (
        <div className={'rounded-xl border p-3 mb-4 text-[12px] ' + (c.status === 'Hired' ? 'border-[#16A34A]/40 bg-[#16A34A]/5' : 'border-[#DC2626]/40 bg-[#DC2626]/5')}>
          <p className="font-semibold text-navy">{c.status === 'Hired' ? 'Hired' : 'Not selected'} by {c.decision.by}</p>
          {c.decision.reason && <p className="text-muted mt-0.5">{c.decision.reason}</p>}
          {c.status === 'Hired' && can(PERMS.HR_PEOPLE) && <Link to="/onboarding" onClick={close} className="inline-block mt-2 text-cyan font-medium">Start onboarding &rarr;</Link>}
        </div>
      )}

      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-faint">Interviews</h3>
          {open && <button className="btn-ghost px-2 py-1" onClick={() => setPane(pane === 'schedule' ? null : 'schedule')}><CalendarClock size={13} /> Schedule</button>}
        </div>
        {pane === 'schedule' && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-line p-3 mb-3">
            <div><label className="label">Round</label><select className="input" value={iv.round} onChange={(e) => setIv({ ...iv, round: e.target.value })}>{INTERVIEW_ROUNDS.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div><label className="label">Date and time</label><input className="input" type="datetime-local" value={iv.at} onChange={(e) => setIv({ ...iv, at: e.target.value })} /></div>
            <div><label className="label">Interviewer</label><input className="input" value={iv.interviewer} onChange={(e) => setIv({ ...iv, interviewer: e.target.value })} placeholder={user?.name} /></div>
            <div><label className="label">Mode</label><select className="input" value={iv.mode} onChange={(e) => setIv({ ...iv, mode: e.target.value })}>{INTERVIEW_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary" onClick={schedule}>Book interview</button></div>
          </div>
        )}
        {(c.interviews || []).length === 0 ? <p className="text-[12px] text-muted">No interviews booked yet.</p> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {c.interviews.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12px]">
                <span><span className="font-medium text-navy">{i.round}</span> <span className="text-muted">with {i.interviewer} - {i.mode}</span></span>
                <span className="flex items-center gap-2"><span className="font-mono text-muted">{i.at.replace('T', ' ')}</span><Badge tone={i.status === 'Completed' ? 'green' : 'amber'}>{i.status}</Badge></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-faint">Scorecards</h3>
          {open && <button className="btn-ghost px-2 py-1" onClick={() => setPane(pane === 'evaluate' ? null : 'evaluate')}><CheckCircle2 size={13} /> Add scorecard</button>}
        </div>
        {pane === 'evaluate' && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-line p-3 mb-3">
            <div><label className="label">Round</label><select className="input" value={ev.round} onChange={(e) => setEv({ ...ev, round: e.target.value })}>{INTERVIEW_ROUNDS.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div><label className="label">Recommendation</label><select className="input" value={ev.recommendation} onChange={(e) => setEv({ ...ev, recommendation: e.target.value })}><option value="">Pick one</option>{RECOMMENDATIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
            <Score label="Technical / role skills" value={ev.technical} onChange={(n) => setEv({ ...ev, technical: n })} />
            <Score label="Communication" value={ev.communication} onChange={(n) => setEv({ ...ev, communication: n })} />
            <Score label="Culture fit" value={ev.culture} onChange={(n) => setEv({ ...ev, culture: n })} />
            <div className="sm:col-span-2"><label className="label">Notes</label><textarea className="input min-h-[70px]" value={ev.notes} onChange={(e) => setEv({ ...ev, notes: e.target.value })} placeholder="Strengths, concerns, salary expectations..." /></div>
            <div className="sm:col-span-2 flex justify-end"><button className="btn-primary" onClick={evaluate}>Save scorecard</button></div>
          </div>
        )}
        {(c.evaluations || []).length === 0 ? <p className="text-[12px] text-muted">No scorecards yet. A candidate needs at least one before they can be hired.</p> : (
          <div className="grid gap-2">
            {c.evaluations.map((e, i) => (
              <div key={i} className="rounded-xl border border-line p-3 text-[12px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-navy">{e.round} <span className="text-muted font-normal">by {e.by}</span></span>
                  <Badge tone={recTone(e.recommendation)}>{e.recommendation}</Badge>
                </div>
                <p className="text-muted mt-1 font-mono">Technical {e.technical} - Communication {e.communication} - Culture {e.culture}</p>
                {e.notes && <p className="text-body mt-1">{e.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {pane === 'reject' && (
        <div className="rounded-xl border border-[#DC2626]/40 p-3 mt-3">
          <label className="label">Reason (shared with the hiring team only)</label>
          <textarea className="input min-h-[60px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Skills gap on system design" />
          <div className="flex justify-end gap-2 mt-2">
            <button className="btn-ghost" onClick={() => setPane(null)}>Cancel</button>
            <button className="btn-primary bg-[#DC2626]" onClick={() => decide('Rejected')}>Confirm rejection</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const BLANK = { name: '', role: '', email: '', phone: '', source: 'LinkedIn', experience: '', resume: '' }

export function AddCandidateModal({ open, onClose, roles }) {
  const { hrAction, toast } = useApp()
  const [f, setF] = useState(BLANK)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    const r = hrAction('candidate.add', { candidate: f })
    if (r.ok) { toast('Candidate added', f.name + ' is shortlisted for ' + f.role); setF(BLANK); onClose() }
  }
  return (
    <Modal open={open} onClose={onClose} title="Add a candidate" subtitle="Starts at Shortlisted in the pipeline"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Add candidate</button></>}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Full name *</label><input className="input" value={f.name} onChange={set('name')} placeholder="Priya Nair" /></div>
        <div><label className="label">Role *</label>
          <input className="input" list="req-roles" value={f.role} onChange={set('role')} placeholder="Credit Analyst" />
          <datalist id="req-roles">{roles.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} /></div>
        <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
        <div><label className="label">Source</label><select className="input" value={f.source} onChange={set('source')}>{CANDIDATE_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label">Experience</label><input className="input" value={f.experience} onChange={set('experience')} placeholder="4 yrs" /></div>
        <div className="sm:col-span-2"><label className="label">Resume link</label><input className="input" value={f.resume} onChange={set('resume')} placeholder="https://drive.example.com/resume.pdf" /></div>
      </form>
    </Modal>
  )
}

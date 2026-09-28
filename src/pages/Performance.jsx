import { useMemo, useState } from 'react'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts'
import { Target, TrendingUp, Star, ListChecks, Plus, Pencil, Users } from 'lucide-react'
import { PageHeader, Card, Badge, StatCard, Tabs, Progress, Table, SearchInput } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'
import { COMPETENCIES, APPRAISAL_STAGES, CYCLE, RATING_LABEL } from '../lib/hr/people.js'

const stageTone = (s) => ({ 'Goal setting': 'gray', 'Self review': 'amber', 'Manager review': 'blue', Completed: 'green' }[s] || 'gray')
const weighted = (goals) => Math.round(goals.reduce((s, g) => s + g.progress * g.weight, 0) / Math.max(1, goals.reduce((s, g) => s + g.weight, 0)))
const goalStatus = (g) => (g.progress >= 70 ? 'On Track' : g.progress >= 45 ? 'At Risk' : 'Behind')
const goalColor = (g) => ({ 'On Track': '#16A34A', 'At Risk': '#D97706', Behind: '#DC2626' }[goalStatus(g)])

function Stepper({ status }) {
  const at = APPRAISAL_STAGES.indexOf(status)
  return (
    <ol className="flex flex-wrap items-center gap-2 mb-4">
      {APPRAISAL_STAGES.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={'grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ' +
            (i < at ? 'bg-[#16A34A] text-white' : i === at ? 'bg-cyan text-white' : 'bg-line text-muted')}>{i + 1}</span>
          <span className={'text-[12px] ' + (i === at ? 'font-semibold text-navy' : 'text-muted')}>{s}</span>
          {i < APPRAISAL_STAGES.length - 1 && <span className="h-px w-6 bg-line2" />}
        </li>
      ))}
    </ol>
  )
}

/** Rating form used for both the self review and the manager review. */
function ReviewForm({ value, onChange, who }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {COMPETENCIES.map((c) => (
          <div key={c}>
            <label className="label">{c}</label>
            <select className="input" value={value.competencies[c] || ''} onChange={(e) => set('competencies', { ...value.competencies, [c]: Number(e.target.value) })}>
              <option value="">Rate 1-5</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} - {RATING_LABEL(n)}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div>
        <label className="label">Overall rating: {value.rating} ({RATING_LABEL(value.rating)})</label>
        <input type="range" min="1" max="5" step="0.1" value={value.rating} onChange={(e) => set('rating', Number(e.target.value))} className="w-full accent-[#00B4D8]" />
      </div>
      <div>
        <label className="label">{who === 'Self' ? 'What went well, and where did you get stuck?' : 'Feedback for the employee'}</label>
        <textarea className="input min-h-[100px]" value={value.comments} onChange={(e) => set('comments', e.target.value)} />
      </div>
    </div>
  )
}
const blankReview = () => ({ rating: 3.5, comments: '', competencies: {} })

function Competencies({ a }) {
  const data = COMPETENCIES.map((c) => ({ name: c, self: a.self?.competencies?.[c] ?? 0, manager: a.manager?.competencies?.[c] ?? 0 }))
  if (!a.self) return <Card><p className="py-8 text-center text-[13px] text-muted">Competency ratings appear once the self review is submitted.</p></Card>
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Self vs manager rating" subtitle="Scale of 1 to 5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
              <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9, fill: '#9CA3AF' }} />
              <Radar name="Self" dataKey="self" stroke="#00B4D8" fill="#00B4D8" fillOpacity={0.25} />
              {a.manager && <Radar name="Manager" dataKey="manager" stroke="#1B365D" fill="#1B365D" fillOpacity={0.15} />}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Competency detail" bodyClass="p-0">
        <Table
          columns={[
            { key: 'name', header: 'Competency' },
            { key: 'self', header: 'Self', align: 'right', mono: true },
            { key: 'manager', header: 'Manager', align: 'right', mono: true, render: (r) => (a.manager ? r.manager : '--') },
            { key: 'gap', header: 'Gap', align: 'right', mono: true, render: (r) => {
              if (!a.manager) return '--'
              const gap = r.manager - r.self
              return <span className={gap >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}>{gap > 0 ? '+' : ''}{gap}</span>
            }},
          ]}
          rows={data}
        />
      </Card>
    </div>
  )
}

// Saves once the slider is let go, not on every step of the drag.
function ProgressSlider({ goal, onCommit }) {
  const [v, setV] = useState(goal.progress)
  const commit = () => { if (v !== goal.progress) onCommit(v) }
  return (
    <input type="range" min="0" max="100" step="5" value={v} aria-label={'Progress on ' + goal.title} className="range-progress w-full" style={{ '--fill': v + '%' }}
      onChange={(e) => setV(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
  )
}

function Goals({ a, editable, canProgress }) {
  const { hrAction, toast } = useApp()
  const [edit, setEdit] = useState(null)
  const total = a.goals.reduce((s, g) => s + g.weight, 0)
  const save = () => {
    const r = hrAction('appraisal.goal', { id: a.id, goal: { ...edit, weight: Number(edit.weight) } })
    if (r.ok) { toast('Goal saved', edit.title); setEdit(null) }
  }
  return (
    <Card title="Current cycle goals" subtitle={'Weights total ' + total + '%' + (total !== 100 ? ' - they must add up to 100% before the self review' : '')}
      actions={editable && <button className="btn-secondary" onClick={() => setEdit({ title: '', weight: 10, due: '2026-12-31' })}><Plus size={13} /> Add goal</button>}>
      <div className="space-y-5">
        {a.goals.map((g) => (
          <div key={g.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[13px] font-medium text-navy">{g.title}</span>
              <span className="flex items-center gap-2">
                <Badge tone="gray">Weight {g.weight}%</Badge>
                <Badge tone={goalStatus(g) === 'On Track' ? 'green' : goalStatus(g) === 'At Risk' ? 'amber' : 'red'}>{goalStatus(g)}</Badge>
                <span className="text-[12px] font-mono text-navy w-10 text-right">{g.progress}%</span>
                {editable && <button className="text-faint hover:text-navy" aria-label={'Edit ' + g.title} onClick={() => setEdit({ ...g })}><Pencil size={13} /></button>}
              </span>
            </div>
            {canProgress
              ? <ProgressSlider key={g.id + g.progress} goal={g} onCommit={(progress) => hrAction('appraisal.progress', { id: a.id, goalId: g.id, progress })} />
              : <Progress value={g.progress} color={goalColor(g)} />}
            <p className="text-[11px] text-faint mt-1.5">Due {g.due}</p>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit goal' : 'Add a goal'} subtitle={CYCLE}
        footer={<><button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save goal</button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Goal</label><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Make it specific and measurable" /></div>
            <div><label className="label">Weight (%)</label><input className="input" type="number" min="5" max="100" value={edit.weight} onChange={(e) => setEdit({ ...edit, weight: e.target.value })} /></div>
            <div><label className="label">Due</label><input className="input" type="date" value={edit.due} onChange={(e) => setEdit({ ...edit, due: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

function History({ a }) {
  const rows = [
    ...(a.status === 'Completed' ? [{ cycle: a.cycle, rating: a.manager.rating, by: a.manager.by }] : []),
    ...a.history.map((h) => ({ ...h, by: '--' })),
  ]
  return (
    <Card bodyClass="p-0">
      <Table
        columns={[
          { key: 'cycle', header: 'Cycle' },
          { key: 'rating', header: 'Rating', mono: true },
          { key: 'band', header: 'Band', render: (r) => <Badge tone={r.rating >= 4.5 ? 'green' : r.rating >= 3.8 ? 'cyan' : 'gray'}>{RATING_LABEL(r.rating)}</Badge> },
          { key: 'by', header: 'Reviewed by' },
        ]}
        rows={rows}
      />
    </Card>
  )
}

function TeamReviews({ list, me }) {
  const { hrAction, toast } = useApp()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('Manager review')
  const [openId, setOpenId] = useState(null)
  const [form, setForm] = useState(blankReview)
  const rows = list.filter((a) => (stage === 'All' || a.status === stage) && (!q || (a.employee + a.department).toLowerCase().includes(q.toLowerCase())))
  const a = list.find((x) => x.id === openId)
  const submit = () => {
    const r = hrAction('appraisal.review', { id: a.id, manager: form })
    if (r.ok) { toast('Review completed', a.employee + ' - ' + form.rating); setOpenId(null) }
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search people or departments" />
        {['Manager review', 'Self review', 'Goal setting', 'Completed', 'All'].map((s) => (
          <button key={s} onClick={() => setStage(s)} className={'rounded-full px-3 py-1 text-[12px] border ' + (stage === s ? 'border-cyan bg-cyan/10 text-navy font-semibold' : 'border-line text-muted')}>
            {s} <span className="font-mono">{s === 'All' ? list.length : list.filter((x) => x.status === s).length}</span>
          </button>
        ))}
      </div>
      <Card bodyClass="p-0">
        <Table
          empty="Nobody at this stage."
          columns={[
            { key: 'employee', header: 'Employee', render: (r) => <span><span className="block text-[13px] font-medium text-navy">{r.employee}</span><span className="block text-[11px] text-muted">{r.designation}</span></span> },
            { key: 'department', header: 'Department' },
            { key: 'goals', header: 'Goal progress', render: (r) => <span className="flex items-center gap-2 min-w-[110px]"><Progress value={weighted(r.goals)} /><span className="font-mono text-[11px]">{weighted(r.goals)}%</span></span> },
            { key: 'self', header: 'Self', mono: true, render: (r) => r.self?.rating ?? '--' },
            { key: 'manager', header: 'Final', mono: true, render: (r) => r.manager?.rating ?? '--' },
            { key: 'status', header: 'Stage', render: (r) => <Badge tone={stageTone(r.status)}>{r.status}</Badge> },
            { key: 'act', header: '', align: 'right', render: (r) => (
              r.status === 'Manager review' && r.empId !== me
                ? <button className="btn-primary px-2 py-1" onClick={() => { setForm({ ...blankReview(), competencies: { ...r.self.competencies }, rating: r.self.rating }); setOpenId(r.id) }}>Review</button>
                : <button className="btn-ghost px-2 py-1" onClick={() => setOpenId(r.id)}>View</button>
            )},
          ]}
          rows={rows}
        />
      </Card>

      <Modal open={!!a} onClose={() => setOpenId(null)} width="max-w-2xl" title={a?.employee} subtitle={a ? a.cycle + ' - ' + a.department : ''}
        footer={a?.status === 'Manager review' && a.empId !== me
          ? <><button className="btn-ghost" onClick={() => setOpenId(null)}>Cancel</button><button className="btn-primary" onClick={submit}>Complete review</button></>
          : <button className="btn-secondary" onClick={() => setOpenId(null)}>Close</button>}>
        {a && (
          <div className="grid gap-4">
            <Stepper status={a.status} />
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-faint mb-2">Goals - {weighted(a.goals)}% weighted</h3>
              <ul className="space-y-2">{a.goals.map((g) => (
                <li key={g.id} className="text-[12px]"><div className="flex justify-between gap-2 mb-1"><span className="text-navy">{g.title}</span><span className="font-mono text-muted">{g.weight}% - {g.progress}%</span></div><Progress value={g.progress} color={goalColor(g)} /></li>
              ))}</ul>
            </div>
            {a.self && (
              <div className="rounded-xl border border-line p-3 text-[12px]">
                <p className="font-semibold text-navy">Self review - {a.self.rating} ({RATING_LABEL(a.self.rating)})</p>
                <p className="text-body mt-1">{a.self.comments}</p>
              </div>
            )}
            {a.manager && (
              <div className="rounded-xl border border-[#16A34A]/40 p-3 text-[12px]">
                <p className="font-semibold text-navy">Final rating {a.manager.rating} ({RATING_LABEL(a.manager.rating)}) by {a.manager.by}</p>
                <p className="text-body mt-1">{a.manager.comments}</p>
              </div>
            )}
            {a.status === 'Manager review' && a.empId !== me && <ReviewForm value={form} onChange={setForm} who="Manager" />}
            {a.empId === me && a.status === 'Manager review' && <p className="text-[12px] text-muted">Someone else has to review your own appraisal.</p>}
          </div>
        )}
      </Modal>
    </>
  )
}

export default function Performance() {
  const { appraisals = [], hrAction, toast } = useApp()
  const { user, can } = useAuth()
  const hr = can(PERMS.HR_PEOPLE)
  const [tab, setTab] = useState('Goals')
  const [selfOpen, setSelfOpen] = useState(false)
  const [self, setSelf] = useState(blankReview)
  const a = appraisals.find((x) => x.empId === user?.id)
  const pendingReviews = useMemo(() => appraisals.filter((x) => x.status === 'Manager review' && x.empId !== user?.id).length, [appraisals, user])

  const tabs = [...(a ? ['Goals', 'Competencies', 'Review history'] : []), ...(hr ? ['Team reviews'] : [])]
  const shown = tabs.includes(tab) ? tab : tabs[0]
  const open = a && ['Goal setting', 'Self review'].includes(a.status)

  const submitSelf = () => {
    const r = hrAction('appraisal.self', { id: a.id, self })
    if (r.ok) { toast('Self review submitted', 'Sent to HR for the manager review'); setSelfOpen(false) }
  }

  return (
    <>
      <PageHeader
        title="Performance"
        subtitle={CYCLE + (a ? ' - your appraisal is at ' + a.status.toLowerCase() : '')}
        actions={open && <button className="btn-primary" onClick={() => { setSelf(blankReview()); setSelfOpen(true) }}>Submit self review</button>}
      />

      {a && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
          <StatCard label="Goal completion" value={weighted(a.goals) + '%'} hint={'weighted across ' + a.goals.length + ' goals'} icon={Target} tone="cyan" />
          <StatCard label="Goals on track" value={a.goals.filter((g) => goalStatus(g) === 'On Track').length + '/' + a.goals.length} hint="70% or more done" icon={TrendingUp} tone="green" />
          <StatCard label="Last rating" value={String(a.manager?.rating ?? a.history[0]?.rating ?? '--')} hint={RATING_LABEL(a.manager?.rating ?? a.history[0]?.rating) + ' - ' + (a.manager ? a.cycle : a.history[0]?.cycle)} icon={Star} tone="purple" />
          {hr
            ? <StatCard label="Reviews waiting" value={pendingReviews} hint="self reviews ready for you" icon={Users} tone="amber" />
            : <StatCard label="Appraisal stage" value={(APPRAISAL_STAGES.indexOf(a.status) + 1) + '/4'} hint={a.status} icon={ListChecks} tone="amber" />}
        </div>
      )}
      {a && shown !== 'Team reviews' && <Stepper status={a.status} />}

      {tabs.length > 1 && <Tabs tabs={tabs} active={shown} onChange={setTab} />}

      {shown === 'Goals' && a && <Goals a={a} editable={open} canProgress={a.status !== 'Completed'} />}
      {shown === 'Competencies' && a && <Competencies a={a} />}
      {shown === 'Review history' && a && <History a={a} />}
      {shown === 'Team reviews' && <TeamReviews list={appraisals} me={user?.id} />}
      {!a && !hr && <Card><p className="py-8 text-center text-[13px] text-muted">No appraisal has been opened for you this cycle.</p></Card>}

      <Modal open={selfOpen} onClose={() => setSelfOpen(false)} width="max-w-xl" title="Self review" subtitle={CYCLE + ' - goal weights must total 100%'}
        footer={<><button className="btn-ghost" onClick={() => setSelfOpen(false)}>Cancel</button><button className="btn-primary" onClick={submitSelf}>Submit</button></>}>
        <ReviewForm value={self} onChange={setSelf} who="Self" />
      </Modal>
    </>
  )
}

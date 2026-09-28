import { useMemo, useState } from 'react'
import { Plus, Briefcase, Users, FileCheck, Timer, Star, Download, UserPlus, CalendarClock, Video } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, Tabs, Avatar, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { departments, locations } from '../data/mock.js'
import { downloadCSV } from '../lib/download.js'
import CandidateModal, { AddCandidateModal } from './recruitment/CandidateModal.jsx'

const BLANK = { role: '', dept: 'Engineering', location: 'Mumbai HQ', type: 'Permanent', priority: 'Medium', count: '1' }

export default function Recruitment() {
  const { requisitions: reqs, addRequisition, candidates, advanceCandidate, toast, notify } = useApp()
  const [tab, setTab] = useState('Candidate pipeline')
  const [picked, setPicked] = useState(null)
  const [adding, setAdding] = useState(false)
  const current = candidates.find((c) => c.name === picked) || null
  const active = candidates.filter((c) => (c.status || 'Active') === 'Active')
  const upcoming = useMemo(() => candidates
    .flatMap((c) => (c.interviews || []).filter((iv) => iv.status === 'Scheduled').map((iv) => ({ ...iv, candidate: c.name, role: c.role })))
    .sort((a, b) => a.at.localeCompare(b.at)), [candidates])
  // Funnel: how many candidates reached each stage (a hire passed every stage).
  const funnel = useMemo(() => {
    const order = ['Shortlisted', 'Tech Screen', 'HR Round', 'Final Round', 'Offer Rolled', 'Hired']
    return order.map((s, i) => ({ stage: s, count: candidates.filter((c) => order.indexOf(c.stage) >= i).length }))
  }, [candidates])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')

  const raise = (e) => {
    e.preventDefault()
    if (!form.role.trim()) { setErr('Give the role a title.'); return }
    const id = addRequisition({
      role: form.role.trim() + (Number(form.count) > 1 ? ' (x' + form.count + ')' : ''),
      dept: form.dept, location: form.location, type: form.type, priority: form.priority,
    })
    notify({ title: 'Requisition ' + id + ' raised', detail: form.role.trim() + ' - ' + form.location, to: '/recruitment', kind: 'task' })
    toast('Requisition raised', id + ' is now open for sourcing')
    setForm(BLANK); setErr(''); setOpen(false)
  }

  const move = (c) => {
    const next = advanceCandidate(c.name)
    if (next === c.stage) { toast('Already at the final stage', c.name + ' is marked ' + c.stage, 'warning'); return }
    toast('Candidate moved', c.name + ' is now at ' + next)
    if (next === 'Offer Rolled') notify({ title: 'Offer rolled out', detail: c.name + ' - ' + c.role, to: '/recruitment', kind: 'task' })
  }

  const exportReqs = () => {
    downloadCSV('flexiloans-requisitions.csv', [
      { header: 'Req ID', key: 'id' }, { header: 'Role', key: 'role' }, { header: 'Department', key: 'dept' },
      { header: 'Location', key: 'location' }, { header: 'Type', key: 'type' },
      { header: 'Applicants', key: 'applicants' }, { header: 'Stage', key: 'stage' },
      { header: 'Priority', key: 'priority' }, { header: 'Recruiter', key: 'owner' },
    ], reqs)
    toast('Export ready', reqs.length + ' requisitions exported to CSV')
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <PageHeader
        title="Recruitment"
        subtitle="Requisitions, pipeline and offers"
        actions={<>
          <button className="btn-secondary" onClick={exportReqs}><Download size={13} /> Export</button>
          <button className="btn-secondary" onClick={() => setOpen(true)}><Plus size={13} /> Raise requisition</button>
          <button className="btn-primary" onClick={() => setAdding(true)}><UserPlus size={13} /> Add candidate</button>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Open requisitions" value={reqs.length} hint={reqs.filter((r) => r.priority === 'High').length + ' marked high priority'} icon={Briefcase} tone="cyan" />
        <StatCard label="Active candidates" value={active.length} hint={candidates.filter((c) => c.status === 'Hired').length + ' hired, ' + candidates.filter((c) => c.status === 'Rejected').length + ' rejected'} icon={Users} tone="blue" />
        <StatCard label="Offers in flight" value={active.filter((c) => c.stage === 'Offer Rolled').length} hint="awaiting a hire decision" icon={FileCheck} tone="green" />
        <StatCard label="Interviews scheduled" value={upcoming.length} hint={upcoming[0] ? 'next: ' + upcoming[0].candidate : 'none coming up'} icon={Timer} tone="amber" />
      </div>

      <Tabs tabs={['Candidate pipeline', 'Interviews', 'Open requisitions', 'Hiring funnel']} active={tab} onChange={setTab} />

      {tab === 'Open requisitions' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'id', header: 'Req ID', mono: true },
              { key: 'role', header: 'Role' },
              { key: 'dept', header: 'Department' },
              { key: 'location', header: 'Location' },
              { key: 'type', header: 'Type', render: (r) => <Badge tone={statusTone(r.type)}>{r.type}</Badge> },
              { key: 'applicants', header: 'Applicants', align: 'right', mono: true },
              { key: 'stage', header: 'Stage', render: (r) => <Badge tone={statusTone(r.stage)}>{r.stage}</Badge> },
              { key: 'priority', header: 'Priority', render: (r) => <Badge tone={statusTone(r.priority)}>{r.priority}</Badge> },
              { key: 'owner', header: 'Recruiter' },
            ]}
            rows={reqs}
          />
        </Card>
      )}

      {tab === 'Candidate pipeline' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'name', header: 'Candidate', render: (r) => (
                <button className="flex items-center gap-2.5 text-left" onClick={() => setPicked(r.name)}>
                  <Avatar name={r.name} size={30} />
                  <span>
                    <span className="block text-[13px] font-medium text-navy hover:underline">{r.name}</span>
                    <span className="block text-[11px] text-muted">{r.source}</span>
                  </span>
                </button>
              )},
              { key: 'role', header: 'Applied for' },
              { key: 'stage', header: 'Stage', render: (r) => <Badge tone={r.stage === 'Hired' ? 'green' : 'blue'}>{r.stage}</Badge> },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'Hired' ? 'green' : r.status === 'Rejected' ? 'red' : 'gray'}>{r.status || 'Active'}</Badge> },
              { key: 'rating', header: 'Score', render: (r) => (
                <span className="flex items-center gap-1 font-mono text-xs text-navy"><Star size={12} className="text-[#D97706] fill-[#D97706]" />{r.rating ?? '--'}</span>
              )},
              { key: 'rounds', header: 'Interviews', render: (r) => <span className="text-[12px] text-muted">{(r.evaluations || []).length} scored / {(r.interviews || []).length} booked</span> },
              { key: 'applied', header: 'Applied on', mono: true },
              { key: 'action', header: '', align: 'right', render: (r) => (
                <span className="flex justify-end gap-1.5">
                  {(r.status || 'Active') === 'Active' && r.stage !== 'Offer Rolled' && <button className="btn-ghost px-2 py-1" onClick={() => move(r)}>Next stage</button>}
                  <button className="btn-secondary px-2 py-1" onClick={() => setPicked(r.name)}>Open</button>
                </span>
              )},
            ]}
            rows={candidates}
          />
        </Card>
      )}

      {tab === 'Interviews' && (
        <Card title="Upcoming interviews" subtitle="Everything scheduled across the pipeline" bodyClass="p-0">
          <Table
            empty="No interviews scheduled. Open a candidate to book one."
            columns={[
              { key: 'at', header: 'When', mono: true, render: (r) => <span className="flex items-center gap-1.5"><CalendarClock size={13} className="text-faint" />{r.at.replace('T', ' ')}</span> },
              { key: 'candidate', header: 'Candidate', render: (r) => <button className="text-navy font-medium hover:underline" onClick={() => setPicked(r.candidate)}>{r.candidate}</button> },
              { key: 'role', header: 'Role' },
              { key: 'round', header: 'Round', render: (r) => <Badge tone="blue">{r.round}</Badge> },
              { key: 'interviewer', header: 'Interviewer' },
              { key: 'mode', header: 'Mode', render: (r) => <span className="flex items-center gap-1 text-[12px] text-muted"><Video size={12} />{r.mode}</span> },
            ]}
            rows={upcoming}
          />
        </Card>
      )}

      {tab === 'Hiring funnel' && (
        <Card title="Pipeline by stage" subtitle="Candidates who reached each stage, with conversion from the first">
          <div className="space-y-3 max-w-2xl">
            {funnel.map(({ stage: s, count }, i) => {
              const pct = funnel[0].count ? (count / funnel[0].count) * 100 : 0
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[12px] text-muted">{s}</span>
                  <div className="flex-1 h-7 rounded-lg bg-canvas overflow-hidden">
                    <div className="h-full rounded-lg flex items-center px-2.5 text-[11px] font-medium text-white"
                      style={{ width: Math.max(pct, 8) + '%', background: ['#1B365D', '#26507F', '#0097B2', '#00B4D8', '#16A34A', '#7C3AED'][i] }}>
                      {count}
                    </div>
                  </div>
                  <span className="w-12 shrink-0 text-right text-[11px] font-mono text-muted">{pct.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <CandidateModal candidate={current} onClose={() => setPicked(null)} />
      <AddCandidateModal open={adding} onClose={() => setAdding(false)} roles={reqs.map((r) => r.role)} />

      <Modal open={open} onClose={() => setOpen(false)} title="Raise a requisition" subtitle="Goes to Talent Acquisition for sourcing"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={raise}>Raise requisition</button>
        </>}>
        <form onSubmit={raise} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Role title *</label><input className="input" value={form.role} onChange={set('role')} placeholder="Senior Data Analyst" /></div>
          <div><label className="label">Department</label>
            <select className="input" value={form.dept} onChange={set('dept')}>{departments.map((d) => <option key={d}>{d}</option>)}</select>
          </div>
          <div><label className="label">Location</label>
            <select className="input" value={form.location} onChange={set('location')}>{locations.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
          <div><label className="label">Employment type</label>
            <select className="input" value={form.type} onChange={set('type')}><option>Permanent</option><option>Contract</option><option>Intern</option></select>
          </div>
          <div><label className="label">Priority</label>
            <select className="input" value={form.priority} onChange={set('priority')}><option>Low</option><option>Medium</option><option>High</option></select>
          </div>
          <div><label className="label">Positions</label><input className="input" type="number" min="1" value={form.count} onChange={set('count')} /></div>
          {err && <p className="sm:col-span-2 text-[12px] text-[#DC2626]">{err}</p>}
        </form>
      </Modal>
    </>
  )
}

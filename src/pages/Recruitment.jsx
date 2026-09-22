import { useState } from 'react'
import { Plus, Briefcase, Users, FileCheck, Timer, Star, Download } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, Tabs, Avatar, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { departments, locations } from '../data/mock.js'
import { downloadCSV } from '../lib/download.js'

const STAGES = ['Sourcing', 'Screening', 'Interviewing', 'Offer', 'Hired']
const BLANK = { role: '', dept: 'Engineering', location: 'Mumbai HQ', type: 'Permanent', priority: 'Medium', count: '1' }

export default function Recruitment() {
  const { openings, candidates, advanceCandidate, toast, notify } = useApp()
  const { user } = useAuth()
  const [tab, setTab] = useState('Open requisitions')
  const [reqs, setReqs] = useState(openings)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')

  const raise = (e) => {
    e.preventDefault()
    if (!form.role.trim()) { setErr('Give the role a title.'); return }
    const id = 'REQ-' + (312 + reqs.length - openings.length)
    setReqs((l) => [{
      id, role: form.role.trim() + (Number(form.count) > 1 ? ' (x' + form.count + ')' : ''),
      dept: form.dept, location: form.location, type: form.type, applicants: 0,
      stage: 'Sourcing', owner: user.name, posted: new Date().toISOString().slice(0, 10),
      priority: form.priority,
    }, ...l])
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
          <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={13} /> Raise requisition</button>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <StatCard label="Open requisitions" value={reqs.length} hint={reqs.filter((r) => r.priority === 'High').length + ' marked high priority'} icon={Briefcase} tone="cyan" />
        <StatCard label="Active candidates" value={reqs.reduce((s, o) => s + o.applicants, 0)} hint="across all stages" icon={Users} tone="blue" />
        <StatCard label="Offers in flight" value={candidates.filter((c) => c.stage === 'Offer Rolled').length + 3} hint="1 awaiting sign-off" icon={FileCheck} tone="green" />
        <StatCard label="Avg time to hire" value="34d" hint="target 30 days" icon={Timer} tone="amber" />
      </div>

      <Tabs tabs={['Open requisitions', 'Candidate pipeline', 'Hiring funnel']} active={tab} onChange={setTab} />

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
                <span className="flex items-center gap-2.5">
                  <Avatar name={r.name} size={30} />
                  <span>
                    <span className="block text-[13px] font-medium text-navy">{r.name}</span>
                    <span className="block text-[11px] text-muted">{r.source}</span>
                  </span>
                </span>
              )},
              { key: 'role', header: 'Applied for' },
              { key: 'stage', header: 'Stage', render: (r) => <Badge tone={r.stage === 'Hired' ? 'green' : 'blue'}>{r.stage}</Badge> },
              { key: 'rating', header: 'Rating', render: (r) => (
                <span className="flex items-center gap-1 font-mono text-xs text-navy"><Star size={12} className="text-[#D97706] fill-[#D97706]" />{r.rating}</span>
              )},
              { key: 'applied', header: 'Applied on', mono: true },
              { key: 'action', header: '', align: 'right', render: (r) => (
                <button className="btn-secondary px-2 py-1" onClick={() => move(r)} disabled={r.stage === 'Hired'}>
                  {r.stage === 'Hired' ? 'Hired' : 'Move stage'}
                </button>
              )},
            ]}
            rows={candidates}
          />
        </Card>
      )}

      {tab === 'Hiring funnel' && (
        <Card title="Pipeline by stage" subtitle="All open requisitions combined">
          <div className="space-y-3 max-w-2xl">
            {STAGES.map((s, i) => {
              const count = [260, 148, 62, 9, 5][i]
              const pct = (count / 260) * 100
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[12px] text-muted">{s}</span>
                  <div className="flex-1 h-7 rounded-lg bg-canvas overflow-hidden">
                    <div className="h-full rounded-lg flex items-center px-2.5 text-[11px] font-medium text-white"
                      style={{ width: Math.max(pct, 8) + '%', background: ['#1B365D', '#26507F', '#00B4D8', '#16A34A', '#7C3AED'][i] }}>
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

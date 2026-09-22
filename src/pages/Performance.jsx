import { useState } from 'react'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts'
import { Target, TrendingUp, Star, CalendarClock } from 'lucide-react'
import { PageHeader, Card, Badge, StatCard, Tabs, Progress, Table, statusTone } from '../components/ui.jsx'
import { goals, competencies } from '../data/mock.js'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'

export default function Performance() {
  const { toast, notify } = useApp()
  const [tab, setTab] = useState('Goals')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ highlights: '', challenges: '', rating: '4' })
  const weighted = Math.round(goals.reduce((s, g) => s + g.progress * g.weight, 0) / 100)

  return (
    <>
      <PageHeader
        title="Performance"
        subtitle="Mid-year cycle FY 2026-27 - self-assessment closes 12 October"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>Start self-assessment</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <StatCard label="Goal completion" value={weighted + '%'} hint="weighted across 5 goals" icon={Target} tone="cyan" />
        <StatCard label="Goals on track" value={goals.filter((g) => g.status === 'On Track').length + '/' + goals.length} hint="1 at risk, 1 behind" icon={TrendingUp} tone="green" />
        <StatCard label="Last rating" value="4.2" hint="Exceeds expectations (FY26)" icon={Star} tone="purple" />
        <StatCard label="Next review" value="24 Oct" hint="manager review deadline" icon={CalendarClock} tone="amber" />
      </div>

      <Tabs tabs={['Goals', 'Competencies', 'Review history']} active={tab} onChange={setTab} />

      {tab === 'Goals' && (
        <Card title="Current cycle goals" subtitle="Weights total 100%">
          <div className="space-y-5">
            {goals.map((g) => (
              <div key={g.title}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-[13px] font-medium text-navy">{g.title}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone="gray">Weight {g.weight}%</Badge>
                    <Badge tone={statusTone(g.status)}>{g.status}</Badge>
                    <span className="text-[12px] font-mono text-navy w-10 text-right">{g.progress}%</span>
                  </span>
                </div>
                <Progress value={g.progress} color={g.status === 'On Track' ? '#16A34A' : g.status === 'At Risk' ? '#D97706' : '#DC2626'} />
                <p className="text-[11px] text-faint mt-1.5">Due {g.due}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'Competencies' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Self vs manager rating" subtitle="Scale of 1 to 5">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={competencies} outerRadius="72%">
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9, fill: '#9CA3AF' }} />
                  <Radar name="Self" dataKey="self" stroke="#00B4D8" fill="#00B4D8" fillOpacity={0.25} />
                  <Radar name="Manager" dataKey="manager" stroke="#1B365D" fill="#1B365D" fillOpacity={0.15} />
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
                { key: 'manager', header: 'Manager', align: 'right', mono: true },
                { key: 'gap', header: 'Gap', align: 'right', mono: true, render: (r) => {
                  const gap = (r.manager - r.self).toFixed(1)
                  return <span className={gap >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}>{gap > 0 ? '+' : ''}{gap}</span>
                }},
              ]}
              rows={competencies}
            />
          </Card>
        </div>
      )}

      {tab === 'Review history' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'cycle', header: 'Cycle' },
              { key: 'rating', header: 'Rating', mono: true },
              { key: 'band', header: 'Band', render: (r) => <Badge tone={r.band === 'Outstanding' ? 'green' : r.band === 'Exceeds expectations' ? 'cyan' : 'gray'}>{r.band}</Badge> },
              { key: 'manager', header: 'Reviewed by' },
              { key: 'hike', header: 'Revision', align: 'right', mono: true },
            ]}
            rows={[
              { cycle: 'FY 2025-26 (Annual)', rating: '4.2', band: 'Exceeds expectations', manager: 'Aarti Deshmukh', hike: '+12%' },
              { cycle: 'FY 2025-26 (Mid-year)', rating: '4.0', band: 'Exceeds expectations', manager: 'Aarti Deshmukh', hike: '--' },
              { cycle: 'FY 2024-25 (Annual)', rating: '4.5', band: 'Outstanding', manager: 'Rakesh Menon', hike: '+18%' },
              { cycle: 'FY 2023-24 (Annual)', rating: '3.8', band: 'Meets expectations', manager: 'Rakesh Menon', hike: '+9%' },
            ]}
          />
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Self-assessment" subtitle="Mid-year cycle FY 2026-27 - closes 12 October"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Save draft</button>
          <button className="btn-primary" onClick={() => {
            notify({ title: 'Self-assessment submitted', detail: 'Sent to Aarti Deshmukh for review', to: '/performance', kind: 'task' })
            toast('Self-assessment submitted', 'Your manager review is due by 24 October')
            setOpen(false)
          }}>Submit</button>
        </>}>
        <div className="grid gap-3">
          <div>
            <label className="label">What went well this half?</label>
            <textarea className="input min-h-[90px]" value={draft.highlights}
              onChange={(e) => setDraft({ ...draft, highlights: e.target.value })}
              placeholder="Shipped the v2 merchant journey, cut drop-off by 6 points..." />
          </div>
          <div>
            <label className="label">Where did you get stuck?</label>
            <textarea className="input min-h-[90px]" value={draft.challenges}
              onChange={(e) => setDraft({ ...draft, challenges: e.target.value })}
              placeholder="Partner API sandbox slipped on vendor dependencies..." />
          </div>
          <div>
            <label className="label">Overall self rating</label>
            <select className="input" value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: e.target.value })}>
              <option value="5">5 - Outstanding</option>
              <option value="4">4 - Exceeds expectations</option>
              <option value="3">3 - Meets expectations</option>
              <option value="2">2 - Partially meets</option>
            </select>
          </div>
        </div>
      </Modal>
    </>
  )
}

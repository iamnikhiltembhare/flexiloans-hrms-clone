import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { GraduationCap, BookOpen, Award, TrendingUp, Plus, UserPlus, Clock } from 'lucide-react'
import { PageHeader, Card, Badge, StatCard, Tabs, Progress, Select } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'
import { skillProfile, SKILL_REQUIREMENTS, COURSE_MODES, requirementsFor } from '../lib/hr/growth.js'
import { departments } from '../data/mock.js'
import { downloadCSV } from '../lib/download.js'

const tip = { contentStyle: { borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 } }
const statusTone = (s) => ({ Completed: 'green', 'In progress': 'blue', 'Not started': 'gray' }[s] || 'gray')
const allSkills = [...new Set([...Object.values(SKILL_REQUIREMENTS).flatMap(Object.keys), 'Compliance (KYC/AML)', 'Communication'])].sort()

function CourseRow({ c, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-navy">{c.title}</p>
        <p className="text-[11px] text-muted mt-0.5">{c.skill} - {c.hours} h - {c.mode} - {c.provider}</p>
      </div>
      <span className="flex flex-wrap items-center gap-2">{c.mandatory && <Badge tone="red">Mandatory</Badge>}{children}</span>
    </div>
  )
}

function MyLearning({ training, me }) {
  const { hrAction, toast } = useApp()
  const mine = training.enrollments.filter((e) => e.empId === me.id)
  const course = (id) => training.courses.find((c) => c.id === id)
  const todayISO = new Date().toISOString().slice(0, 10)
  const step = (e, progress) => {
    const r = hrAction('course.progress', { id: e.id, progress })
    if (r.ok && progress === 100) toast('Course completed', course(e.courseId)?.title + ' - your ' + course(e.courseId)?.skill + ' level went up')
  }
  if (!mine.length) return <Card><p className="py-8 text-center text-[13px] text-muted">You are not enrolled in anything yet. Pick a course from the catalogue.</p></Card>
  return (
    <div className="grid gap-3">
      {mine.map((e) => {
        const c = course(e.courseId) || { title: e.courseId, skill: '', hours: 0, mode: '', provider: '' }
        const late = e.due && e.due < todayISO && e.status !== 'Completed'
        return (
          <CourseRow key={e.id} c={c}>
            {e.due && <Badge tone={late ? 'red' : 'amber'}>{late ? 'Overdue' : 'Due'} {e.due}</Badge>}
            <Badge tone={statusTone(e.status)}>{e.status}</Badge>
            <span className="w-24"><Progress value={e.progress} color={e.status === 'Completed' ? '#16A34A' : '#00B4D8'} /></span>
            <span className="w-9 text-right font-mono text-[11px]">{e.progress}%</span>
            {e.status !== 'Completed' && <>
              <button className="btn-ghost px-2 py-1" onClick={() => step(e, Math.min(100, e.progress + 25))}>+25%</button>
              <button className="btn-secondary px-2 py-1" onClick={() => step(e, 100)}>Mark complete</button>
            </>}
          </CourseRow>
        )
      })}
    </div>
  )
}

function Catalogue({ training, me, hr, onAssign }) {
  const { hrAction, toast } = useApp()
  const [skill, setSkill] = useState('All skills')
  const gaps = new Set(skillProfile(me, training).filter((s) => s.gap > 0).map((s) => s.skill))
  const list = training.courses.filter((c) => skill === 'All skills' || c.skill === skill)
    .sort((a, b) => Number(gaps.has(b.skill)) - Number(gaps.has(a.skill)))
  const enrolled = (c) => training.enrollments.some((e) => e.empId === me.id && e.courseId === c.id)
  const enroll = (c) => { if (hrAction('course.enroll', { courseId: c.id }).ok) toast('Enrolled', c.title) }
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={skill} onChange={setSkill} options={['All skills', ...allSkills]} />
        <span className="text-[11px] text-muted">Courses for your skill gaps are listed first.</span>
      </div>
      <div className="grid gap-2">
        {list.map((c) => (
          <CourseRow key={c.id} c={c}>
            {gaps.has(c.skill) && <Badge tone="amber">Closes a gap</Badge>}
            <span className="text-[11px] text-muted font-mono">{training.enrollments.filter((e) => e.courseId === c.id).length} enrolled</span>
            {hr && <button className="btn-ghost px-2 py-1" onClick={() => onAssign(c)}><UserPlus size={13} /> Assign</button>}
            {enrolled(c) ? <Badge tone="green">Enrolled</Badge> : <button className="btn-secondary px-2 py-1" onClick={() => enroll(c)}>Enrol</button>}
          </CourseRow>
        ))}
      </div>
    </>
  )
}

function MySkills({ training, me }) {
  const rows = skillProfile(me, training)
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card title="My skills vs my role" subtitle={me.designation + ' - ' + me.department + ' (levels 1 to 5)'}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 30, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: '#6B7280' }} />
              <YAxis type="category" dataKey="skill" width={130} tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="level" name="My level" fill="#00B4D8" radius={[0, 4, 4, 0]} />
              <Bar dataKey="required" name="Role needs" fill="#1B365D" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Recommended for you" subtitle="Courses that close your gaps" bodyClass="p-3">
        <div className="grid gap-2">
          {rows.filter((r) => r.gap > 0).map((r) => (
            <div key={r.skill} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium text-navy">{r.skill}</span><Badge tone="amber">Gap {r.gap}</Badge></div>
              <p className="text-[11px] text-muted mt-1">{r.courses.length ? r.courses.map((c) => c.title).join(', ') : 'No course yet - ask HR to add one'}</p>
            </div>
          ))}
          {rows.every((r) => r.gap === 0) && <p className="py-6 text-center text-[13px] text-muted">No gaps - you meet every skill your role needs.</p>}
        </div>
      </Card>
    </div>
  )
}

function SkillMatrix({ training, employees }) {
  const [dept, setDept] = useState('Engineering')
  const people = employees.filter((e) => e.department === dept)
  const skills = Object.keys(requirementsFor(dept))
  const profiles = people.map((e) => ({ e, p: skillProfile(e, training) }))
  const cell = (lvl, req) => (lvl >= req ? 'bg-[#16A34A]/15 text-[#15803D]' : req - lvl === 1 ? 'bg-[#D97706]/15 text-[#B45309]' : 'bg-[#DC2626]/15 text-[#B91C1C]')
  const exportCsv = () => downloadCSV('skill-gaps-' + dept.toLowerCase().replace(/\W+/g, '-') + '.csv',
    [{ header: 'Employee', key: 'name' }, ...skills.map((s) => ({ header: s, key: s }))],
    profiles.map(({ e, p }) => ({ name: e.name, ...Object.fromEntries(p.map((x) => [x.skill, x.level + '/' + x.required])) })))
  const gapBy = skills.map((s) => ({ skill: s, people: profiles.filter(({ p }) => p.find((x) => x.skill === s).gap > 0).length }))
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={dept} onChange={setDept} options={departments} />
        <button className="btn-secondary" onClick={exportCsv}>Export CSV</button>
        <span className="text-[11px] text-muted">Level / required. Green meets it, amber is one level short, red is two or more.</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-line">
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.06em] text-faint">Employee</th>
                {skills.map((s) => <th key={s} className="px-2 py-2 text-center text-[10px] uppercase tracking-[0.06em] text-faint whitespace-nowrap">{s}</th>)}
              </tr></thead>
              <tbody>
                {profiles.map(({ e, p }) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap"><span className="text-navy font-medium">{e.name}</span><span className="block text-[11px] text-muted">{e.designation}</span></td>
                    {p.map((x) => <td key={x.skill} className="px-2 py-2 text-center"><span className={'inline-block min-w-[44px] rounded-md px-1.5 py-1 font-mono ' + cell(x.level, x.required)}>{x.level}/{x.required}</span></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Where the gaps are" subtitle={'People below the level ' + dept + ' needs'}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gapBy} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis type="category" dataKey="skill" width={120} tick={{ fontSize: 10, fill: '#6B7280' }} />
                <Tooltip {...tip} />
                <Bar dataKey="people" fill="#D97706" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  )
}

export default function Learning() {
  const { training = { courses: [], enrollments: [] }, employees, hrAction, toast } = useApp()
  const { user, can } = useAuth()
  const hr = can(PERMS.HR_PEOPLE)
  const me = employees.find((e) => e.id === user?.id) || { id: user?.id, name: user?.name, department: user?.department || 'Operations', designation: user?.designation || '' }
  const [tab, setTab] = useState('My learning')
  const [adding, setAdding] = useState(false)
  const [course, setCourse] = useState({ title: '', skill: allSkills[0], hours: 4, mode: 'Online', provider: '', mandatory: false })
  const [assign, setAssign] = useState(null)
  const [pick, setPick] = useState({ dept: 'All', due: '', gapsOnly: true })

  const mine = training.enrollments.filter((e) => e.empId === me.id)
  const gaps = skillProfile(me, training).filter((s) => s.gap > 0).length
  const hours = mine.filter((e) => e.status === 'Completed').reduce((s, e) => s + (training.courses.find((c) => c.id === e.courseId)?.hours || 0), 0)
  const mandatory = training.enrollments.filter((e) => training.courses.find((c) => c.id === e.courseId)?.mandatory)
  const completion = mandatory.length ? Math.round((mandatory.filter((e) => e.status === 'Completed').length / mandatory.length) * 100) : 0

  const targets = assign ? employees.filter((e) => (pick.dept === 'All' || e.department === pick.dept)
    && !training.enrollments.some((x) => x.empId === e.id && x.courseId === assign.id)
    && (!pick.gapsOnly || skillProfile(e, training).some((s) => s.skill === assign.skill && s.gap > 0))) : []

  const saveCourse = () => {
    const r = hrAction('course.add', { course: { ...course, hours: Number(course.hours) } })
    if (r.ok) { toast('Course added', course.title); setAdding(false) }
  }
  const doAssign = () => {
    const r = hrAction('course.assign', { courseId: assign.id, empIds: targets.map((e) => e.id), due: pick.due })
    if (r.ok) { toast('Course assigned', r.result + ' people - due ' + pick.due); setAssign(null) }
  }

  const tabs = ['My learning', 'Catalogue', 'My skills', ...(hr ? ['Skill gap matrix'] : [])]
  return (
    <>
      <PageHeader title="Learning and skills" subtitle="Courses, certifications and the skills your role needs"
        actions={hr && <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={13} /> Add course</button>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="My courses" value={mine.length} hint={mine.filter((e) => e.status === 'Completed').length + ' completed'} icon={BookOpen} tone="cyan" />
        <StatCard label="Learning hours" value={hours + 'h'} hint="completed this year" icon={Clock} tone="blue" />
        <StatCard label="Skill gaps" value={gaps} hint="against your role" icon={TrendingUp} tone={gaps ? 'amber' : 'green'} />
        {hr
          ? <StatCard label="Mandatory completion" value={completion + '%'} hint="company-wide" icon={Award} tone="purple" />
          : <StatCard label="Catalogue" value={training.courses.length} hint="courses available" icon={GraduationCap} tone="purple" />}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'My learning' && <MyLearning training={training} me={me} />}
      {tab === 'Catalogue' && <Catalogue training={training} me={me} hr={hr} onAssign={(c) => { setAssign(c); setPick({ dept: 'All', due: '', gapsOnly: true }) }} />}
      {tab === 'My skills' && <MySkills training={training} me={me} />}
      {tab === 'Skill gap matrix' && hr && <SkillMatrix training={training} employees={employees} />}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a course" subtitle="Appears in everyone's catalogue"
        footer={<><button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button className="btn-primary" onClick={saveCourse}>Add course</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Title *</label><input className="input" value={course.title} onChange={(e) => setCourse({ ...course, title: e.target.value })} /></div>
          <div><label className="label">Skill it builds</label><select className="input" value={course.skill} onChange={(e) => setCourse({ ...course, skill: e.target.value })}>{allSkills.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label">Hours</label><input className="input" type="number" min="1" value={course.hours} onChange={(e) => setCourse({ ...course, hours: e.target.value })} /></div>
          <div><label className="label">Mode</label><select className="input" value={course.mode} onChange={(e) => setCourse({ ...course, mode: e.target.value })}>{COURSE_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className="label">Provider</label><input className="input" value={course.provider} onChange={(e) => setCourse({ ...course, provider: e.target.value })} placeholder="FlexiLoans Academy" /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-body"><input type="checkbox" checked={course.mandatory} onChange={(e) => setCourse({ ...course, mandatory: e.target.checked })} /> Mandatory for everyone</label>
        </div>
      </Modal>

      <Modal open={!!assign} onClose={() => setAssign(null)} title={'Assign: ' + (assign?.title || '')} subtitle={assign?.skill}
        footer={<><button className="btn-ghost" onClick={() => setAssign(null)}>Cancel</button><button className="btn-primary" onClick={doAssign} disabled={!targets.length}>Assign to {targets.length}</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Department</label><select className="input" value={pick.dept} onChange={(e) => setPick({ ...pick, dept: e.target.value })}><option>All</option>{departments.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className="label">Due date *</label><input className="input" type="date" value={pick.due} onChange={(e) => setPick({ ...pick, due: e.target.value })} /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-body"><input type="checkbox" checked={pick.gapsOnly} onChange={(e) => setPick({ ...pick, gapsOnly: e.target.checked })} /> Only people with a gap in {assign?.skill}</label>
          <p className="sm:col-span-2 text-[12px] text-muted">{targets.length ? targets.slice(0, 8).map((e) => e.name).join(', ') + (targets.length > 8 ? ' and ' + (targets.length - 8) + ' more' : '') : 'Nobody matches - everyone is enrolled or has no gap.'}</p>
        </div>
      </Modal>
    </>
  )
}

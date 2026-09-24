import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts'
import {
  Users, UserPlus, CalendarDays, ChevronRight, AlertTriangle, Briefcase,
} from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Avatar, Table, statusTone } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useApp } from '../../context/DataContext.jsx'
import { headcountTrend, deptDistribution, attendanceTrend, birthdays, anniversaries } from '../../data/mock.js'
import { BRAND } from '../../lib/brand.js'

const PIE = ['#1B365D', '#00B4D8', '#2563EB', '#7C3AED', '#16A34A', '#D97706', '#DC2626', '#0097B2', '#64748B', '#9333EA']
const tip = { contentStyle: { borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 } }

const attrition = [
  { month: 'Apr', voluntary: 1.4, involuntary: 0.4 },
  { month: 'May', voluntary: 1.3, involuntary: 0.3 },
  { month: 'Jun', voluntary: 1.6, involuntary: 0.2 },
  { month: 'Jul', voluntary: 1.2, involuntary: 0.5 },
  { month: 'Aug', voluntary: 1.1, involuntary: 0.3 },
  { month: 'Sep', voluntary: 1.5, involuntary: 0.3 },
]

export default function HRDashboard() {
  const { user } = useAuth()
  const { employees, leaveRequests, tickets, openings, candidates } = useApp()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const pendingLeave = leaveRequests.filter((r) => r.status === 'Pending')
  const openTickets = tickets.filter((t) => t.status !== 'Resolved')
  const breached = tickets.filter((t) => t.sla === 'Breached')

  const queue = [
    { label: 'Leave requests', count: pendingLeave.length, detail: 'awaiting approval', to: '/leave' },
    { label: 'Helpdesk tickets', count: openTickets.length, detail: 'open or in progress', to: '/helpdesk' },
    { label: 'Offers to sign off', count: candidates.filter((c) => c.stage === 'Offer Rolled').length, detail: 'in the pipeline', to: '/recruitment' },
    { label: 'Documents to verify', count: 2, detail: 'pending KYC checks', to: '/documents' },
  ]

  return (
    <>
      <PageHeader
        title={greeting + ', ' + (user?.shortName || String(user?.name || '').split(' ')[0])}
        subtitle={"People operations overview for " + BRAND.company}
        actions={<Link to="/employees" className="btn-primary"><UserPlus size={13} /> Employee directory</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Total headcount" value={504 + employees.length} hint="+22 joiners this month" icon={Users} tone="cyan" />
        <StatCard label="Pending approvals" value={pendingLeave.length} hint="leave requests in your queue" icon={CalendarDays} tone="amber" />
        <StatCard label="Open requisitions" value={openings.length} hint={openings.filter((o) => o.priority === 'High').length + ' high priority'} icon={Briefcase} tone="blue" />
        <StatCard label="SLA breaches" value={breached.length} hint="helpdesk tickets overdue" icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Headcount trend" subtitle="Rolling six months" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={headcountTrend} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrhc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00B4D8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#00B4D8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={[480, 600]} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="headcount" stroke="#00B4D8" strokeWidth={2} fill="url(#hrhc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="My action queue" subtitle="Items assigned to HR" bodyClass="p-2">
          {queue.map((q) => (
            <Link key={q.label} to={q.to}
              className="lift flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-canvas hover:shadow-[0_6px_16px_-12px_rgba(27,54,93,.5)]">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-cyan-bg text-[#0097B2] text-[13px] font-semibold font-mono">{q.count}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-navy">{q.label}</span>
                <span className="block text-[11px] text-muted truncate">{q.detail}</span>
              </span>
              <ChevronRight size={15} className="text-faint" />
            </Link>
          ))}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Attrition rate" subtitle="Percentage of average headcount">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attrition} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="voluntary" stroke="#00B4D8" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="involuntary" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Attendance this week" subtitle="Company-wide">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceTrend} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip {...tip} />
                <Bar dataKey="present" stackId="a" fill="#1B365D" />
                <Bar dataKey="wfh" stackId="a" fill="#00B4D8" />
                <Bar dataKey="absent" stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Department split" subtitle="Share of headcount">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deptDistribution} dataKey="value" nameKey="name" innerRadius={40} outerRadius={68} paddingAngle={2} isAnimationActive={false}>
                  {deptDistribution.map((d, i) => <Cell key={d.name} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Leave awaiting approval" className="lg:col-span-2" bodyClass="p-0"
          actions={<Link to="/leave" className="text-[11px] text-cyan hover:underline">Open queue</Link>}>
          <Table
            columns={[
              { key: 'employee', header: 'Employee' },
              { key: 'type', header: 'Type' },
              { key: 'from', header: 'From', mono: true },
              { key: 'days', header: 'Days', align: 'right', mono: true },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
            ]}
            rows={pendingLeave}
            empty="Nothing awaiting approval."
          />
        </Card>

        <Card title="People moments" bodyClass="p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-faint mb-2">Birthdays</p>
          {birthdays.map((b) => (
            <div key={b.name} className="flex items-center gap-2.5 py-1.5">
              <Avatar name={b.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-navy truncate">{b.name}</span>
                <span className="block text-[10px] text-muted">{b.dept}</span>
              </span>
              <span className="text-[11px] text-muted font-mono">{b.date}</span>
            </div>
          ))}
          <p className="text-[10px] font-medium uppercase tracking-wide text-faint mt-3 mb-2">Work anniversaries</p>
          {anniversaries.map((a) => (
            <div key={a.name} className="flex items-center gap-2.5 py-1.5">
              <Avatar name={a.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-navy truncate">{a.name}</span>
                <span className="block text-[10px] text-muted">{a.years} year{a.years > 1 ? 's' : ''}</span>
              </span>
              <span className="text-[11px] text-muted font-mono">{a.date}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}

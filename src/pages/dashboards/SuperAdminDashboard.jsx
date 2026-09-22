import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  ShieldCheck, Users, Activity, KeyRound, ChevronRight, ServerCog,
  AlertTriangle, Plug, CheckCircle2, ScrollText,
} from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Table } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useApp } from '../../context/DataContext.jsx'
import {
  systemHealth, roleMatrix, auditLog, loginActivity, integrations, headcountTrend,
} from '../../data/mock.js'

const tip = { contentStyle: { borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 } }

export default function SuperAdminDashboard() {
  const { user } = useAuth()
  const { employees, tickets, leaveRequests } = useApp()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const totalUsers = roleMatrix.reduce((s, r) => s + r.users, 0)
  const degraded = systemHealth.filter((s) => s.status !== 'Operational')
  const failedLogins = loginActivity.reduce((s, d) => s + d.failed, 0)

  const shortcuts = [
    { label: 'System administration', detail: 'Accounts, roles and audit log', to: '/system', icon: ShieldCheck },
    { label: 'Organisation settings', detail: 'Work week, policies, integrations', to: '/settings', icon: ServerCog },
    { label: 'Employee directory', detail: employees.length + ' records', to: '/employees', icon: Users },
    { label: 'Workforce reports', detail: 'Headcount, attrition, payroll', to: '/reports', icon: Activity },
  ]

  return (
    <>
      <PageHeader
        title={greeting + ', ' + (user?.shortName || String(user?.name || '').split(' ')[0])}
        subtitle="Super Admin console - platform, access and organisation health"
        actions={<Link to="/system" className="btn-primary"><ShieldCheck size={13} /> System admin</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <StatCard label="Active user accounts" value={totalUsers} hint={roleMatrix.length + ' roles configured'} icon={Users} tone="purple" />
        <StatCard label="Services operational" value={(systemHealth.length - degraded.length) + '/' + systemHealth.length} hint={degraded.length ? degraded[0].name + ' degraded' : 'all systems normal'} icon={degraded.length ? AlertTriangle : CheckCircle2} tone={degraded.length ? 'amber' : 'green'} />
        <StatCard label="Failed sign-ins" value={failedLogins} hint="past 5 working days" icon={KeyRound} tone="red" />
        <StatCard label="Audit events today" value="34" hint={auditLog.length + ' shown below'} icon={ScrollText} tone="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Sign-in activity" subtitle="Successful vs failed, this week" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loginActivity} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="logins" fill="#1B365D" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Admin shortcuts" bodyClass="p-2">
          {shortcuts.map(({ label, detail, to, icon: Icon }) => (
            <Link key={to + label} to={to}
              className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-canvas transition-colors">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-[rgba(124,58,237,0.1)] text-[#7C3AED]"><Icon size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-navy">{label}</span>
                <span className="block text-[11px] text-muted truncate">{detail}</span>
              </span>
              <ChevronRight size={15} className="text-faint" />
            </Link>
          ))}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card title="System health" subtitle="Platform services" bodyClass="p-0">
          <Table
            columns={[
              { key: 'name', header: 'Service' },
              { key: 'status', header: 'Status', render: (r) => (
                <Badge tone={r.status === 'Operational' ? 'green' : r.status === 'Degraded' ? 'amber' : 'red'}>{r.status}</Badge>
              )},
              { key: 'uptime', header: 'Uptime', align: 'right', mono: true },
              { key: 'latency', header: 'Latency', align: 'right', mono: true },
            ]}
            rows={systemHealth}
          />
        </Card>

        <Card title="Integrations" subtitle="Connected systems" bodyClass="p-0">
          <Table
            columns={[
              { key: 'name', header: 'Integration', render: (r) => (
                <span className="flex items-center gap-2">
                  <Plug size={13} className="text-faint shrink-0" />
                  <span className="text-[13px] text-navy">{r.name}</span>
                </span>
              )},
              { key: 'category', header: 'Category', render: (r) => <Badge tone="blue">{r.category}</Badge> },
              { key: 'status', header: 'Status', render: (r) => (
                <Badge tone={r.status === 'Connected' ? 'green' : r.status === 'Partial' ? 'amber' : 'red'}>{r.status}</Badge>
              )},
              { key: 'lastSync', header: 'Last sync', align: 'right', mono: true },
            ]}
            rows={integrations}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Organisation growth" subtitle="Headcount, joiners and exits" className="lg:col-span-2">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={headcountTrend} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="sahc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={[480, 600]} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="headcount" stroke="#7C3AED" strokeWidth={2} fill="url(#sahc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Operational load" bodyClass="p-3">
          {[
            ['Open helpdesk tickets', tickets.filter((t) => t.status !== 'Resolved').length, 'amber'],
            ['Leave awaiting approval', leaveRequests.filter((r) => r.status === 'Pending').length, 'blue'],
            ['SLA breaches', tickets.filter((t) => t.sla === 'Breached').length, 'red'],
            ['Employee records', employees.length, 'green'],
          ].map(([label, value, tone]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-0">
              <span className="text-[12px] text-[#374151]">{label}</span>
              <Badge tone={tone}>{value}</Badge>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Recent audit events" subtitle="Most recent first" bodyClass="p-0"
        actions={<Link to="/system" className="text-[11px] text-cyan hover:underline">Full audit log</Link>}>
        <Table
          columns={[
            { key: 'id', header: 'Event', mono: true },
            { key: 'at', header: 'When', mono: true },
            { key: 'actor', header: 'Actor' },
            { key: 'action', header: 'Action', render: (r) => (
              <Badge tone={r.action.includes('Failed') ? 'red' : r.action.includes('Role') ? 'purple' : 'gray'}>{r.action}</Badge>
            )},
            { key: 'target', header: 'Target' },
            { key: 'ip', header: 'Source', mono: true },
          ]}
          rows={auditLog.slice(0, 6)}
        />
      </Card>
    </>
  )
}

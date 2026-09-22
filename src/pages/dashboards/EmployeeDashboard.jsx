import { Link } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { CalendarCheck, CalendarDays, Wallet, Clock, PartyPopper } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Progress, Table } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useApp } from '../../context/DataContext.jsx'
import {
  leaveBalances, attendanceSummary, attendanceLog, payslips, goals, INR,
} from '../../data/mock.js'
import { companyHolidays, prettyDate } from '../../data/holidays.js'

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const { announcements, punch } = useApp()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const lastPayslip = payslips.find((p) => p.status === 'Paid')

  const hours = attendanceLog.filter((d) => d.hours !== '--').slice(0, 10).reverse()
    .map((d) => ({ date: d.date.slice(8), hours: parseFloat(d.hours) }))

  return (
    <>
      <PageHeader
        title={greeting + ', ' + (user?.shortName || String(user?.name || '').split(' ')[0])}
        subtitle={user?.designation + ' - ' + user?.department + ' - ' + user?.location}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Present this month" value={attendanceSummary.present} hint="of 22 working days" icon={CalendarCheck} tone="green" />
        <StatCard label="Leave balance" value={leaveBalances.reduce((s, l) => s + (l.total - l.used), 0)} hint="days across all types" icon={CalendarDays} tone="cyan" />
        <StatCard label="Last net pay" value={INR(lastPayslip.net)} hint={lastPayslip.month} icon={Wallet} tone="blue" />
        <StatCard label="Today" value={punch.outAt || punch.inAt || '--'} hint={punch.outAt ? 'punched out' : 'punched in'} icon={Clock} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="My hours" subtitle="Last 10 working days" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 12]} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Bar dataKey="hours" fill="#00B4D8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="My leave balance" subtitle="Financial year 2026-27">
          <div className="space-y-3.5">
            {leaveBalances.filter((l) => l.total > 0).map((l) => (
              <div key={l.code}>
                <div className="flex justify-between text-[12px] mb-1.5">
                  <span className="text-[#374151]">{l.type}</span>
                  <span className="font-mono text-navy">{l.total - l.used}<span className="text-faint"> / {l.total}</span></span>
                </div>
                <Progress value={((l.total - l.used) / l.total) * 100} color={l.color} />
              </div>
            ))}
          </div>
          <Link to="/leave" className="btn-primary w-full justify-center mt-4">Apply for leave</Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Announcements" className="lg:col-span-2" bodyClass="p-0"
          actions={<Link to="/announcements" className="text-[11px] text-cyan hover:underline">View all</Link>}>
          {announcements.slice(0, 3).map((a) => (
            <div key={a.id} className="lift px-4 py-3 border-b border-line last:border-0 hover:bg-canvas/60">
              <div className="flex items-start justify-between gap-3">
                <h3 className="h3">{a.title}</h3>
                <Badge tone="cyan">{a.tag}</Badge>
              </div>
              <p className="text-[12px] text-muted mt-1 line-clamp-2">{a.body}</p>
              <p className="text-[10px] text-faint mt-1.5">{a.author} - {a.date}</p>
            </div>
          ))}
        </Card>

        <div className="space-y-4">
          <Card title="Upcoming holidays" bodyClass="p-0"
            actions={<Link to="/holidays" className="text-[11px] text-cyan hover:underline">Calendar</Link>}>
            <Table
              columns={[
                { key: 'date', header: 'Date', mono: true, render: (r) => prettyDate(r.date) },
                { key: 'name', header: 'Occasion' },
              ]}
              rows={companyHolidays.filter((h) => new Date(h.date) >= new Date('2026-09-22')).slice(0, 4)}
            />
          </Card>

          <Card title="My goals" bodyClass="p-3">
            {goals.slice(0, 3).map((g) => (
              <div key={g.title} className="mb-3 last:mb-0">
                <div className="flex justify-between gap-2 text-[12px] mb-1.5">
                  <span className="text-[#374151] truncate">{g.title}</span>
                  <span className="font-mono text-navy shrink-0">{g.progress}%</span>
                </div>
                <Progress value={g.progress} color={g.status === 'On Track' ? '#16A34A' : '#D97706'} />
              </div>
            ))}
            <Link to="/performance" className="btn-secondary w-full justify-center mt-2">Open performance</Link>
          </Card>

          <Card bodyClass="p-3">
            <p className="flex items-center gap-2 text-[12px] text-[#374151]">
              <PartyPopper size={14} className="text-cyan shrink-0" />
              Your next work anniversary is on 4 September 2027.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}

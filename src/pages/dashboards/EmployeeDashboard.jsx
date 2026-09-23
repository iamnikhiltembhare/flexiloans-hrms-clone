import { Link } from 'react-router-dom'
import {
  ClipboardCheck, CalendarDays, Wallet, Zap, FileSpreadsheet, Receipt,
  Activity, ArrowRight, PartyPopper,
} from 'lucide-react'
import { PageHeader, Card, Badge } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useApp } from '../../context/DataContext.jsx'
import { holidayList, prettyDate, weekdayOf, OPTIONAL_HOLIDAY_QUOTA } from '../../data/holidays.js'
import { leaveBalances, payslips, INR } from '../../data/mock.js'

const QUOTES = [
  ['Either you run the day, or the day runs you.', 'Jim Rohn'],
  ['Well begun is half done.', 'Aristotle'],
  ['Quality is not an act, it is a habit.', 'Aristotle'],
  ['The way to get started is to quit talking and begin doing.', 'Walt Disney'],
]

/** Card with a centred illustration-style empty state, as the portal uses. */
function EmptyCard({ title, icon: Icon, message, tone = 'cyan', action }) {
  const bg = {
    cyan: 'bg-cyan-bg text-[#0097B2]', green: 'bg-[rgba(22,163,74,0.1)] text-[#16A34A]',
    amber: 'bg-[rgba(217,119,6,0.1)] text-[#D97706]', purple: 'bg-[rgba(124,58,237,0.1)] text-[#7C3AED]',
  }[tone]
  return (
    <Card title={title} bodyClass="p-5" actions={action}>
      <div className="flex flex-col items-center justify-center text-center py-4">
        <span className={'grid place-items-center h-14 w-14 rounded-2xl mb-3 ' + bg}><Icon size={24} /></span>
        <p className="text-[12px] text-muted max-w-[16rem] leading-relaxed">{message}</p>
      </div>
    </Card>
  )
}

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const { announcements, leaveRequests } = useApp()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const [quote, author] = QUOTES[new Date().getDate() % QUOTES.length]

  const today = new Date('2026-09-23')
  const upcoming = holidayList.filter((h) => new Date(h.date) >= today).slice(0, 4)
  const pendingMine = leaveRequests.filter((r) => r.empId === user.id && r.status === 'Pending')
  const rhUsed = leaveRequests.filter((r) => r.empId === user.id && r.type === 'Optional Holiday').length

  const quickAccess = [
    { label: 'Reimbursement Payslip', to: '/payroll', icon: Receipt },
    { label: 'IT Statement', to: '/payroll', icon: FileSpreadsheet },
    { label: 'YTD Reports', to: '/payroll', icon: Activity },
    { label: 'Loan Statement', to: '/payroll', icon: Wallet },
  ]

  return (
    <>
      <PageHeader
        title={greeting + ', ' + (user?.shortName || String(user?.name || '').split(' ')[0])}
        subtitle={`"${quote}" - ${author}`}
      />

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {/* Review */}
        {pendingMine.length === 0 ? (
          <EmptyCard title="Review" icon={ClipboardCheck} tone="green"
            message="Hurrah! You've nothing to review." />
        ) : (
          <Card title="Review" bodyClass="p-0">
            {pendingMine.slice(0, 3).map((r) => (
              <Link key={r.id} to="/leave" className="lift block px-4 py-3 border-b border-line last:border-0 hover:bg-canvas/60">
                <p className="text-[13px] font-medium text-navy">{r.type}</p>
                <p className="text-[11px] text-muted mt-0.5 font-mono">{r.from} - {r.days}d</p>
                <Badge tone="amber">Awaiting approval</Badge>
              </Link>
            ))}
          </Card>
        )}

        {/* Upcoming Holidays */}
        <Card title="Upcoming Holidays" bodyClass="p-2"
          actions={<Link to="/holidays" className="text-muted hover:text-cyan" aria-label="Open holiday calendar"><ArrowRight size={15} /></Link>}>
          {upcoming.map((h) => (
            <div key={h.date + h.name} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-canvas transition-colors">
              <span className="w-12 shrink-0">
                <span className="block text-[13px] font-semibold text-navy leading-none">
                  {prettyDate(h.date).split(' ').slice(0, 2).join(' ')}
                </span>
                <span className="block text-[10px] text-muted mt-0.5">{weekdayOf(h.date)}</span>
              </span>
              <span className="flex-1 min-w-0 text-[12px] text-[#374151] truncate">{h.name}</span>
              {h.optional && (
                <Link to="/holidays" className="shrink-0 text-[12px] font-medium text-cyan hover:underline">Apply</Link>
              )}
            </div>
          ))}
        </Card>

        {/* Payslip */}
        <EmptyCard title="Payslip" icon={Wallet} tone="amber"
          message="Uh oh! Your Payslip will show up here after the release of Payroll."
          action={<Link to="/payroll" className="text-[11px] text-cyan hover:underline">Payroll</Link>} />

        {/* Quick Access */}
        <Card title="Quick Access" bodyClass="p-2">
          {quickAccess.map(({ label, to, icon: Icon }) => (
            <Link key={label} to={to}
              className="lift flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-canvas text-[12px] text-[#374151]">
              <Icon size={14} className="text-cyan shrink-0" />
              {label}
            </Link>
          ))}
          <p className="px-2.5 pt-2 text-[10px] text-faint">Quick access to important salary details.</p>
        </Card>

        {/* IT Declaration */}
        <EmptyCard title="IT Declaration" icon={FileSpreadsheet} tone="purple"
          message="Hold on! You can submit your Income Tax (IT) declaration once released." />

        {/* POI */}
        <EmptyCard title="POI" icon={Receipt} tone="cyan"
          message="Hold on! You can submit your Proof of Investments (POI) once released." />

        {/* Track */}
        <EmptyCard title="Track" icon={Activity} tone="green"
          message="All good! You've nothing new to track." />

        {/* Leave snapshot */}
        <Card title="Leave Balance" bodyClass="p-3"
          actions={<Link to="/leave" className="text-[11px] text-cyan hover:underline">All</Link>}>
          {leaveBalances.slice(0, 4).map((l) => (
            <div key={l.code} className="flex items-center justify-between gap-2 py-1.5 border-b border-line/70 last:border-0">
              <span className="text-[12px] text-[#374151] truncate">{l.type}</span>
              <span className="text-[12px] font-mono text-navy shrink-0">
                {l.balance}<span className="text-faint"> / {l.granted}</span>
              </span>
            </div>
          ))}
          <p className="text-[10px] text-faint mt-2">
            Restricted Holiday: {rhUsed} of {OPTIONAL_HOLIDAY_QUOTA} used
          </p>
        </Card>

        {/* Announcements */}
        <Card title="Announcements" className="lg:col-span-2" bodyClass="p-0"
          actions={<Link to="/announcements" className="text-[11px] text-cyan hover:underline">View all</Link>}>
          {announcements.slice(0, 2).map((a) => (
            <div key={a.id} className="lift px-4 py-3 border-b border-line last:border-0 hover:bg-canvas/60">
              <div className="flex items-start justify-between gap-3">
                <h3 className="h3">{a.title}</h3>
                <Badge tone="cyan">{a.tag}</Badge>
              </div>
              <p className="text-[12px] text-muted mt-1 line-clamp-2">{a.body}</p>
            </div>
          ))}
        </Card>

        {/* Last payslip */}
        <Card title="Last Settled Payslip" bodyClass="p-4">
          <p className="text-[11px] text-muted">{payslips.find((p) => p.status === 'Paid').month}</p>
          <p className="text-2xl font-semibold text-navy font-mono mt-1">
            {INR(payslips.find((p) => p.status === 'Paid').net)}
          </p>
          <Link to="/payroll" className="btn-secondary w-full justify-center mt-3">View payslips</Link>
        </Card>

        <Card bodyClass="p-4">
          <p className="flex items-start gap-2 text-[12px] text-[#374151]">
            <PartyPopper size={15} className="text-cyan shrink-0 mt-0.5" />
            Your next work anniversary is on 4 September 2027.
          </p>
        </Card>
      </div>
    </>
  )
}

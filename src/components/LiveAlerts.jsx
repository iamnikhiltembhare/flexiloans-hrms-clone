import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, ChevronRight } from 'lucide-react'
import { Card } from './ui.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'
import { alertsFor } from '../lib/hr/insights.js'
import { localDate } from '../lib/actions.js'

const SKIN = {
  critical: { icon: AlertOctagon, cls: 'text-[#DC2626] bg-[#DC2626]/10', bar: '#DC2626' },
  warning: { icon: AlertTriangle, cls: 'text-[#D97706] bg-[#D97706]/10', bar: '#D97706' },
  info: { icon: Info, cls: 'text-[#2563EB] bg-[#2563EB]/10', bar: '#2563EB' },
}

/** Alerts computed from live data; they refresh whenever the data does. */
export default function LiveAlerts({ className = '' }) {
  const state = useApp()
  const { user, can } = useAuth()
  const d = new Date()
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const today = localDate()
  const alerts = useMemo(() => (user ? alertsFor(state, { user, can, perms: PERMS, today, nowMin }) : []),
    // Recompute on data changes (and each minute via nowMin), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.leaveRequests, state.tickets, state.grievances, state.onboarding, state.appraisals, state.payroll, state.training, state.candidates, state.punch, state.employees, user, today, nowMin])
  const critical = alerts.filter((a) => a.level === 'critical').length

  return (
    <Card title="Live alerts" subtitle={alerts.length ? alerts.length + ' need attention' + (critical ? ', ' + critical + ' critical' : '') : 'Updated as things change'}
      className={className} bodyClass="p-2"
      actions={<span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16A34A] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#16A34A]" /></span>Live</span>}>
      {alerts.length === 0 ? (
        <p className="flex items-center gap-2 px-2 py-6 justify-center text-[13px] text-muted"><CheckCircle2 size={16} className="text-[#16A34A]" /> All clear - nothing needs you right now.</p>
      ) : (
        <ul className="space-y-1">
          {alerts.slice(0, 7).map((a) => {
            const s = SKIN[a.level]
            return (
              <li key={a.id}>
                <Link to={a.to} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas transition-colors">
                  <span className={'grid h-8 w-8 shrink-0 place-items-center rounded-lg ' + s.cls}><s.icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-navy">{a.title}</span>
                    <span className="block truncate text-[11px] text-muted">{a.detail}</span>
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-faint" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

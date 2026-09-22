import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays, Wallet, FileText,
  Megaphone, Briefcase, Target, LifeBuoy, BarChart3, Settings, User, X, ShieldCheck, CalendarHeart,
} from 'lucide-react'
import Logo from './Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'

// Every nav item declares the permission it needs. A group disappears when
// none of its items are permitted for the signed-in role.
const GROUPS = [
  { title: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, perm: PERMS.SELF },
    { to: '/announcements', label: 'Announcements', icon: Megaphone, perm: PERMS.SELF },
  ]},
  { title: 'My Workspace', items: [
    { to: '/attendance', label: 'Attendance', icon: CalendarCheck, perm: PERMS.SELF },
    { to: '/leave', label: 'Leave', icon: CalendarDays, perm: PERMS.SELF },
    { to: '/holidays', label: 'Holiday Calendar', icon: CalendarHeart, perm: PERMS.SELF },
    { to: '/payroll', label: 'Payroll', icon: Wallet, perm: PERMS.SELF },
    { to: '/documents', label: 'Documents', icon: FileText, perm: PERMS.SELF },
    { to: '/performance', label: 'Performance', icon: Target, perm: PERMS.SELF },
    { to: '/profile', label: 'My Profile', icon: User, perm: PERMS.SELF },
  ]},
  { title: 'People Ops', items: [
    { to: '/employees', label: 'Employees', icon: Users, perm: PERMS.HR_PEOPLE },
    { to: '/recruitment', label: 'Recruitment', icon: Briefcase, perm: PERMS.HR_HIRING },
    { to: '/helpdesk', label: 'Helpdesk', icon: LifeBuoy, perm: PERMS.HR_DESK },
    { to: '/reports', label: 'Reports', icon: BarChart3, perm: PERMS.HR_REPORTS },
  ]},
  { title: 'Administration', items: [
    { to: '/settings', label: 'Settings', icon: Settings, perm: PERMS.ADMIN_SETTINGS },
    { to: '/system', label: 'System Admin', icon: ShieldCheck, perm: PERMS.ADMIN_SYSTEM },
  ]},
]

export default function Sidebar({ open, onClose }) {
  const { can, user } = useAuth()

  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={
        'fixed lg:static z-40 inset-y-0 left-0 w-60 shrink-0 text-white flex flex-col transition-transform duration-300 ease-out bg-[linear-gradient(175deg,#1B365D_0%,#16294a_60%,#0f1e36_100%)] ' +
        (open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      }>
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          <Logo variant="light" />
          <button className="lg:hidden text-white/60 hover:text-white" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {groups.map((g) => (
            <div key={g.title} className="mb-4">
              <p className="px-4 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">{g.title}</p>
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={onClose}
                  className={({ isActive }) =>
                    'nav-item group relative flex items-center gap-2.5 px-4 py-2 text-[13px] ' +
                    (isActive
                      ? 'bg-[rgba(0,180,216,0.15)] text-white font-medium'
                      : 'text-white/60 hover:bg-white/[0.08] hover:text-white')
                  }>
                  {({ isActive }) => (
                    <>
                      <span className={'absolute left-0 top-0 bottom-0 w-0.5 bg-cyan rounded-r transition-all duration-300 ' +
                        (isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50')} />
                      <Icon size={15} className="transition-transform duration-200 group-hover:scale-110" />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 shrink-0">
          <p className="text-[10px] text-white/50">Signed in as</p>
          <p className="text-[11px] text-white font-medium truncate">{user?.role}</p>
          <p className="text-[10px] text-white/35 mt-1.5">FlexiLoans HRMS - v1.0 demo</p>
        </div>
      </aside>
    </>
  )
}

import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CalendarCheck, CalendarDays, Layers, Users, LifeBuoy, ShieldCheck, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/DataContext.jsx'
import { PERMS } from '../data/accounts.js'
import { haptic } from '../lib/native.js'

// Phone and tablet navigation: the four places each role visits most, plus
// "More" for the full menu. Hidden on desktop, where the sidebar is always open.
function tabsFor(can) {
  const tabs = [{ to: '/', label: 'Home', icon: LayoutDashboard, end: true }]
  if (can(PERMS.ADMIN_SYSTEM)) {
    tabs.push({ to: '/employees', label: 'People', icon: Users }, { to: '/leave', label: 'Leave', icon: CalendarDays }, { to: '/system', label: 'Admin', icon: ShieldCheck })
  } else if (can(PERMS.HR_PEOPLE)) {
    tabs.push({ to: '/leave', label: 'Leave', icon: CalendarDays }, { to: '/employees', label: 'People', icon: Users }, { to: '/helpdesk', label: 'Helpdesk', icon: LifeBuoy })
  } else {
    tabs.push({ to: '/attendance', label: 'Attendance', icon: CalendarCheck }, { to: '/leave', label: 'Leave', icon: CalendarDays }, { to: '/requests', label: 'Requests', icon: Layers })
  }
  return tabs
}

export default function BottomNav({ onMore }) {
  const { can } = useAuth()
  const { unread } = useApp()

  const item = 'relative flex-1 flex flex-col items-center gap-1 pt-2 pb-1.5 text-[10.5px] font-medium select-none'
  const pill = (active) =>
    'flex items-center justify-center h-8 w-14 rounded-full transition-all duration-300 ' +
    (active ? 'bg-cyan-bg text-navy scale-100' : 'text-muted scale-95')

  return (
    <nav className="bottom-nav lg:hidden shrink-0 bg-white/95 backdrop-blur border-t border-line flex" aria-label="Primary">
      {tabsFor(can).map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => haptic()} className={item}>
          {({ isActive }) => (
            <>
              <span className={pill(isActive)}><Icon size={19} strokeWidth={isActive ? 2.3 : 1.9} /></span>
              <span className={isActive ? 'text-navy font-semibold' : 'text-muted'}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button type="button" className={item} onClick={() => { haptic(); onMore() }}>
        <span className={pill(false)}>
          <Menu size={19} />
          {unread > 0 && <span className="absolute top-1.5 right-[calc(50%-1.1rem)] h-2 w-2 rounded-full bg-[#DC2626] ring-2 ring-white" />}
        </span>
        <span className="text-muted">More</span>
      </button>
    </nav>
  )
}

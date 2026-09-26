import { NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND } from '../lib/brand.js'
import { navFor } from './navItems.js'

// Desktop navigation. On phones and tablets the MobileMenu sheet replaces it.
export default function Sidebar() {
  const { can, user } = useAuth()

  const groups = navFor(can)

  return (
    <aside className="sidebar hidden lg:flex w-60 shrink-0 text-white flex-col bg-[linear-gradient(175deg,#1B365D_0%,#16294a_60%,#0f1e36_100%)]">
      <div className="sidebar-head h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <Logo variant="light" />
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {groups.map((g) => (
          <div key={g.title} className="mb-4">
            <p className="px-4 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">{g.title}</p>
            {g.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  'nav-item group relative flex items-center gap-2.5 px-4 py-2.5 lg:py-2 text-[14px] lg:text-[13px] ' +
                  (isActive
                    ? 'bg-[rgba(0,180,216,0.22)] text-white font-semibold'
                    : 'text-white/[0.78] hover:bg-white/[0.12] hover:text-white')
                }>
                {({ isActive }) => (
                  <>
                    <span className={'absolute left-0 top-0 bottom-0 w-[3px] bg-cyan rounded-r transition-all duration-300 ' +
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

      <div className="sidebar-foot px-4 py-3 border-t border-white/10 shrink-0">
        <p className="text-[10px] text-white/50">Signed in as</p>
        <p className="text-[11px] text-white font-medium truncate">{user?.role}</p>
        <p className="text-[10px] text-white/55 mt-1.5">{BRAND.company} HRMS - v1.0 demo</p>
      </div>
    </aside>
  )
}

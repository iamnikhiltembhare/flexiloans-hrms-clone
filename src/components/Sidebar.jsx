import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, LogOut, Sun, Moon } from 'lucide-react'
import Logo from './Logo.jsx'
import { Avatar } from './ui.jsx'
import { ThemeIconSwitch } from './ThemeToggle.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND } from '../lib/brand.js'
import { navFor } from './navItems.js'
import { useTheme } from '../lib/theme.js'

// Desktop navigation (the MobileMenu sheet replaces it on phones and
// tablets). Collapses to an icon rail; labels then show as hover tips.
export default function Sidebar({ collapsed, onToggle }) {
  const { can, user, logout } = useAuth()
  const navigate = useNavigate()
  const { resolved, toggle } = useTheme()
  const groups = navFor(can)
  // Collapsed rail: the hovered item's label, drawn outside the scrolling nav.
  const [tip, setTip] = useState(null)
  const showTip = (label) => (e) => {
    if (!collapsed) return
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ label, top: r.top + r.height / 2 })
  }

  return (
    <aside className={'sidebar hidden lg:flex shrink-0 text-white flex-col transition-[width] duration-300 ease-out ' +
      'bg-[linear-gradient(175deg,#1B365D_0%,#16294a_60%,#0f1e36_100%)] ' + (collapsed ? 'is-collapsed w-[76px]' : 'w-64')}>
      <div className="sidebar-head h-14 flex items-center justify-between gap-2 px-4 border-b border-white/10 shrink-0">
        <Logo variant="light" markOnly={collapsed} />
        {!collapsed && (
          <button onClick={onToggle} className="side-icon-btn" aria-label="Collapse sidebar" title="Collapse sidebar (Ctrl+B)">
            <ChevronsLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={onToggle} className="side-icon-btn mx-auto mt-3" aria-label="Expand sidebar" title="Expand sidebar (Ctrl+B)">
          <ChevronsRight size={16} />
        </button>
      )}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {groups.map((g) => (
          <div key={g.title} className="mb-2.5">
            {collapsed
              ? <div className="mx-5 my-2 h-px bg-white/10" />
              : <p className="px-5 mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/45">{g.title}</p>}
            {g.items.map(({ to, label, icon: Icon, end, tint }) => (
              <NavLink key={to} to={to} end={end} aria-label={collapsed ? label : undefined}
                className={({ isActive }) => 'side-item ' + (isActive ? 'is-active' : '')}
                style={{ '--tint': tint }}
                onMouseEnter={showTip(label)} onMouseLeave={() => setTip(null)} onFocus={showTip(label)} onBlur={() => setTip(null)}>
                <span className="side-chip"><Icon size={15} strokeWidth={2} /></span>
                <span className="side-label">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot border-t border-white/10 shrink-0 p-3">
        <button onClick={() => navigate('/profile')} title={collapsed ? user?.name : undefined}
          className={'w-full flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-white/[.07] text-left ' + (collapsed ? 'justify-center' : '')}>
          <Avatar name={user?.name || 'User'} size={34} />
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold truncate">{user?.name}</span>
              <span className="block text-[10.5px] text-white/55 truncate">{user?.role}</span>
            </span>
          )}
        </button>
        <div className={'mt-2 flex items-center gap-2 ' + (collapsed ? 'flex-col' : 'justify-between')}>
          {collapsed
            ? <button onClick={toggle} className="side-icon-btn" aria-label={resolved === 'dark' ? 'Light mode' : 'Dark mode'} title={resolved === 'dark' ? 'Light mode' : 'Dark mode'}>
                {resolved === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            : <ThemeIconSwitch />}
          <button onClick={() => { logout(); navigate('/login') }} className="side-icon-btn hover:!bg-[rgba(248,113,113,.18)] hover:!text-[#FCA5A5]"
            aria-label="Sign out" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
        {!collapsed && <p className="text-[10px] text-white/40 mt-2.5 px-1">{BRAND.company} HRMS - v1.0</p>}
      </div>
      {collapsed && tip && <span className="side-tip" style={{ top: tip.top }} role="tooltip">{tip.label}</span>}
    </aside>
  )
}

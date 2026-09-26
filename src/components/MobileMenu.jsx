import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut, X, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/DataContext.jsx'
import { Avatar } from './ui.jsx'
import { ThemeSwitch } from './ThemeToggle.jsx'
import { navFor } from './navItems.js'
import { useBackHandler, haptic } from '../lib/native.js'
import { BRAND } from '../lib/brand.js'

// The phone and tablet main menu: a sheet with the signed-in person, the
// appearance switch, and every screen as a colour-coded tile.
export default function MobileMenu({ open, onClose }) {
  const { user, can, logout } = useAuth()
  const { punch } = useApp()
  const navigate = useNavigate()
  useBackHandler(open, onClose)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const groups = navFor(can)
  const punchedIn = Boolean(punch?.inAt) && !punch?.outAt
  let tileIndex = 0

  const go = (to) => { haptic(); onClose(); navigate(to) }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Main menu">
      <div className="absolute inset-0 bg-brand-900/60 backdrop-blur-[3px]" style={{ animation: 'fl-fade .2s ease-out both' }} onClick={onClose} />

      <div className="menu-sheet relative w-full max-w-xl bg-canvas rounded-t-[28px] flex flex-col overflow-hidden">
        <div className="flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-line2" /></div>

        <div className="overflow-y-auto overscroll-contain px-4 pb-4">
          {/* Who is signed in */}
          <section className="menu-hero relative overflow-hidden rounded-3xl p-4 text-white mt-1">
            <button onClick={onClose} aria-label="Close menu"
              className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
              <X size={16} />
            </button>
            <button onClick={() => go('/profile')} className="flex items-center gap-3 text-left pr-10">
              <span className="rounded-full ring-2 ring-white/40"><Avatar name={user?.name || 'User'} size={52} /></span>
              <span className="min-w-0">
                <span className="block text-[17px] font-bold leading-tight truncate">{user?.name}</span>
                <span className="block text-[12px] text-white/75 truncate">{user?.designation}</span>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold">
                  {user?.role} <ChevronRight size={11} />
                </span>
              </span>
            </button>
            <div className="mt-3.5 flex items-center gap-2 text-[11.5px] text-white/85">
              <span className={'h-2 w-2 rounded-full ' + (punchedIn ? 'bg-[#4ADE80] shadow-[0_0_0_3px_rgba(74,222,128,.25)]' : 'bg-white/50')} />
              <Clock size={12} className="opacity-80" />
              {punchedIn ? 'Punched in at ' + punch.inAt : punch?.outAt ? 'Punched out at ' + punch.outAt : 'Not punched in yet'}
            </div>
          </section>

          {/* Appearance */}
          <section className="mt-4">
            <p className="menu-title">Appearance</p>
            <ThemeSwitch />
          </section>

          {/* Every screen, grouped */}
          {groups.map((g) => (
            <section key={g.title} className="mt-4">
              <p className="menu-title">{g.title}</p>
              <div className="grid grid-cols-3 min-[380px]:grid-cols-4 gap-2 rounded-3xl bg-surface border border-line p-2">
                {g.items.map(({ to, label, short, icon: Icon, end, tint }) => (
                  <NavLink key={to} to={to} end={end} onClick={() => { haptic(); onClose() }}
                    className={({ isActive }) => 'menu-tile group ' + (isActive ? 'is-active' : '')}
                    style={{ '--tint': tint, animationDelay: Math.min(tileIndex++ * 22, 400) + 'ms' }}>
                    <span className="menu-tile-icon"><Icon size={21} strokeWidth={2} /></span>
                    <span className="menu-tile-label">{short || label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}

          <button onClick={() => { haptic('warning'); onClose(); logout(); navigate('/login') }}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl border border-[#DC2626]/35 bg-surface py-3 text-[14px] font-semibold text-[#DC2626] active:scale-[.99] transition-transform">
            <LogOut size={16} /> Sign out
          </button>
          <p className="text-center text-[10.5px] text-faint mt-3">{BRAND.company} HRMS - v1.0</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

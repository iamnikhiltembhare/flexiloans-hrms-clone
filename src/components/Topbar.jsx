import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Menu, Bell, Search, LogOut, ChevronDown, Clock, CheckCheck,
  CalendarDays, AlertTriangle, Briefcase, Info, User, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/DataContext.jsx'
import { Avatar } from './ui.jsx'

const NOTE_ICON = { leave: CalendarDays, alert: AlertTriangle, task: Briefcase, info: Info }
const NOTE_TONE = { leave: '#7C3AED', alert: '#DC2626', task: '#2563EB', info: '#00B4D8' }

const PAGES = [
  { label: 'Dashboard', to: '/' }, { label: 'Announcements', to: '/announcements' },
  { label: 'Attendance', to: '/attendance' }, { label: 'Leave', to: '/leave' },
  { label: 'Payroll', to: '/payroll' }, { label: 'Documents', to: '/documents' },
  { label: 'Performance', to: '/performance' }, { label: 'My Profile', to: '/profile' },
  { label: 'Employees', to: '/employees' }, { label: 'Recruitment', to: '/recruitment' },
  { label: 'Helpdesk', to: '/helpdesk' }, { label: 'Reports', to: '/reports' },
  { label: 'Settings', to: '/settings' },
]

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth()
  const { notifications, unread, markRead, markAllRead, clearNotifications, employees, tickets, punch, punchToggle, toast } = useApp()
  const navigate = useNavigate()

  const [menu, setMenu] = useState(false)
  const [bell, setBell] = useState(false)
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)
  const searchRef = useRef(null)
  const location = useLocation()

  // Close every popover when the route changes, so no invisible overlay is
  // ever left mounted over the page.
  useEffect(() => { setFocused(false); setQ(''); setBell(false); setMenu(false) }, [location.pathname])

  // Close the search results on any click outside the search box.
  useEffect(() => {
    if (!focused) return
    const onDown = (e) => { if (!searchRef.current?.contains(e.target)) setFocused(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [focused])

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const punchedIn = Boolean(punch.inAt) && !punch.outAt

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return null
    return {
      people: employees.filter((e) => (e.name + ' ' + e.id + ' ' + e.designation + ' ' + e.department).toLowerCase().includes(term)).slice(0, 5),
      pages: PAGES.filter((p) => p.label.toLowerCase().includes(term)).slice(0, 4),
      tickets: tickets.filter((t) => (t.id + ' ' + t.subject).toLowerCase().includes(term)).slice(0, 3),
    }
  }, [q, employees, tickets])

  const go = (to) => { setQ(''); setFocused(false); inputRef.current?.blur(); navigate(to) }

  const total = results ? results.people.length + results.pages.length + results.tickets.length : 0

  const onPunch = () => {
    const { action, now } = punchToggle()
    toast(action === 'in' ? 'Punched in' : 'Punched out',
      (action === 'in' ? 'Shift started at ' : 'Shift ended at ') + now)
  }

  return (
    <header className="h-14 shrink-0 bg-white border-b border-line flex items-center gap-3 px-4 sticky top-0 z-30">
      <button className="lg:hidden text-navy" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>

      <div ref={searchRef} className="hidden md:block relative w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input ref={inputRef} className="input pl-8 pr-7 py-1.5 text-xs bg-canvas"
          placeholder="Search people, pages, tickets..." value={q}
          onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() } }} />
        {q && (
          <button onClick={() => { setQ(''); inputRef.current?.focus() }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-navy" aria-label="Clear search"><X size={13} /></button>
        )}

        {focused && results && (
          <div className="absolute left-0 right-0 mt-1.5 card p-1.5 z-40 max-h-[22rem] overflow-y-auto">
              {total === 0 && <p className="px-2.5 py-3 text-[12px] text-muted">No matches for "{q}".</p>}

              {results.people.length > 0 && <p className="px-2.5 pt-1.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">People</p>}
              {results.people.map((e) => (
                <button key={e.id} onMouseDown={() => go('/employees/' + e.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left">
                  <Avatar name={e.name} size={26} />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium text-navy truncate">{e.name}</span>
                    <span className="block text-[10px] text-muted truncate">{e.designation}</span>
                  </span>
                </button>
              ))}

              {results.pages.length > 0 && <p className="px-2.5 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">Pages</p>}
              {results.pages.map((p) => (
                <button key={p.to} onMouseDown={() => go(p.to)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left text-[12px] text-navy">
                  <Search size={13} className="text-faint" />{p.label}
                </button>
              ))}

              {results.tickets.length > 0 && <p className="px-2.5 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">Tickets</p>}
              {results.tickets.map((t) => (
                <button key={t.id} onMouseDown={() => go('/helpdesk')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-canvas text-left">
                  <span className="text-[10px] font-mono text-faint shrink-0">{t.id}</span>
                  <span className="text-[12px] text-navy truncate">{t.subject}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      <span className="hidden xl:block text-[11px] text-muted ml-1">{today}</span>

      <div className="ml-auto flex items-center gap-2">
        <button onClick={onPunch} className={punchedIn ? 'btn-secondary' : 'btn-primary'}>
          <Clock size={13} />
          {punchedIn ? 'Punch out' : 'Punch in'}
        </button>

        <div className="relative">
          <button onClick={() => setBell((v) => !v)}
            className="relative grid place-items-center h-8 w-8 rounded-lg hover:bg-canvas text-navy" aria-label="Notifications">
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-[#DC2626] text-white text-[9px] font-semibold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {bell && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setBell(false)} />
              <div className="absolute right-0 mt-1.5 w-[min(92vw,22rem)] card z-20 overflow-hidden">
                <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-line">
                  <h3 className="h3">Notifications {unread > 0 && <span className="text-muted font-normal">({unread} new)</span>}</h3>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-cyan hover:underline">
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                </header>

                <div className="max-h-[22rem] overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-3.5 py-8 text-center text-[12px] text-muted">You are all caught up.</p>
                  )}
                  {notifications.map((n) => {
                    const Icon = NOTE_ICON[n.kind] || Info
                    return (
                      <button key={n.id}
                        onClick={() => { markRead(n.id); setBell(false); if (n.to) navigate(n.to) }}
                        className={'w-full text-left flex gap-2.5 px-3.5 py-2.5 border-b border-line last:border-0 hover:bg-canvas transition-colors ' + (n.read ? '' : 'bg-cyan-bg/40')}>
                        <Icon size={15} className="mt-0.5 shrink-0" style={{ color: NOTE_TONE[n.kind] || NOTE_TONE.info }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-medium text-navy">{n.title}</span>
                          <span className="block text-[11px] text-muted">{n.detail}</span>
                          <span className="block text-[10px] text-faint mt-0.5">{n.time}</span>
                        </span>
                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan shrink-0" />}
                      </button>
                    )
                  })}
                </div>

                {notifications.length > 0 && (
                  <footer className="px-3.5 py-2 border-t border-line bg-canvas">
                    <button onClick={clearNotifications} className="text-[11px] text-muted hover:text-navy">Clear all</button>
                  </footer>
                )}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-canvas">
            <Avatar name={user?.name || 'User'} size={28} />
            <span className="hidden sm:block text-left leading-tight">
              <span className="block text-[12px] font-medium text-navy">{user?.name}</span>
              <span className="block text-[10px] text-muted">{user?.designation}</span>
            </span>
            <ChevronDown size={13} className="text-muted" />
          </button>

          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 mt-1.5 w-52 card p-1 z-20">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#374151] rounded-lg hover:bg-canvas"
                  onClick={() => { setMenu(false); navigate('/profile') }}><User size={14} /> My profile</button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#374151] rounded-lg hover:bg-canvas"
                  onClick={() => { setMenu(false); navigate('/settings') }}><Clock size={14} /> Settings</button>
                <div className="h-px bg-line my-1" />
                <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#DC2626] rounded-lg hover:bg-[rgba(220,38,38,0.08)]"
                  onClick={() => { setMenu(false); logout(); navigate('/login') }}>
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

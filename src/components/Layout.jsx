import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { RefreshCw, WifiOff } from 'lucide-react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import DemoBanner from './DemoBanner.jsx'
import BottomNav from './BottomNav.jsx'
import { useApp } from '../context/DataContext.jsx'
import { usePullToRefresh } from '../lib/usePullToRefresh.js'

export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { online, ready, loadError, refresh, toast } = useApp()

  const [scroller, pull, refreshing, trigger] = usePullToRefresh(async () => {
    if (await refresh()) toast('Up to date', 'Latest data loaded from the server', 'info')
  }, online)

  return (
    <div className="app-shell flex overflow-hidden bg-canvas">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setOpen(true)} />
        <DemoBanner />
        <main ref={scroller} className="relative flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          {online && (pull > 0 || refreshing) && (
            <div className="pointer-events-none absolute left-0 right-0 top-0 flex justify-center z-10"
              style={{ transform: `translateY(${pull - 34}px)`, transition: refreshing || pull === 0 ? 'transform .25s' : 'none' }}>
              <span className="h-9 w-9 rounded-full bg-white shadow-card border border-line flex items-center justify-center">
                <RefreshCw size={16} className={'text-cyan-ink ' + (refreshing ? 'animate-spin' : '')}
                  style={refreshing ? undefined : { transform: `rotate(${(pull / trigger) * 270}deg)`, opacity: Math.min(1, pull / trigger) }} />
              </span>
            </div>
          )}

          {online && !ready ? (
            <Connecting error={loadError} onRetry={refresh} />
          ) : (
            // keyed on the path so each page fades in on navigation
            <div key={location.pathname} className="page-enter" style={pull ? { transform: `translateY(${pull * 0.35}px)` } : undefined}>
              <Outlet />
            </div>
          )}
        </main>
        <BottomNav onMore={() => setOpen(true)} />
      </div>
    </div>
  )
}

function Connecting({ error, onRetry }) {
  if (!error) {
    return (
      <div className="h-full min-h-[50vh] flex flex-col items-center justify-center gap-3 text-muted">
        <span className="h-9 w-9 rounded-full border-[3px] border-cyan/25 border-t-cyan animate-spin" />
        <p className="text-[13px]">Loading your workspace...</p>
      </div>
    )
  }
  return (
    <div className="h-full min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center px-6">
      <span className="h-12 w-12 rounded-full bg-[rgba(220,38,38,0.08)] flex items-center justify-center"><WifiOff size={22} className="text-[#DC2626]" /></span>
      <p className="h2">Can't reach the server</p>
      <p className="text-[13px] text-muted max-w-xs">{error}</p>
      <button className="btn-primary mt-1" onClick={onRetry}><RefreshCw size={13} /> Try again</button>
    </div>
  )
}

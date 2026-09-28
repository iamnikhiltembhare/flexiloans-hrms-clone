import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, X, Maximize2 } from 'lucide-react'
import AssistantChat from './AssistantChat.jsx'
import { useBackHandler, haptic } from '../../lib/native.js'

// Floating "Ask HR" button on every screen, and the chat panel it opens:
// a side panel on desktop, full screen on phones. Ctrl/Cmd+J toggles it.
export default function AssistantLauncher() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  useBackHandler(open, () => setOpen(false))

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen((v) => !v) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { if (open) setTimeout(() => document.getElementById('assistant-input')?.focus(), 150) }, [open])

  if (location.pathname === '/assistant') return null

  return (
    <>
      {!open && (
        <button onClick={() => { haptic(); setOpen(true) }} className="assistant-fab" aria-label="Open the HR Assistant (Ctrl+J)" title="HR Assistant (Ctrl+J)">
          <Sparkles size={20} />
          <span className="hidden sm:inline">Ask HR</span>
        </button>
      )}
      {open && createPortal(
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="HR Assistant">
          <div className="absolute inset-0 bg-brand-900/30 hidden sm:block" style={{ animation: 'fl-fade .2s ease-out both' }} onClick={() => setOpen(false)} />
          <div className="assistant-panel">
            <header className="assistant-head flex items-center gap-2.5 border-b border-line px-4">
              <span className="assistant-orb grid h-8 w-8 place-items-center rounded-xl text-white"><Sparkles size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-navy leading-tight">HR Assistant</p>
                <p className="text-[10.5px] text-muted">Answers from your HRMS data</p>
              </div>
              <button onClick={() => { setOpen(false); navigate('/assistant') }} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-navy" aria-label="Open full page" title="Open full page"><Maximize2 size={15} /></button>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-navy" aria-label="Close"><X size={17} /></button>
            </header>
            <AssistantChat onNavigate={() => setOpen(false)} />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

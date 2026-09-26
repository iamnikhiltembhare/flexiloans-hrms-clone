import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBackHandler } from '../lib/native.js'

export default function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useBackHandler(open, onClose)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  // Portalled to <body> so no page transform or animation can trap it below
  // the top bar or the bottom navigation.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:overflow-y-auto sm:p-8">
      <div className="fixed inset-0 bg-navy/40 backdrop-blur-[2px]" style={{ animation: 'fl-fade .2s ease-out both' }} onClick={onClose} />
      <div className={'modal-panel relative w-full ' + width + ' card sm:my-auto'} role="dialog" aria-modal="true">
        <div className="sm:hidden flex justify-center pt-2.5 -mb-1" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-line2" /></div>
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-line">
          <div>
            <h2 className="h2">{title}</h2>
            {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-faint hover:text-navy" aria-label="Close"><X size={17} /></button>
        </header>
        <div className="modal-body p-4">{children}</div>
        {footer && <footer className="modal-foot flex justify-end gap-2 px-4 py-3 border-t border-line bg-canvas sm:rounded-b-card">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

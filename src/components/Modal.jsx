import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-navy/40 backdrop-blur-[2px]" style={{ animation: 'fl-fade .2s ease-out both' }} onClick={onClose} />
      <div className={'relative w-full ' + width + ' card my-auto'} role="dialog" aria-modal="true"
        style={{ animation: 'fl-pop .3s cubic-bezier(.22,.8,.3,1) both' }}>
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-line">
          <div>
            <h2 className="h2">{title}</h2>
            {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-faint hover:text-navy" aria-label="Close"><X size={17} /></button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 px-4 py-3 border-t border-line bg-canvas rounded-b-card">{footer}</footer>}
      </div>
    </div>
  )
}

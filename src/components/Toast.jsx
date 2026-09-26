import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'

const ICONS = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: XCircle }
const BORDER = { success: '#16A34A', info: '#00B4D8', warning: '#D97706', error: '#DC2626' }

export default function ToastStack({ toasts, dismiss }) {
  return (
    <div className="toast-stack fixed right-5 z-[60] flex flex-col gap-2 w-[min(92vw,20rem)]">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind] || Info
        return (
          <div key={t.id} role="status"
            className="card flex items-start gap-2.5 px-3.5 py-3"
            style={{ borderLeft: '3px solid ' + (BORDER[t.kind] || BORDER.info),
              animation: 'fl-slide-in .26s cubic-bezier(.22,.8,.3,1) both' }}>
            <Icon size={15} className="mt-0.5 shrink-0" style={{ color: BORDER[t.kind] || BORDER.info }} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-navy">{t.title}</p>
              {t.detail && <p className="text-[11px] text-muted mt-0.5">{t.detail}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-faint hover:text-navy shrink-0" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

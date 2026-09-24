import { useState } from 'react'
import { Info, X } from 'lucide-react'
import { IS_PUBLIC_DEMO } from '../lib/brand.js'

/** Thin strip shown only on public demo deploys. */
export default function DemoBanner() {
  const [closed, setClosed] = useState(false)
  if (!IS_PUBLIC_DEMO || closed) return null
  return (
    <div className="shrink-0 flex items-start gap-2 px-4 py-2 bg-[rgba(217,119,6,0.1)] border-b border-[#D97706]/30">
      <Info size={14} className="mt-0.5 shrink-0 text-[#D97706]" />
      <p className="text-[12px] text-[#2B3445] flex-1">
        <strong className="text-navy">Demonstration build.</strong> This is a
        portfolio prototype, not a real HR system. Every employee, salary,
        document and post is fabricated, the sign-in is not real authentication,
        and nothing is saved beyond your own browser.
      </p>
      <button onClick={() => setClosed(true)} className="text-[#D97706]/70 hover:text-[#D97706] shrink-0"
        aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  )
}

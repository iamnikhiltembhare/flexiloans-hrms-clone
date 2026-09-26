import { FlaskConical } from 'lucide-react'
import { IS_TEST_BUILD } from '../lib/api.js'

/** Amber strip on every screen of a test build, so test data is never mistaken for real. */
export default function TestBanner({ floating = false }) {
  if (!IS_TEST_BUILD) return null
  return (
    <div className={(floating ? 'test-banner-floating absolute left-0 right-0 top-0 z-20 ' : 'shrink-0 ') +
      'flex items-center justify-center gap-1.5 px-4 py-1 bg-[#D97706] text-white text-[11px] font-semibold tracking-wide'}
      role="status">
      <FlaskConical size={12} />
      TEST BUILD - test accounts and test data only
    </div>
  )
}

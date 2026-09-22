import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Card } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function NoAccess() {
  const { user } = useAuth()
  return (
    <div className="max-w-lg mx-auto mt-10">
      <Card bodyClass="p-8 text-center">
        <span className="inline-grid place-items-center h-14 w-14 rounded-full bg-[rgba(217,119,6,0.1)] mb-4">
          <ShieldAlert size={26} className="text-[#D97706]" />
        </span>
        <h1 className="h1">You don't have access to this page</h1>
        <p className="text-[13px] text-muted mt-2">
          Your account is signed in as <strong className="text-navy">{user?.role}</strong>, which does not
          include this module. If you need it, raise a request with HR Ops or your system administrator.
        </p>
        <Link to="/" className="btn-primary mt-5 inline-flex"><ArrowLeft size={13} /> Back to dashboard</Link>
      </Card>
    </div>
  )
}

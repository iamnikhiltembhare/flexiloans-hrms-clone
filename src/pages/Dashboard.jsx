import { useAuth } from '../context/AuthContext.jsx'
import SuperAdminDashboard from './dashboards/SuperAdminDashboard.jsx'
import HRDashboard from './dashboards/HRDashboard.jsx'
import EmployeeDashboard from './dashboards/EmployeeDashboard.jsx'

// The landing page is chosen by the signed-in account's role.
export default function Dashboard() {
  const { user } = useAuth()
  if (user?.dashboard === 'super') return <SuperAdminDashboard />
  if (user?.dashboard === 'hr') return <HRDashboard />
  return <EmployeeDashboard />
}

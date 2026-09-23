import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { PERMS } from './data/accounts.js'
import Layout from './components/Layout.jsx'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Employees from './pages/Employees.jsx'
import EmployeeDetail from './pages/EmployeeDetail.jsx'
import Attendance from './pages/Attendance.jsx'
import Leave from './pages/Leave.jsx'
import Payroll from './pages/Payroll.jsx'
import Documents from './pages/Documents.jsx'
import Announcements from './pages/Announcements.jsx'
import Recruitment from './pages/Recruitment.jsx'
import Performance from './pages/Performance.jsx'
import Helpdesk from './pages/Helpdesk.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import Profile from './pages/Profile.jsx'
import Holidays from './pages/Holidays.jsx'
import Engage from './pages/Engage.jsx'
import DocumentCenter from './pages/DocumentCenter.jsx'
import People from './pages/People.jsx'
import RequestHub from './pages/RequestHub.jsx'
import SystemAdmin from './pages/SystemAdmin.jsx'
import NoAccess from './pages/NoAccess.jsx'

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

// Route-level permission guard: a restricted URL typed directly lands on the
// access-denied screen instead of rendering the page.
function Require({ perm, children }) {
  const { can } = useAuth()
  if (!can(perm)) return <NoAccess />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />

        {/* Self-service - every role has these */}
        <Route path="announcements" element={<Require perm={PERMS.SELF}><Announcements /></Require>} />
        <Route path="attendance" element={<Require perm={PERMS.SELF}><Attendance /></Require>} />
        <Route path="holidays" element={<Require perm={PERMS.SELF}><Holidays /></Require>} />
        <Route path="leave" element={<Require perm={PERMS.SELF}><Leave /></Require>} />
        <Route path="payroll" element={<Require perm={PERMS.SELF}><Payroll /></Require>} />
        <Route path="documents" element={<Require perm={PERMS.SELF}><DocumentCenter /></Require>} />
        <Route path="engage" element={<Require perm={PERMS.SELF}><Engage /></Require>} />
        <Route path="people" element={<Require perm={PERMS.SELF}><People /></Require>} />
        <Route path="requests" element={<Require perm={PERMS.SELF}><RequestHub /></Require>} />
        <Route path="performance" element={<Require perm={PERMS.SELF}><Performance /></Require>} />
        <Route path="profile" element={<Require perm={PERMS.SELF}><Profile /></Require>} />

        {/* People ops - HR and Super Admin only */}
        <Route path="employees" element={<Require perm={PERMS.HR_PEOPLE}><Employees /></Require>} />
        <Route path="employees/:id" element={<Require perm={PERMS.HR_PEOPLE}><EmployeeDetail /></Require>} />
        <Route path="recruitment" element={<Require perm={PERMS.HR_HIRING}><Recruitment /></Require>} />
        <Route path="helpdesk" element={<Require perm={PERMS.HR_DESK}><Helpdesk /></Require>} />
        <Route path="reports" element={<Require perm={PERMS.HR_REPORTS}><Reports /></Require>} />

        {/* Administration - Super Admin only */}
        <Route path="settings" element={<Require perm={PERMS.ADMIN_SETTINGS}><Settings /></Require>} />
        <Route path="system" element={<Require perm={PERMS.ADMIN_SYSTEM}><SystemAdmin /></Require>} />

        <Route path="no-access" element={<NoAccess />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { BRAND } from '../lib/brand.js'
import { employees } from './mock.js'

// Role and account registry for the FlexiLoans HRMS demo.
// ACCOUNTS is safe to ship anywhere: usernames, roles and profiles only.
// DEMO_PASSWORDS is kept separate so that a server build (VITE_API_BASE_URL
// set) never references it and the bundler drops it. The API server hashes
// these on first start; the offline demo checks them in the browser.

// Permission keys drive both the sidebar and the route guards.
export const PERMS = {
  SELF: 'self',                    // the signed-in person's own records
  HR_PEOPLE: 'hr.people',          // employee directory and records
  HR_HIRING: 'hr.hiring',          // requisitions and candidates
  HR_DESK: 'hr.desk',              // helpdesk queue
  HR_REPORTS: 'hr.reports',        // workforce analytics
  ADMIN_SETTINGS: 'admin.settings',// organisation settings
  ADMIN_SYSTEM: 'admin.system',    // accounts, roles, audit log
}

export const ROLES = {
  super_admin: {
    label: 'Super Admin',
    tone: 'purple',
    dashboard: 'super',
    description: 'Full access including system administration',
    perms: Object.values(PERMS),
  },
  hr: {
    label: 'HR Professional',
    tone: 'cyan',
    dashboard: 'hr',
    description: 'People operations, hiring, helpdesk and reports',
    perms: [PERMS.SELF, PERMS.HR_PEOPLE, PERMS.HR_HIRING, PERMS.HR_DESK, PERMS.HR_REPORTS],
  },
  employee: {
    label: 'Employee',
    tone: 'blue',
    dashboard: 'employee',
    description: 'Self-service only - no HR tools',
    perms: [PERMS.SELF],
  },
}

export const ACCOUNTS = [
  {
    username: 'admin',
    role: 'super_admin',
    profile: {
      id: 'FL0001', name: 'System Administrator', shortName: 'Admin', email: 'admin@' + BRAND.emailDomain,
      designation: 'System Administrator', department: 'IT & Systems', location: 'Mumbai HQ',
      manager: 'Not applicable', joinDate: '2021-01-01', phone: 'Not assigned',
      bloodGroup: 'Not assigned', dob: 'Not assigned', gender: 'Not assigned',
      employmentType: 'Service account', grade: 'Not applicable',
      bank: 'Not applicable', pan: 'Not applicable', uan: 'Not applicable',
    },
  },
  {
    username: 'hr.manager',
    role: 'hr',
    profile: {
      id: 'FL1008', name: 'Aarti Deshmukh', email: 'aarti.deshmukh@' + BRAND.emailDomain,
      designation: 'HR Business Partner', department: 'Human Resources', location: 'Mumbai HQ',
      manager: 'Rakesh Menon', joinDate: '2021-06-14', phone: '+91 98200 11008',
      bloodGroup: 'O+', dob: '1990-02-09', gender: 'Female', employmentType: 'Permanent',
      grade: 'M4', bank: 'ICICI Bank 8820', pan: 'AQWPD****L', uan: '1012****7741',
    },
  },
  {
    username: 'nikhil.tembhare',
    role: 'employee',
    profile: {
      id: 'FL1009', name: 'Nikhil Tembhare', email: 'nikhil.tembhare@' + BRAND.emailDomain,
      designation: 'Software Engineer', department: 'Engineering', location: 'Pune',
      manager: 'Arjun Shaikh', joinDate: '2023-09-04', phone: '+91 98200 31009',
      bloodGroup: 'A+', dob: '1996-11-23', gender: 'Male', employmentType: 'Permanent',
      grade: 'E2', bank: 'Axis Bank 5512', pan: 'BKLPS****M', uan: '1012****9903',
    },
  },
]

// Everyone else in the People directory signs in as an employee, with the
// login shown on their record (firstname.lastname) and the employee password.
export const DIRECTORY_ACCOUNTS = employees
  .filter((e) => !ACCOUNTS.some((a) => a.profile.id === e.id))
  .map((e) => ({
    username: e.username,
    role: 'employee',
    profile: {
      id: e.id, name: e.name, email: e.email, designation: e.designation, department: e.department,
      location: e.location, manager: e.manager, joinDate: e.joinDate, phone: e.phone, gender: e.gender,
      employmentType: e.employmentType, bloodGroup: 'Not provided', dob: 'Not provided', grade: 'Not provided',
      bank: 'Not provided', pan: 'Not provided', uan: 'Not provided',
    },
  }))

export const ALL_ACCOUNTS = [...ACCOUNTS, ...DIRECTORY_ACCOUNTS]

export const EMPLOYEE_PASSWORD = 'FlexiEmp@2026'

export const DEMO_PASSWORDS = {
  'admin': 'Admin@2026',
  'hr.manager': 'FlexiHR@2026',
  'nikhil.tembhare': EMPLOYEE_PASSWORD,
}

/** The seeded password for any known account. */
export const passwordFor = (username) => DEMO_PASSWORDS[username] ?? EMPLOYEE_PASSWORD

export function authenticate(username, password) {
  const u = String(username).trim().toLowerCase()
  const found = ALL_ACCOUNTS.find((a) => a.username === u)
  if (!found || passwordFor(found.username) !== password) return null
  const role = ROLES[found.role]
  return {
    ...found.profile,
    username: found.username,
    roleKey: found.role,
    role: role.label,
    dashboard: role.dashboard,
    perms: role.perms,
  }
}

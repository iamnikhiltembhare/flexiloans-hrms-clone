// Role and account registry for the FlexiLoans HRMS demo.
// Credentials live in the client bundle on purpose: this is a front-end
// prototype with fabricated data and no backend. Replace `authenticate()`
// with a real API call when a server exists.

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
    username: 'nikhil.tembhare',
    password: 'demo1234',
    role: 'super_admin',
    profile: {
      id: 'FL1042', name: 'Nikhil Tembhare', email: 'nikhil.tembhare@flexiloans.com',
      designation: 'Senior Product Manager', department: 'Product', location: 'Mumbai HQ',
      manager: 'Aarti Deshmukh', joinDate: '2022-04-11', phone: '+91 98200 41042',
      bloodGroup: 'B+', dob: '1993-08-17', gender: 'Male', employmentType: 'Permanent',
      grade: 'M3', bank: 'HDFC Bank 4417', pan: 'ABKPT****J', uan: '1012****3388',
    },
  },
  {
    username: 'hr.manager',
    password: 'FlexiHR@2026',
    role: 'hr',
    profile: {
      id: 'FL1008', name: 'Aarti Deshmukh', email: 'aarti.deshmukh@flexiloans.com',
      designation: 'HR Business Partner', department: 'Human Resources', location: 'Mumbai HQ',
      manager: 'Rakesh Menon', joinDate: '2021-06-14', phone: '+91 98200 11008',
      bloodGroup: 'O+', dob: '1990-02-09', gender: 'Female', employmentType: 'Permanent',
      grade: 'M4', bank: 'ICICI Bank 8820', pan: 'AQWPD****L', uan: '1012****7741',
    },
  },
  {
    username: 'rohan.sharma',
    password: 'FlexiEmp@2026',
    role: 'employee',
    profile: {
      id: 'FL1009', name: 'Rohan Sharma', email: 'rohan.sharma@flexiloans.com',
      designation: 'Software Engineer', department: 'Engineering', location: 'Pune',
      manager: 'Arjun Shaikh', joinDate: '2023-09-04', phone: '+91 98200 31009',
      bloodGroup: 'A+', dob: '1996-11-23', gender: 'Male', employmentType: 'Permanent',
      grade: 'E2', bank: 'Axis Bank 5512', pan: 'BKLPS****M', uan: '1012****9903',
    },
  },
]

export function authenticate(username, password) {
  const u = String(username).trim().toLowerCase()
  const found = ACCOUNTS.find((a) => a.username === u)
  if (!found || found.password !== password) return null
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

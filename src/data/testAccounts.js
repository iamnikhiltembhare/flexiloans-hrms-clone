// Test-only logins. They exist only in the test environment (the API's
// /test/api routes, with their own data) and are shown on the sign-in page
// of test builds only (VITE_APP_ENV=test). Production builds never import
// this file's passwords, and the production API does not know these users.

import { BRAND } from '../lib/brand.js'

const profile = (id, name, designation, department, extra = {}) => ({
  id, name, email: name.toLowerCase().replace(/\s+/g, '.') + '@test.' + BRAND.emailDomain,
  designation, department, location: 'Mumbai HQ', manager: 'Test HR', joinDate: '2026-01-05',
  phone: '+91 90000 0' + id.slice(-4), bloodGroup: 'O+', dob: '1995-01-01', gender: 'Not specified',
  employmentType: 'Test account', grade: 'T1', bank: 'Test Bank 0000', pan: 'TESTP****T', uan: '0000****0000',
  ...extra,
})

export const TEST_ACCOUNTS = [
  { username: 'test.employee', role: 'employee', profile: profile('FL9001', 'Test Employee', 'QA Engineer', 'Engineering') },
  { username: 'test.hr', role: 'hr', profile: profile('FL9002', 'Test HR', 'HR Business Partner (Test)', 'Human Resources') },
  { username: 'test.admin', role: 'super_admin', profile: profile('FL9003', 'Test Admin', 'System Administrator (Test)', 'IT & Systems', { manager: 'Not applicable' }) },
]

export const TEST_PASSWORDS = {
  'test.employee': 'TestEmp@2026',
  'test.hr': 'TestHR@2026',
  'test.admin': 'TestAdmin@2026',
}

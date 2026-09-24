import { BRAND } from '../lib/brand.js'

// Mock dataset for the FlexiLoans HRMS clone. No backend required.

export const currentUser = {
  id: 'FL0001',
  name: 'System Administrator',
  username: 'admin',
  email: 'admin@' + BRAND.emailDomain,
  designation: 'System Administrator',
  department: 'IT & Systems',
  location: 'Mumbai HQ',
  manager: 'Aarti Deshmukh',
  joinDate: '2022-04-11',
  role: 'Admin',
  phone: '+91 98200 41042',
  bloodGroup: 'B+',
  dob: '1993-08-17',
  gender: 'Male',
  employmentType: 'Permanent',
  grade: 'M3',
  bank: 'HDFC Bank 4417',
  pan: 'ABKPT****J',
  uan: '1012****3388',
}

const firstNames = ['Aarti','Rohan','Sneha','Imran','Priya','Karthik','Meera','Vikram','Ananya','Rahul','Divya','Sameer','Nikita','Arjun','Farah','Deepak','Ishita','Manish','Pooja','Tanmay','Ritu','Suresh','Neha','Gaurav','Shruti','Aditya','Kavya','Nilesh','Sanjana','Harsh']
const lastNames = ['Deshmukh','Sharma','Iyer','Shaikh','Nair','Reddy','Kulkarni','Singh','Bose','Menon','Patel','Joshi','Rane','Malhotra','Khan','Chawla','Verma','Pillai','Gupta','Desai']
export const departments = ['Product','Engineering','Credit & Risk','Sales','Collections','Operations','Finance','Human Resources','Marketing','Legal & Compliance']
const designations = {
  Product: ['Product Manager','Senior Product Manager','Associate Product Manager','Product Designer'],
  Engineering: ['Software Engineer','Senior Software Engineer','Engineering Manager','QA Engineer','DevOps Engineer'],
  'Credit & Risk': ['Credit Analyst','Risk Manager','Underwriter','Policy Lead'],
  Sales: ['Relationship Manager','Area Sales Manager','Regional Head','Inside Sales Executive'],
  Collections: ['Collections Executive','Collections Manager','Recovery Lead'],
  Operations: ['Operations Executive','Operations Manager','Process Analyst'],
  Finance: ['Accounts Executive','Financial Analyst','Finance Controller'],
  'Human Resources': ['HR Executive','HR Business Partner','Talent Acquisition Lead'],
  Marketing: ['Marketing Executive','Brand Manager','Performance Marketer'],
  'Legal & Compliance': ['Compliance Officer','Legal Counsel','AML Analyst'],
}
export const locations = ['Mumbai HQ','Delhi NCR','Bengaluru','Pune','Chennai','Hyderabad','Remote']

function seeded(i) { return (Math.sin(i * 12.9898) * 43758.5453) % 1 }
function pick(arr, i) { return arr[Math.floor(Math.abs(seeded(i)) * arr.length) % arr.length] }

export const employees = Array.from({ length: 64 }, (_, i) => {
  const dept = pick(departments, i + 3)
  const first = pick(firstNames, i + 1)
  const last = pick(lastNames, i + 7)
  return {
    id: 'FL' + (1001 + i),
    name: first + ' ' + last,
    email: first.toLowerCase() + '.' + last.toLowerCase() + '@' + BRAND.emailDomain,
    phone: '+91 9' + String(80000000 + Math.floor(Math.abs(seeded(i + 11)) * 9999999)).slice(0, 9),
    department: dept,
    designation: pick(designations[dept], i + 5),
    location: pick(locations, i + 13),
    joinDate: '20' + (19 + (i % 7)) + '-' + String((i % 12) + 1).padStart(2, '0') + '-' + String((i % 27) + 1).padStart(2, '0'),
    status: i % 17 === 0 ? 'On Notice' : i % 23 === 0 ? 'Probation' : 'Active',
    manager: pick(firstNames, i + 21) + ' ' + pick(lastNames, i + 29),
    experience: (2 + (i % 12)) + ' yrs',
    gender: i % 3 === 0 ? 'Female' : 'Male',
    employmentType: i % 11 === 0 ? 'Contract' : 'Permanent',
  }
})

export const attendanceSummary = {
  present: 21, absent: 1, leave: 2, halfDay: 1, wfh: 4,
  avgHours: '8h 42m', lateMarks: 2, overtime: '6h 15m',
}

export const attendanceLog = Array.from({ length: 22 }, (_, i) => {
  const day = 22 - i
  const weekday = new Date(2026, 8, day).getDay()
  const isWeekend = weekday === 0 || weekday === 6
  const statuses = ['Present','Present','Present','WFH','Present','Late','Present','Leave']
  const status = isWeekend ? 'Weekend' : statuses[i % statuses.length]
  const off = status === 'Weekend' || status === 'Leave'
  return {
    date: '2026-09-' + String(day).padStart(2, '0'),
    day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][weekday],
    checkIn: off ? '--' : status === 'Late' ? '10:24 AM' : '09:3' + (i % 9) + ' AM',
    checkOut: off ? '--' : '06:5' + (i % 9) + ' PM',
    hours: off ? '--' : (8 + (i % 2)) + 'h ' + (10 + (i % 40)) + 'm',
    status,
  }
})

export const leaveBalances = [
  { type: 'Privilege Leave', code: 'PL', granted: 21, used: 7, color: '#00B4D8' },
  { type: 'Casual Or Sick Leave', code: 'CSL', granted: 7, used: 1, color: '#16A34A' },
  { type: 'Comp - Off', code: 'CO', granted: 3, used: 3, color: '#7C3AED' },
  { type: 'Restricted Holiday', code: 'RH', granted: 1, used: 0, color: '#D97706' },
  { type: 'Paternity Leave', code: 'PTL', granted: 10, used: 0, color: '#2563EB' },
  { type: 'Bereavement Leave', code: 'BL', granted: 7, used: 0, color: '#64748B' },
  { type: 'Leave Without Pay', code: 'LWP', granted: 30, used: 0, color: '#DC2626' },
].map((l) => ({ ...l, total: l.granted, balance: l.granted - l.used }))


export const leaveRequests = [
  { id: 'LV-2041', employee: 'Rohan Sharma', empId: 'FL1009', type: 'Casual Leave', from: '2026-09-24', to: '2026-09-25', days: 2, reason: 'Family function', status: 'Pending', appliedOn: '2026-09-18' },
  { id: 'LV-2040', employee: 'Sneha Iyer', empId: 'FL1015', type: 'Sick Leave', from: '2026-09-22', to: '2026-09-22', days: 1, reason: 'Fever', status: 'Pending', appliedOn: '2026-09-21' },
  { id: 'LV-2039', employee: 'Imran Shaikh', empId: 'FL1022', type: 'Earned Leave', from: '2026-10-02', to: '2026-10-08', days: 5, reason: 'Vacation - Goa', status: 'Pending', appliedOn: '2026-09-15' },
  { id: 'LV-2038', employee: 'Priya Nair', empId: 'FL1031', type: 'Casual Leave', from: '2026-09-12', to: '2026-09-12', days: 1, reason: 'Personal work', status: 'Approved', appliedOn: '2026-09-09' },
  { id: 'LV-2037', employee: 'Karthik Reddy', empId: 'FL1044', type: 'Comp Off', from: '2026-09-08', to: '2026-09-08', days: 1, reason: 'Weekend release support', status: 'Approved', appliedOn: '2026-09-05' },
  { id: 'LV-2036', employee: 'Meera Kulkarni', empId: 'FL1050', type: 'Sick Leave', from: '2026-09-01', to: '2026-09-03', days: 3, reason: 'Medical', status: 'Rejected', appliedOn: '2026-08-30' },
  { id: 'LV-2035', employee: 'Vikram Singh', empId: 'FL1058', type: 'Earned Leave', from: '2026-08-18', to: '2026-08-22', days: 5, reason: 'Wedding', status: 'Approved', appliedOn: '2026-08-01' },
]

export const holidays = [
  { date: '2026-10-02', name: 'Gandhi Jayanti', day: 'Friday', type: 'National' },
  { date: '2026-10-20', name: 'Dussehra', day: 'Tuesday', type: 'Festival' },
  { date: '2026-11-08', name: 'Diwali (Laxmi Pujan)', day: 'Sunday', type: 'Festival' },
  { date: '2026-11-09', name: 'Diwali (Balipratipada)', day: 'Monday', type: 'Festival' },
  { date: '2026-12-25', name: 'Christmas', day: 'Friday', type: 'National' },
]

export const payslips = [
  { month: 'September 2026', gross: 185000, deductions: 32400, net: 152600, status: 'Processing', date: '2026-09-30' },
  { month: 'August 2026', gross: 185000, deductions: 32400, net: 152600, status: 'Paid', date: '2026-08-31' },
  { month: 'July 2026', gross: 185000, deductions: 32400, net: 152600, status: 'Paid', date: '2026-07-31' },
  { month: 'June 2026', gross: 185000, deductions: 34900, net: 150100, status: 'Paid', date: '2026-06-30' },
  { month: 'May 2026', gross: 178000, deductions: 31100, net: 146900, status: 'Paid', date: '2026-05-31' },
  { month: 'April 2026', gross: 178000, deductions: 31100, net: 146900, status: 'Paid', date: '2026-04-30' },
]

export const salaryBreakup = {
  earnings: [
    { head: 'Basic Salary', monthly: 74000, annual: 888000 },
    { head: 'House Rent Allowance', monthly: 37000, annual: 444000 },
    { head: 'Special Allowance', monthly: 58400, annual: 700800 },
    { head: 'Conveyance', monthly: 1600, annual: 19200 },
    { head: 'Medical Allowance', monthly: 1250, annual: 15000 },
    { head: 'LTA', monthly: 12750, annual: 153000 },
  ],
  deductions: [
    { head: 'Provident Fund (Employee)', monthly: 1800, annual: 21600 },
    { head: 'Professional Tax', monthly: 200, annual: 2400 },
    { head: 'Income Tax (TDS)', monthly: 30150, annual: 361800 },
    { head: 'Group Health Insurance', monthly: 250, annual: 3000 },
  ],
}

export const documents = [
  { name: 'Offer Letter.pdf', category: 'Onboarding', size: '248 KB', uploaded: '2022-04-05', status: 'Verified' },
  { name: 'Appointment Letter.pdf', category: 'Onboarding', size: '312 KB', uploaded: '2022-04-11', status: 'Verified' },
  { name: 'PAN Card.pdf', category: 'KYC', size: '96 KB', uploaded: '2022-04-11', status: 'Verified' },
  { name: 'Aadhaar Card.pdf', category: 'KYC', size: '141 KB', uploaded: '2022-04-11', status: 'Verified' },
  { name: 'Form 16 FY 2025-26.pdf', category: 'Tax', size: '410 KB', uploaded: '2026-06-14', status: 'Verified' },
  { name: 'Appraisal Letter 2026.pdf', category: 'Compensation', size: '187 KB', uploaded: '2026-04-02', status: 'Verified' },
  { name: 'Address Proof.pdf', category: 'KYC', size: '223 KB', uploaded: '2026-08-19', status: 'Pending' },
  { name: 'Insurance Nomination Form.pdf', category: 'Benefits', size: '77 KB', uploaded: '2026-09-02', status: 'Pending' },
]

export const announcements = [
  { id: 1, title: 'Diwali 2026 holiday calendar published', body: 'The revised holiday calendar for Q3 FY27 is now live. Two days are marked for Diwali - 8 and 9 November. Regional offices may opt for local substitutions with HRBP approval.', author: 'Human Resources', date: '2026-09-19', tag: 'Policy', pinned: true },
  { id: 2, title: 'Mid-year appraisal window opens 1 October', body: 'Self-assessments must be submitted by 12 October. Manager reviews close 24 October. Calibration sessions run through the first week of November.', author: 'People Team', date: '2026-09-16', tag: 'Performance', pinned: true },
  { id: 3, title: 'New medical insurance partner from 1 November', body: 'Coverage moves to a 7.5 lakh family floater with day-care procedures included. Nomination forms are due by 20 October.', author: 'Benefits Desk', date: '2026-09-11', tag: 'Benefits', pinned: false },
  { id: 4, title: 'Quarterly townhall - 30 September, 4:00 PM', body: 'Leadership will cover H1 performance, the SME lending roadmap and the new Mumbai office fit-out. Joining link goes out a day prior.', author: 'Internal Comms', date: '2026-09-08', tag: 'Event', pinned: false },
  { id: 5, title: 'Reminder: complete POSH refresher training', body: 'Mandatory for all employees. The module takes about 25 minutes and closes on 30 September.', author: 'Compliance', date: '2026-09-02', tag: 'Compliance', pinned: false },
]

export const openings = [
  { id: 'REQ-311', role: 'Senior Software Engineer - Platform', dept: 'Engineering', location: 'Mumbai HQ', type: 'Permanent', applicants: 48, stage: 'Interviewing', owner: 'Ishita Verma', posted: '2026-08-22', priority: 'High' },
  { id: 'REQ-309', role: 'Credit Analyst', dept: 'Credit & Risk', location: 'Bengaluru', type: 'Permanent', applicants: 27, stage: 'Screening', owner: 'Manish Pillai', posted: '2026-08-30', priority: 'Medium' },
  { id: 'REQ-307', role: 'Area Sales Manager', dept: 'Sales', location: 'Delhi NCR', type: 'Permanent', applicants: 61, stage: 'Offer', owner: 'Pooja Gupta', posted: '2026-07-18', priority: 'High' },
  { id: 'REQ-305', role: 'Collections Executive (x4)', dept: 'Collections', location: 'Pune', type: 'Contract', applicants: 93, stage: 'Interviewing', owner: 'Tanmay Desai', posted: '2026-08-05', priority: 'Medium' },
  { id: 'REQ-302', role: 'Brand Manager', dept: 'Marketing', location: 'Mumbai HQ', type: 'Permanent', applicants: 19, stage: 'Sourcing', owner: 'Ritu Chawla', posted: '2026-09-09', priority: 'Low' },
  { id: 'REQ-298', role: 'Compliance Officer', dept: 'Legal & Compliance', location: 'Mumbai HQ', type: 'Permanent', applicants: 12, stage: 'Screening', owner: 'Suresh Rane', posted: '2026-09-12', priority: 'High' },
]

export const candidates = [
  { name: 'Aditya Malhotra', role: 'Senior Software Engineer - Platform', stage: 'Final Round', rating: 4.5, source: 'Referral', applied: '2026-09-02' },
  { name: 'Kavya Menon', role: 'Credit Analyst', stage: 'Tech Screen', rating: 4.0, source: 'Naukri', applied: '2026-09-07' },
  { name: 'Nilesh Bose', role: 'Area Sales Manager', stage: 'Offer Rolled', rating: 4.8, source: 'LinkedIn', applied: '2026-08-11' },
  { name: 'Sanjana Khan', role: 'Brand Manager', stage: 'HR Round', rating: 3.9, source: 'Careers Page', applied: '2026-09-14' },
  { name: 'Harsh Joshi', role: 'Collections Executive (x4)', stage: 'Shortlisted', rating: 3.6, source: 'Walk-in', applied: '2026-09-16' },
]

export const goals = [
  { title: 'Ship merchant cash-advance journey v2', weight: 30, progress: 78, status: 'On Track', due: '2026-12-15' },
  { title: 'Reduce loan application drop-off to under 18%', weight: 25, progress: 54, status: 'At Risk', due: '2026-11-30' },
  { title: 'Launch partner API self-serve sandbox', weight: 20, progress: 91, status: 'On Track', due: '2026-10-20' },
  { title: 'Mentor two APMs through their first release', weight: 15, progress: 65, status: 'On Track', due: '2026-12-31' },
  { title: 'Complete advanced credit-risk certification', weight: 10, progress: 40, status: 'Behind', due: '2026-12-31' },
]

export const competencies = [
  { name: 'Customer Focus', self: 4.5, manager: 4.2 },
  { name: 'Execution', self: 4.2, manager: 4.4 },
  { name: 'Collaboration', self: 4.0, manager: 4.1 },
  { name: 'Ownership', self: 4.6, manager: 4.3 },
  { name: 'Communication', self: 3.8, manager: 4.0 },
]

export const tickets = [
  { id: 'HD-8841', subject: 'Payslip for August not downloadable', category: 'Payroll', priority: 'High', status: 'Open', raisedBy: 'Rohan Sharma', assignee: 'Payroll Desk', created: '2026-09-19', sla: '4h left' },
  { id: 'HD-8836', subject: 'Access request - Tableau reporting workspace', category: 'IT', priority: 'Medium', status: 'In Progress', raisedBy: 'Sneha Iyer', assignee: 'IT Helpdesk', created: '2026-09-17', sla: '1d left' },
  { id: 'HD-8829', subject: 'Update emergency contact details', category: 'HR Records', priority: 'Low', status: 'Resolved', raisedBy: 'Imran Shaikh', assignee: 'HR Ops', created: '2026-09-14', sla: 'Met' },
  { id: 'HD-8822', subject: 'Reimbursement pending for client travel', category: 'Finance', priority: 'High', status: 'In Progress', raisedBy: 'Vikram Singh', assignee: 'Finance Desk', created: '2026-09-12', sla: 'Breached' },
  { id: 'HD-8815', subject: 'Laptop replacement request', category: 'IT', priority: 'Medium', status: 'Open', raisedBy: 'Priya Nair', assignee: 'IT Helpdesk', created: '2026-09-10', sla: '2d left' },
  { id: 'HD-8801', subject: 'Query on new insurance coverage limits', category: 'Benefits', priority: 'Low', status: 'Resolved', raisedBy: 'Meera Kulkarni', assignee: 'Benefits Desk', created: '2026-09-04', sla: 'Met' },
]

export const headcountTrend = [
  { month: 'Apr', headcount: 512, joiners: 18, exits: 9 },
  { month: 'May', headcount: 524, joiners: 21, exits: 9 },
  { month: 'Jun', headcount: 531, joiners: 16, exits: 9 },
  { month: 'Jul', headcount: 545, joiners: 24, exits: 10 },
  { month: 'Aug', headcount: 556, joiners: 19, exits: 8 },
  { month: 'Sep', headcount: 568, joiners: 22, exits: 10 },
]

export const attendanceTrend = [
  { day: 'Mon', present: 498, wfh: 46, absent: 24 },
  { day: 'Tue', present: 512, wfh: 38, absent: 18 },
  { day: 'Wed', present: 505, wfh: 44, absent: 19 },
  { day: 'Thu', present: 489, wfh: 57, absent: 22 },
  { day: 'Fri', present: 441, wfh: 98, absent: 29 },
]

export const deptDistribution = departments.map((d) => ({
  name: d,
  value: employees.filter((e) => e.department === d).length,
})).filter((d) => d.value > 0)

export const birthdays = [
  { name: 'Priya Nair', date: 'Sep 22', dept: 'Operations' },
  { name: 'Karthik Reddy', date: 'Sep 24', dept: 'Engineering' },
  { name: 'Divya Patel', date: 'Sep 27', dept: 'Finance' },
]

export const anniversaries = [
  { name: 'Aarti Deshmukh', years: 5, date: 'Sep 23' },
  { name: 'Sameer Joshi', years: 3, date: 'Sep 25' },
  { name: 'Neha Verma', years: 1, date: 'Sep 29' },
]

export const pendingApprovals = [
  { type: 'Leave', detail: '3 leave requests awaiting your action', count: 3, to: '/leave' },
  { type: 'Attendance', detail: '2 regularisation requests', count: 2, to: '/attendance' },
  { type: 'Reimbursement', detail: '4 expense claims pending', count: 4, to: '/helpdesk' },
  { type: 'Offer approval', detail: '1 offer awaiting sign-off', count: 1, to: '/recruitment' },
]

export const INR = (n) => '₹' + Number(n).toLocaleString('en-IN')

// --- Super Admin / system administration data -----------------------------

export const systemHealth = [
  { name: 'Web application', status: 'Operational', uptime: '99.98%', latency: '182 ms' },
  { name: 'Payroll engine', status: 'Operational', uptime: '99.95%', latency: '240 ms' },
  { name: 'Attendance sync (biometric)', status: 'Degraded', uptime: '98.20%', latency: '1.4 s' },
  { name: 'Email and notifications', status: 'Operational', uptime: '99.99%', latency: '96 ms' },
  { name: 'Document vault (S3)', status: 'Operational', uptime: '100%', latency: '74 ms' },
  { name: 'Single sign-on (Azure AD)', status: 'Operational', uptime: '99.97%', latency: '156 ms' },
]

export const roleMatrix = [
  { role: 'Super Admin', users: 3, self: true, people: true, hiring: true, desk: true, reports: true, settings: true, system: true },
  { role: 'HR Professional', users: 11, self: true, people: true, hiring: true, desk: true, reports: true, settings: false, system: false },
  { role: 'Employee', users: 554, self: true, people: false, hiring: false, desk: false, reports: false, settings: false, system: false },
]

export const auditLog = [
  { id: 'AU-9912', actor: 'System Administrator', action: 'Role changed', target: 'FL1118 - Employee to HR Professional', ip: '10.22.4.18', at: '2026-09-22 09:12' },
  { id: 'AU-9911', actor: 'Aarti Deshmukh', action: 'Leave approved', target: 'LV-2038 - Priya Nair', ip: '10.22.4.51', at: '2026-09-22 08:47' },
  { id: 'AU-9910', actor: 'System', action: 'Payroll run started', target: 'September 2026 cycle', ip: 'scheduler', at: '2026-09-22 02:00' },
  { id: 'AU-9909', actor: 'System Administrator', action: 'Settings updated', target: 'WFH allowance 8 to 10 days', ip: '10.22.4.18', at: '2026-09-21 18:20' },
  { id: 'AU-9908', actor: 'Manish Pillai', action: 'Requisition raised', target: 'REQ-309 - Credit Analyst', ip: '10.22.9.77', at: '2026-09-21 16:05' },
  { id: 'AU-9907', actor: 'Aarti Deshmukh', action: 'Employee added', target: 'FL1121 - Kavya Menon', ip: '10.22.4.51', at: '2026-09-21 14:33' },
  { id: 'AU-9906', actor: 'System', action: 'Failed sign-in (3 attempts)', target: 'unknown@' + BRAND.emailDomain, ip: '103.44.18.2', at: '2026-09-21 11:58' },
  { id: 'AU-9905', actor: 'Rakesh Menon', action: 'Report exported', target: 'Payroll register August 2026', ip: '10.22.4.9', at: '2026-09-21 10:14' },
]

export const loginActivity = [
  { day: 'Mon', logins: 486, failed: 7 },
  { day: 'Tue', logins: 502, failed: 4 },
  { day: 'Wed', logins: 497, failed: 9 },
  { day: 'Thu', logins: 511, failed: 3 },
  { day: 'Fri', logins: 463, failed: 6 },
]

export const integrations = [
  { name: 'Azure Active Directory', category: 'Identity', status: 'Connected', lastSync: '2026-09-22 09:00' },
  { name: 'Darwinbox payroll export', category: 'Payroll', status: 'Connected', lastSync: '2026-09-22 02:15' },
  { name: 'Biometric devices (12 sites)', category: 'Attendance', status: 'Partial', lastSync: '2026-09-22 07:40' },
  { name: 'Naukri / LinkedIn job sync', category: 'Recruitment', status: 'Connected', lastSync: '2026-09-21 23:30' },
  { name: 'Group insurance portal', category: 'Benefits', status: 'Disconnected', lastSync: '2026-09-14 18:02' },
]

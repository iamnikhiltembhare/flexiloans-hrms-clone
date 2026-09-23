// Engage feed, Document Center and Request Hub seed data.
// Every post, name and figure here is invented for the demo.

export const feedGroups = ['All Groups', 'Events', 'Announcements', 'Learning', 'Wellness', 'Tech Guild']
export const feedLocations = ['All Locations', 'Mumbai HQ', 'Delhi NCR', 'Bengaluru', 'Pune', 'Remote']
export const feedDepartments = ['All Departments', 'Product', 'Engineering', 'Sales', 'Human Resources', 'Operations']

export const posts = [
  {
    id: 'P-104',
    author: 'Events Committee', avatarName: 'Events Committee',
    group: 'Events', location: 'Mumbai HQ', department: 'Human Resources',
    kind: 'Post', time: '2 hours ago',
    body: 'Congratulations to everyone completing a work anniversary this month. Cake in the 4th floor pantry at 4pm - come say hello.',
    highlight: 'Congratulations!',
    reactions: 24, comments: 6, reacted: false,
  },
  {
    id: 'P-103',
    author: 'Learning & Development', avatarName: 'Learning Development',
    group: 'Learning', location: 'Remote', department: 'Human Resources',
    kind: 'Post', time: '6 hours ago',
    body: 'New on the learning portal: a four-part series on credit risk fundamentals. Roughly 40 minutes each, and it counts towards your annual learning hours.',
    reactions: 41, comments: 9, reacted: true,
  },
  {
    id: 'P-102',
    author: 'Tech Guild', avatarName: 'Tech Guild',
    group: 'Tech Guild', location: 'Pune', department: 'Engineering',
    kind: 'Post', time: 'Yesterday',
    body: 'Guild session this Thursday: how we cut the loan application journey from nine screens to five. Demo, then questions. Everyone welcome, not just engineers.',
    reactions: 18, comments: 4, reacted: false,
  },
  {
    id: 'P-101',
    author: 'Wellness Desk', avatarName: 'Wellness Desk',
    group: 'Wellness', location: 'All Locations', department: 'Human Resources',
    kind: 'Post', time: '2 days ago',
    body: 'Free annual health check-ups open for booking until 15 October. Slots are limited at the Mumbai and Bengaluru centres, so book early.',
    reactions: 63, comments: 12, reacted: false,
  },
  {
    id: 'P-100',
    author: 'Internal Comms', avatarName: 'Internal Comms',
    group: 'Announcements', location: 'Mumbai HQ', department: 'Human Resources',
    kind: 'Post', time: '3 days ago',
    body: 'The quarterly townhall recording and slides are now on the intranet for anyone who could not join live.',
    reactions: 12, comments: 2, reacted: false,
  },
]

export const seedComments = {
  'P-104': [
    { author: 'Priya Nair', time: '1 hour ago', body: 'See you there!' },
    { author: 'Karthik Reddy', time: '45 min ago', body: 'Saving room for cake.' },
  ],
  'P-103': [{ author: 'Sneha Iyer', time: '4 hours ago', body: 'Finished part one, genuinely useful.' }],
}

// --- Document Center -------------------------------------------------------

export const documentCategories = [
  { name: 'Payslips', count: 18, icon: 'payslip', note: 'Monthly salary statements' },
  { name: 'Form 16', count: 3, icon: 'tax', note: 'Annual tax certificates' },
  { name: 'Company Policies', count: 24, icon: 'policy', note: 'Leave, travel, POSH, IT use' },
  { name: 'Forms', count: 11, icon: 'form', note: 'Reimbursement, nomination, declaration' },
]

export const letterTypes = [
  'Employment Verification Letter',
  'Salary Certificate',
  'Address Proof Letter',
  'Visa Covering Letter',
  'No Objection Certificate',
]

export const letterRequests = [
  { id: 'LTR-2041', type: 'Employment Verification Letter', raised: '2026-09-12', status: 'Closed', remarks: 'Issued by HR Ops' },
  { id: 'LTR-2038', type: 'Salary Certificate', raised: '2026-08-28', status: 'Closed', remarks: 'Collected in person' },
]

// --- Request Hub -----------------------------------------------------------

export const requestTypes = [
  { name: 'Work From Home', category: 'Attendance', sla: '1 working day', desc: 'Request to work remotely for a defined period.' },
  { name: 'Shift Change', category: 'Attendance', sla: '2 working days', desc: 'Move to a different shift window.' },
  { name: 'Asset Request', category: 'IT', sla: '3 working days', desc: 'Laptop, monitor, headset or accessories.' },
  { name: 'Travel Advance', category: 'Finance', sla: '2 working days', desc: 'Advance against approved business travel.' },
  { name: 'Reimbursement Claim', category: 'Finance', sla: '5 working days', desc: 'Travel, internet or client entertainment.' },
  { name: 'Name or Address Change', category: 'HR Records', sla: '3 working days', desc: 'Update your official employee record.' },
  { name: 'Transfer Request', category: 'HR Records', sla: '10 working days', desc: 'Move to another location or team.' },
  { name: 'Training Nomination', category: 'Learning', sla: '5 working days', desc: 'Nominate yourself for a certification.' },
]

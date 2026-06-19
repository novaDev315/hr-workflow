export const people = [
  { name: 'Fatima Al Suwaidi', role: 'Senior Accountant', team: 'Finance', email: 'fatima@rakss.ae' },
  { name: 'Omar Rashid', role: 'Shift Supervisor', team: 'Operations', email: 'omar@rakss.ae' },
  { name: 'Lina Khaled', role: 'Product Designer', team: 'Design', email: 'lina@rakss.ae' },
  { name: 'Maya Chen', role: 'HR Business Partner', team: 'People', email: 'maya@rakss.ae' },
  { name: 'John Smith', role: 'Frontend Engineer', team: 'Technology', email: 'john@rakss.ae' },
  { name: 'Sara Ibrahim', role: 'Brand Manager', team: 'Marketing', email: 'sara@rakss.ae' },
]

export const overviewMetrics = [
  { label: 'Active employees', value: '148', detail: 'Across 6 departments' },
  { label: 'Open approvals', value: '12', detail: 'Leave, payroll, policy' },
  { label: 'Monthly payroll', value: 'AED 1.84M', detail: 'Projected net pay' },
  { label: 'Published policies', value: '26', detail: '6 refreshed this quarter' },
]

export const employeeMetrics = [
  { label: 'Employees', value: '148', detail: 'Current active roster' },
  { label: 'New starters', value: '4', detail: 'Joining this month' },
  { label: 'Manager seats', value: '24', detail: 'Across 12 teams' },
  { label: 'Access gaps', value: '6', detail: 'Need login or role mapping' },
]

export const attendanceMetrics = [
  { label: 'Checked in', value: '118', detail: '87% of today’s planned roster' },
  { label: 'Late arrivals', value: '7', detail: 'Most from Logistics' },
  { label: 'Location issues', value: '4', detail: 'Outside approved radius' },
  { label: 'Shift completion', value: '94%', detail: 'Projected from active locations' },
]

export const leaveMetrics = [
  { label: 'Pending requests', value: '9', detail: '3 overlapping Engineering dates' },
  { label: 'Balance issues', value: '2', detail: 'Insufficient annual leave days' },
  { label: 'Managers due today', value: '5', detail: 'Awaiting final approval' },
  { label: 'Policy types', value: '12', detail: 'Annual, sick, emergency, study' },
]

export const payrollMetrics = [
  { label: 'Net pay', value: 'AED 1.84M', detail: 'Projected for April cycle' },
  { label: 'Employees paid', value: '148', detail: '2 records held for review' },
  { label: 'Variance', value: '+6.4%', detail: 'Driven by overtime in Ops' },
  { label: 'Payout date', value: 'Apr 28', detail: 'Bank file not yet exported' },
]

export const recruitmentMetrics = [
  { label: 'Open roles', value: '12', detail: 'Across Product, Ops, and Finance' },
  { label: 'Interviews this week', value: '18', detail: 'Panels and recruiter screens' },
  { label: 'Offers in flight', value: '3', detail: 'Waiting for candidate response' },
  { label: 'Avg. cycle time', value: '24 days', detail: 'Across all active roles' },
]

export const reportMetrics = [
  { label: 'Headcount', value: '148', detail: 'Net +6 since last month' },
  { label: 'Attrition risk', value: '7', detail: 'Signals from attendance and manager notes' },
  { label: 'Payroll weight', value: 'AED 1.84M', detail: 'April net pay projection' },
  { label: 'Policy readiness', value: '96%', detail: 'Mandatory acknowledgements complete' },
]

export const policyMetrics = [
  { label: 'Published docs', value: '26', detail: '6 updated this quarter' },
  { label: 'Unread acknowledgements', value: '18', detail: 'Mostly remote work policy' },
  { label: 'Drafts in review', value: '4', detail: '2 need legal approval' },
  { label: 'Completion rate', value: '96%', detail: 'For mandatory policies' },
]

export const openWork = [
  { title: 'Sara Ibrahim requested annual leave', subtitle: 'Apr 18 to Apr 22 · Engineering', meta: '5 days', badge: 'Review', tone: 'warning' as const },
  { title: 'Ahmed Nasser joined the Dubai office', subtitle: 'Senior Accountant · onboarding incomplete', meta: 'Today', badge: 'Follow up', tone: 'info' as const },
  { title: 'Remote work policy v2.4 published', subtitle: 'Need 18 more employee acknowledgements', meta: 'Governance', badge: 'Pending', tone: 'neutral' as const },
]

export const employeeRecords = [
  ['Ahmed Nasser', 'Finance', 'Apr 14', 'Pending login'],
  ['Dina Farouk', 'People', 'Apr 15', 'Manager enabled'],
  ['Mariam Chen', 'Technology', 'Apr 22', 'Account draft'],
  ['Haroon Tariq', 'Operations', 'Apr 25', 'No access yet'],
]

export const attendanceRows = [
  ['Omar Rashid', 'Dubai HQ', '08:58 AM', 'Morning'],
  ['Khalid Noor', 'Sharjah Warehouse', '09:17 AM', 'Warehouse'],
  ['Maria Santos', 'Remote Support', '08:49 AM', 'Remote'],
  ['Anika Bose', 'Abu Dhabi Retail', '09:22 AM', 'Retail'],
]

export const leaveRows = [
  ['Annual leave', 'All full-time staff', '5 days', 'Manager + HR'],
  ['Sick leave', 'All active staff', 'No', 'Manager notified'],
  ['Emergency leave', 'Case based', 'No', 'HR review'],
  ['Study leave', 'Approved programs only', 'No', 'People Ops'],
]

export const payrollRows = [
  ['Khalid Noor', 'Overtime correction', '+AED 1,220', 'Payroll'],
  ['Maya Chen', 'Allowance update', '+AED 540', 'People Ops'],
  ['Omar Rashid', 'Missing bank details', 'Hold', 'HR Admin'],
  ['Sara Ibrahim', 'Bonus payout', '+AED 3,100', 'Finance'],
]

export const reportRows = [
  ['Operations', '4', '3', 'Coverage healthy'],
  ['Technology', '2', '5', 'Hiring active'],
  ['Finance', '1', '1', 'Succession needed'],
  ['People & Admin', '0', '2', 'Policy rollout pending'],
]

export const policies = [
  { title: 'Remote Work Policy', detail: 'Location flexibility, device standards, and manager approvals.', version: 'v2.4', owner: 'People Ops' },
  { title: 'Attendance & Shift Guide', detail: 'Clock-in rules, geofence compliance, and overtime thresholds.', version: 'v1.9', owner: 'Operations HR' },
  { title: 'Travel & Expenses', detail: 'Business travel approvals, booking logic, and reimbursement timing.', version: 'v3.1', owner: 'Finance' },
  { title: 'Anti-Harassment Standard', detail: 'Reporting channels, escalation steps, and investigation handling.', version: 'v2.0', owner: 'Legal & People' },
  { title: 'Probation Framework', detail: 'Review milestones, coaching checkpoints, and conversion criteria.', version: 'v1.3', owner: 'Talent' },
  { title: 'Information Security', detail: 'Password rules, access hygiene, incident response, and device use.', version: 'v4.0', owner: 'Security' },
]

export const candidateStages = [
  { label: 'Screening', count: '12', cards: ['Theresa Webb', 'Maya Lim'] },
  { label: 'Challenge', count: '8', cards: ['Jenny Wilson', 'Omar Khan'] },
  { label: 'Interview', count: '5', cards: ['Cody Fisher', 'Ahmad Rafi'] },
  { label: 'Offer', count: '2', cards: ['Aisha Noor', 'Brandon Lee'] },
]

export const calendarNotes = ['Payroll cutoff', 'Leadership offsite', 'Policy reminder']

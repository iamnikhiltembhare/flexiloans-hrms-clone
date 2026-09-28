// Built-in understanding for the HR Assistant: turns a message into one tool
// call with keyword and pattern matching. Used when no language model is
// configured (and always in the offline demo). The same tools run either
// way, so permissions and confirmations behave identically.

import { PERMS } from '../../data/accounts.js'
import { TOOLS, runTool, findPeople, sensitiveTopic, SENSITIVE_REPLY } from './tools.js'
import { bestSentences } from './policies.js'

const DEPT_ALIASES = [
  [/\b(engineering|engineers?|tech(nology)?|developers?)\b/i, 'Engineering'],
  [/\bsales\b/i, 'Sales'], [/\bproduct\b/i, 'Product'], [/\b(credit|risk)\b/i, 'Credit & Risk'],
  [/\bcollections?\b/i, 'Collections'], [/\b(operations|ops)\b/i, 'Operations'], [/\bfinance\b/i, 'Finance'],
  [/\b(human resources|hr department|hr team)\b/i, 'Human Resources'], [/\bmarketing\b/i, 'Marketing'],
  [/\b(legal|compliance)\b/i, 'Legal & Compliance'],
]
const LOC_ALIASES = [
  [/\bmumbai\b/i, 'Mumbai HQ'], [/\b(delhi|ncr|gurgaon|noida)\b/i, 'Delhi NCR'], [/\b(bengaluru|bangalore)\b/i, 'Bengaluru'],
  [/\bpune\b/i, 'Pune'], [/\bchennai\b/i, 'Chennai'], [/\bhyderabad\b/i, 'Hyderabad'], [/\bremote\b/i, 'Remote'],
]
const findAlias = (list, text) => { for (const [re, v] of list) if (re.test(text)) return v; return undefined }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())

/** Dates in a message: ISO, "3 Oct", "October 3", "today", "tomorrow". */
function datesIn(text, today) {
  const [ty, tm, td] = today.split('-').map(Number)
  const out = []
  const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*'
  const re = new RegExp('(\\d{4}-\\d{2}-\\d{2})|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MON + '\\b|\\b' + MON + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|\\b(today|tomorrow)\\b', 'gi')
  let m
  while ((m = re.exec(text))) {
    if (m[1]) { out.push(m[1]); continue }
    if (m[6]) { const d = new Date(ty, tm - 1, td + (m[6].toLowerCase() === 'tomorrow' ? 1 : 0)); out.push(ymd(d)); continue }
    const day = Number(m[2] || m[5]); const mon = MONTHS.indexOf(String(m[3] || m[4]).toLowerCase())
    if (mon < 0 || day < 1 || day > 31) continue
    let y = ty
    if (mon < tm - 2) y += 1 // "3 Jan" in September means next January
    out.push(y + '-' + pad(mon + 1) + '-' + pad(day))
  }
  return out
}

const LEAVE_WORDS = /\b(privilege|earned|annual|casual|sick|comp[- ]?off|restricted|optional|paternity|bereavement|unpaid|without pay|lwp)(\s+(leave|holiday))?\b/
function leaveTypeIn(t) {
  const m = t.match(LEAVE_WORDS)?.[1]
  if (!m) return undefined
  if (/privilege|earned|annual/.test(m)) return 'Privilege Leave'
  if (/casual|sick/.test(m)) return 'Casual Or Sick Leave'
  if (/comp/.test(m)) return 'Comp - Off'
  if (/restricted|optional/.test(m)) return 'Restricted Holiday'
  if (/paternity/.test(m)) return 'Paternity Leave'
  if (/bereavement/.test(m)) return 'Bereavement Leave'
  return 'Leave Without Pay'
}

/** "September", "last month" or "2026-08" in a message, as YYYY-MM. */
function monthIn(text, today) {
  const iso = text.match(/\b(20\d\d-\d\d)\b/)?.[1]
  if (iso) return iso
  const [y, m] = today.split('-').map(Number)
  if (/last month|previous month/i.test(text)) { const d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) }
  const mi = MONTHS.findIndex((x) => new RegExp('\\b' + x + '[a-z]*\\b', 'i').test(text))
  if (mi >= 0) return (mi + 1 > m ? y - 1 : y) + '-' + pad(mi + 1)
  return undefined
}

const ID = (prefix) => new RegExp('\\b' + prefix + '-\\d+\\b', 'i')
const idIn = (text, prefix) => text.match(ID(prefix))?.[0]?.toUpperCase()

/** The person a message is about, after stripping command words. */
function subject(text, ctx) {
  const cleaned = text
    .replace(/[?.!,]/g, ' ')
    .replace(/\b(please|can you|could you|kindly|approve|reject|decline|deny|the|a|an|leave|leaves|request|requests|regularis\w*|regulariz\w*|attendance|for|of|from|to|by|his|her|their|my|me|show|find|who|is|what|details|detail|profile|about|tell|balance|manager|reporting|department|dept|and|in|on|with|pending|move|advance|candidate|next|stage|employee|employees)\b/gi, ' ')
    .replace(/'s\b/gi, ' ')
    .replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  const people = findPeople(ctx.state.employees, cleaned)
  if (people.length) return cleaned
  // Try each word on its own ("Priya" in "approve priya request").
  for (const w of cleaned.split(' ')) if (w.length > 2 && findPeople(ctx.state.employees, w).length) return w
  return cleaned
}

const has = (text, re) => re.test(text)

/**
 * Decide what a message means. Returns { tool, input } or { reply }.
 * `memory` carries the last list shown, so "approve the first one" works.
 */
export function parseIntent(raw, ctx, memory = {}) {
  const text = String(raw || '').trim()
  const t = text.toLowerCase()
  if (!t) return { reply: helpText(ctx) }

  const sensitive = sensitiveTopic(text)
  if (sensitive) return { reply: SENSITIVE_REPLY(sensitive), refused: true }

  if (/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(t) && t.split(' ').length <= 4) return { reply: 'Hello ' + ctx.actor.name.split(' ')[0] + '. ' + helpText(ctx) }
  if (/\b(help|what can you do|commands|examples)\b/.test(t)) return { reply: helpText(ctx) }

  const department = findAlias(DEPT_ALIASES, text)
  const location = findAlias(LOC_ALIASES, text)
  const decision = has(t, /\b(reject|decline|deny)\b/) ? 'reject' : has(t, /\bapprove\b/) ? 'approve' : null

  // "approve the first one" after a list
  const ordinal = t.match(/\b(first|second|third|1st|2nd|3rd|last)\b/)?.[1]
  const fromMemory = () => {
    const list = memory.pending || []
    if (!ordinal || !list.length) return null
    const i = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, last: list.length - 1 }[ordinal]
    return list[i]
  }

  // --- actions (always a proposal first) ---------------------------------
  const ticketId = idIn(text, 'HD')
  if (ticketId && has(t, /\b(approve|reject|resolve|close|start|pick up|reopen)\b/)) {
    const action = has(t, /\breject\b/) ? 'reject' : has(t, /\bapprove\b/) ? 'approve' : has(t, /\b(resolve|close)\b/) ? 'resolve' : has(t, /\breopen\b/) ? 'reopen' : 'start'
    return { tool: 'propose_ticket_update', input: { ticket_id: ticketId, action } }
  }
  if (decision && (has(t, /regulari[sz]/) || idIn(text, 'RG'))) {
    const who = idIn(text, 'RG') || fromMemory() || subject(text, ctx)
    return { tool: 'propose_regularisation_decision', input: { employee_or_request: who || '', decision } }
  }
  if (decision) {
    const who = idIn(text, 'LV') || fromMemory() || subject(text, ctx)
    if (!who) return { reply: 'Whose leave should I ' + decision + '? Give a name or a request id like LV-2041.' }
    return { tool: 'propose_leave_decision', input: { employee_or_request: who, decision } }
  }
  if (has(t, /\b(move|advance|progress)\b/) && has(t, /\b(candidate|stage|round)\b/)) {
    return { tool: 'propose_candidate_advance', input: { candidate: subject(text, ctx) || '' } }
  }
  // Leave application, possibly over several messages: dates first, then the
  // type and reason if they were not given. The draft lives in `memory`.
  const draft = memory.leaveDraft
  const wantsLeave = has(t, /\b(apply|take|book|request|need|want)\b.*\b(leave|off|day off|holiday)\b|\bleave\b.*\b(from|on|tomorrow|today)\b|\bday off\b/) && !has(t, /\b(pending|show|list|balance|approv|policy|how many|rules?)\w*/)
  // A follow-up answers the question we asked (type, reason or dates) unless
  // it is plainly a new question.
  const followUp = draft?.from && !has(t, /\b(cancel|stop|never ?mind)\b/) && !/^(what|how|who|when|where|why|show|list|is|are|can|do|does|create|raise|update|change|explain)\b/.test(t)
    && !has(t, /\b(balance|payslip|pay slip|holiday calendar|ticket|attendance|policy)\b/) && t.split(' ').length <= 15
    && (leaveTypeIn(t) || datesIn(text, ctx.today).length || (draft.type && !draft.reason))
  if (wantsLeave || followUp) {
    const dates = datesIn(text, ctx.today)
    const base = wantsLeave ? {} : (draft || {})
    const from = dates[0] || base.from
    if (!from) return { reply: 'Which dates? For example "apply for leave from 5 Oct to 7 Oct" or "leave tomorrow".', memory: { leaveDraft: {} } }
    const type = leaveTypeIn(t) || base.type
    let reason = text.match(/\b(?:because(?: of)?|due to|reason(?: is)?:?)\s*(.+)$/i)?.[1]
    if (reason && datesIn(reason, ctx.today).length) reason = reason.replace(/\b(from|on|to)\b.*$/i, '').trim() || undefined
    if (!reason && draft && !wantsLeave && base.type) reason = text.replace(/^(it'?s|reason is|because)\s+/i, '').trim()
    if (!reason && draft && !wantsLeave && type && !base.type) {
      const rest = text.replace(new RegExp(LEAVE_WORDS.source, 'gi'), '').replace(/^[\s,.-]+|[\s,.-]+$/g, '').replace(/^(leave|and|because|for)\s+/i, '')
      if (rest.split(' ').length >= 2) reason = rest
    }
    return { tool: 'propose_leave_application', input: { type, from, to: dates[1] || (dates[0] ? dates[0] : base.to) || from, reason: reason || base.reason },
      keep: { leaveDraft: { from, to: dates[1] || (dates[0] ? dates[0] : base.to) || from, type, reason: reason || base.reason } } }
  }

  // --- employee self-service ---------------------------------------------
  if (has(t, /\b(emergency contact|personal (mobile|number|phone)|my (mobile|phone) number)\b/) && has(t, /\b(update|change|set|new|replace|edit)\b/)) {
    const phone = text.match(/\+?\d[\d\s-]{8,15}\d/)?.[0]
    if (has(t, /emergency/)) {
      const name = text.match(/\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)?.[1]
      const rel = text.match(/\b(spouse|wife|husband|father|mother|brother|sister|son|daughter|friend|partner)\b/i)?.[1]
      if (!phone && !name) return { reply: 'Sure. What are the emergency contact\'s name, number and relationship? For example "update my emergency contact to Sunita Tembhare, +91 98330 22118, spouse".' }
      return { tool: 'propose_profile_update', input: { emergency_contact_name: name, emergency_contact_phone: phone, emergency_contact_relationship: rel && rel[0].toUpperCase() + rel.slice(1).toLowerCase() } }
    }
    if (!phone) return { reply: 'What is the new mobile number?' }
    return { tool: 'propose_profile_update', input: { personal_mobile: phone } }
  }
  if (has(t, /\b(address|name spelling|bank)\b/) && has(t, /\b(update|change)\b/)) {
    return { reply: 'Address and name changes need proof, so HR updates them. Say "create an HR records ticket to update my address" and I will prepare it, then upload the proof in the Document Center.' }
  }
  if (has(t, /\b(create|raise|open|log|file|submit)\b.*\b(ticket|request|complaint|query)\b|\bticket (for|about)\b/)) {
    const category = has(t, /\b(payroll|salary|payslip|pay slip|deduction|tds|tax)\b/) ? 'Payroll' : has(t, /\b(insurance|benefit|mediclaim|claim)\b/) ? 'Benefits'
      : has(t, /\b(laptop|vpn|email|password|access|it)\b/) ? 'IT' : has(t, /\b(reimburse|expense|finance|travel)\b/) ? 'Finance' : 'HR Records'
    const about = text.match(/\b(?:for|about|regarding|re:?)\s+(?:an?\s+|my\s+|the\s+)?(.+)$/i)?.[1]?.replace(/[.?!]+$/, '')
    const subject = about ? about[0].toUpperCase() + about.slice(1) : category + ' query'
    return { tool: 'propose_ticket', input: { category, subject, priority: has(t, /\burgent|asap|immediately\b/) ? 'High' : 'Medium' } }
  }
  if (has(t, /\b(why|explain|higher|lower|more|less|different|changed?)\b/) && has(t, /\b(salary|pay|payslip|pay slip|deduction|deductions|tds|tax|net)\b/)) {
    return { tool: 'explain_payslip', input: { month: monthIn(text, ctx.today) } }
  }
  if (has(t, /\b(pay ?slip|salary slip|payslips)\b/) || (has(t, /\b(salary|net pay|take home)\b/) && has(t, /\b(my|last|this month|download|see)\b/))) {
    return { tool: 'my_payslips', input: { month: monthIn(text, ctx.today) } }
  }
  if (has(t, /\bholidays?\b/) && !has(t, /\b(policy|restricted|optional).*(rule|how|apply)/)) {
    return { tool: 'holidays', input: { upcoming_only: has(t, /\b(next|upcoming|coming|remaining)\b/) || undefined, include_optional: has(t, /\b(optional|restricted|rh)\b/) || undefined, year: Number(text.match(/\b(20\d\d)\b/)?.[1]) || undefined } }
  }
  if (has(t, /\b(my )?(performance|appraisal|review|self[- ]?review|self[- ]?assessment|goals?)\b/) && !has(t, /\b(policy|cycle rules)\b/) && !has(t, /\bcode review\b/)) {
    return { tool: 'my_performance', input: {} }
  }
  if (has(t, /\b(enrol|enroll|sign me up|register)\b/) && has(t, /\b(course|training|in|for)\b/)) {
    const course = text.replace(/.*\b(enrol+|sign me up|register)\b\s*(me\s*)?(in|for|on|to)?\s*(the\s*)?/i, '').replace(/\b(course|training)\b/gi, '').trim()
    return { tool: 'propose_course_enrollment', input: { course } }
  }
  if (has(t, /\b(my )?(training|courses?|learning|skill gaps?|skills)\b/) && !has(t, /\bpolicy|sponsor|budget\b/)) return { tool: 'my_learning', input: {} }
  if (has(t, /\b(my onboarding|onboarding status|joining documents|my documents|document submission|documents? (pending|to submit))\b/) || (has(t, /onboarding/) && !ctx.actor.perms.includes(PERMS.HR_PEOPLE))) {
    return { tool: 'my_onboarding', input: {} }
  }

  if (has(t, /\bleaves?\b/) && has(t, /\b(left|remaining|balance|how many|available)\b/) && !has(t, /\b(policy|carry|encash|entitle\w*|allowed)\b/)) {
    const s = has(t, /\b(my|i|me)\b/) ? null : subject(text, ctx)
    return { tool: 'leave_balance', input: { employee: s && findPeople(ctx.state.employees, s).length ? s : undefined, type: leaveTypeIn(t) } }
  }
  if (has(t, /\b(policy|policies|handbook|rules?|allowed|entitle\w*|how (do|can|much|many days)|can i|am i|what happens|process for|insurance|benefits?|reimburse\w*|notice period|resign\w*|posh|maternity|paternity|dress code|wfh|work from home|carry forward|encash\w*|form 16|tax regime)\b/) && !has(t, /\b(my (leave )?balance|pending)\b/)) {
    return { tool: 'search_policies', input: { query: text } }
  }

  // --- reports and lookups -----------------------------------------------
  if (has(t, /onboarding/)) {
    const role = text.match(/\bfor (?:an? |the )?(?:new )?(.+?)(?:\s+(?:in|joining|starting|from)\b.*)?$/i)?.[1]?.replace(/\b(hire|joiner|employee)\b/gi, '').trim() || 'new joiner'
    return { tool: 'onboarding_checklist', input: { role, department } }
  }
  if (has(t, /\b(joined|joiners?|new hires?|joining)\b/)) {
    const joined = has(t, /last month/) ? 'last_month' : has(t, /this year|in \d{4}/) ? 'this_year' : has(t, /30 days|recent/) ? 'last_30_days' : 'this_month'
    return { tool: 'search_employees', input: { joined, department, location } }
  }
  if (has(t, /\b(absent|late|present|who is in|attendance today|in office|not in)\b/) && !has(t, /\breport\b|\bmonth\b/)) {
    return { tool: 'attendance_today', input: { department } }
  }
  if (has(t, /\battendance\b/)) {
    const month = has(t, /last month/) ? 'last_month' : 'this_month'
    const who = has(t, /\bmy\b/) ? ctx.actor.name : (() => { const s = subject(text, ctx); return s && findPeople(ctx.state.employees, s).length ? s : undefined })()
    return { tool: 'attendance_report', input: { department, month, employee: who } }
  }
  if (has(t, /\bbalance\b/)) {
    const s = has(t, /\bmy\b/) ? null : subject(text, ctx)
    return { tool: 'leave_balance', input: { employee: s && findPeople(ctx.state.employees, s).length ? s : undefined } }
  }
  if (has(t, /regulari[sz]/)) {
    return { reply: listRegularisations(ctx) }
  }
  if (has(t, /\bleave\b/)) {
    const status = has(t, /pending|awaiting|waiting/) ? 'Pending' : has(t, /approved/) ? 'Approved' : has(t, /rejected/) ? 'Rejected' : undefined
    const s = subject(text, ctx)
    return { tool: 'list_leave_requests', input: { status, department, employee: s && findPeople(ctx.state.employees, s).length ? s : undefined } }
  }
  if (has(t, /\b(pending|to ?do|tasks?|waiting|inbox|my approvals|what'?s up)\b/)) return { tool: 'pending_tasks', input: {} }
  if (has(t, /\btickets?\b|helpdesk/)) {
    return { tool: 'list_tickets', input: { awaiting_approval: has(t, /approv/) || undefined, status: has(t, /\bopen\b/) ? 'Open' : undefined, category: ['IT', 'Finance', 'Payroll', 'Benefits'].find((c) => new RegExp('\\b' + c + '\\b', 'i').test(text)) } }
  }
  if (has(t, /\b(open (positions|roles)|openings|vacanc\w*|requisitions?|jobs?)\b/)) return { tool: 'recruitment', input: { view: 'openings' } }
  if (has(t, /\bpipeline\b/)) return { tool: 'recruitment', input: { view: 'pipeline' } }
  if (has(t, /\bcandidates?\b|\binterview/)) {
    const role = text.match(/\bfor (?:the )?(.+)$/i)?.[1]
    return { tool: 'recruitment', input: { view: 'candidates', role } }
  }
  if (has(t, /\b(headcount|turnover|attrition|how many employees|strength)\b/)) {
    return { tool: 'headcount_report', input: { group_by: has(t, /location|city|office/) ? 'location' : has(t, /status/) ? 'status' : 'department' } }
  }
  if (has(t, /\bmy (manager|reporting manager|boss)\b/)) {
    const me = ctx.state.employees.find((e) => e.id === ctx.actor.id)
    return { reply: 'Your reporting manager is ' + ((me && me.manager) || ctx.actor.manager || 'not set') + '.' }
  }
  if (has(t, /\b(who is|details|profile|manager of|reporting to|tell me about|contact)\b/)) {
    const s = subject(text, ctx)
    if (has(t, /\breporting to\b|\breports to\b/) && s) return { tool: 'search_employees', input: { manager: s } }
    if (s) return { tool: 'get_employee', input: { name_or_id: s } }
  }
  if (has(t, /\b(employees?|people|staff|team|list|find|search|show)\b/) || department || location) {
    const q = has(t, /\bnamed?\b/) ? subject(text, ctx) : undefined
    const role = text.match(/\b(software engineers?|engineering managers?|credit analysts?|product managers?|designers?|analysts?|executives?|managers?)\b/i)?.[1]?.replace(/s$/i, '')
    return { tool: 'search_employees', input: { department, location, query: q || role } }
  }
  // A bare name: show that person.
  if (findPeople(ctx.state.employees, text).length) return { tool: 'get_employee', input: { name_or_id: text } }
  // Anything else is treated as a policy question.
  return { tool: 'search_policies', input: { query: text }, fallback: true }
}

function listRegularisations(ctx) {
  const regs = (ctx.state.regularisations || []).filter((r) => r.status === 'Pending')
  if (!regs.length) return 'There are no pending regularisation requests.'
  return 'Pending regularisations: ' + regs.map((r) => r.employee + ' for ' + r.date + ' (' + r.id + ')').join('; ') + '.'
}

export function suggestions(ctx) {
  const can = (p) => ctx.actor.perms.includes(p)
  if (can(PERMS.ADMIN_SYSTEM)) return ['What is pending for me?', 'Show tickets awaiting approval', 'How many employees are absent today?', 'Headcount by department']
  if (can(PERMS.HR_PEOPLE)) return ['Show pending leave requests from Engineering', 'How many employees are absent today?', 'Generate the attendance report for the sales department', 'Create an onboarding checklist for a new software engineer', 'Show employees who joined this year']
  return ['How many casual leaves do I have left?', 'Apply for leave tomorrow', 'Where can I download my pay slip?', 'Why was my salary deduction higher this month?', 'What is the work-from-home policy?', 'What are the company holidays this year?', 'When is my performance review?', 'Create an HR ticket for a payroll problem']
}

export function helpText(ctx) {
  const can = (p) => ctx.actor.perms.includes(p)
  const lines = ['I can look things up and prepare actions for you to confirm.']
  lines.push(can(PERMS.HR_PEOPLE)
    ? 'Try: "' + suggestions(ctx).slice(0, 3).join('", "') + '".'
    : 'Try: "How many casual leaves do I have left?", "Apply for leave tomorrow", "Where can I download my pay slip?", "What is the work-from-home policy?" or "Create an HR ticket for a payroll problem".')
  lines.push('I always show you the details and wait for your Confirm before submitting anything. I never change salaries, terminate, promote or discipline anyone, and I do not share bank, PAN or Aadhaar details.')
  return lines.join(' ')
}

/** One-line answer for a tool result, used when no language model is present. */
export function describe(tool, result, input = {}) {
  if (result.error) return result.error
  const d = result.data
  switch (tool) {
    case 'search_employees': return d.total === 0 ? 'No employees match' + (input.joined ? ' that joining period' : '') + '.' : 'Found ' + d.total + ' employee' + (d.total === 1 ? '' : 's') + (d.total > d.shown ? ', showing the first ' + d.shown : '') + '.'
    case 'get_employee': return d.found === 0 ? 'I could not find that employee.' : d.employees.map((e) => e.name + ' (' + e.id + ') is ' + (/^[aeiou]/i.test(e.designation) ? 'an ' : 'a ') + e.designation + ' in ' + e.department + ', ' + e.location + ', reporting to ' + e.manager + '; joined ' + e.joinDate + '.').join(' ')
    case 'attendance_today': {
      const s = d.summary
      if (d.scope === 'self') { const me = s.present ? 'You are marked present today.' : s.on_leave ? 'You are on leave today.' : s.off ? 'Today is a day off.' : 'You have not punched in yet today.'; return me + ' Company-wide attendance is visible to HR only.' }
      return 'On ' + s.date + (input.department ? ' in ' + input.department : '') + ': ' + s.present + ' present (' + s.late + ' late), ' + s.absent + ' absent, ' + s.on_leave + ' on leave' + (s.not_in_yet ? ', ' + s.not_in_yet + ' not in yet' : '') + '.' + (d.absent.length ? ' Absent: ' + d.absent.slice(0, 8).join(', ') + (d.absent.length > 8 ? ' and others' : '') + '.' : '')
    }
    case 'attendance_report': return 'Attendance for ' + d.period + ': ' + d.employees + ' employee' + (d.employees === 1 ? '' : 's') + ', ' + d.totals.present + ' present days, ' + d.totals.late + ' late arrivals, ' + d.totals.absent + ' absences and ' + d.totals.leave + ' leave days. Download the full table below.'
    case 'leave_balance': if (d.asked) { const b = d.asked; return b.balance === 'no limit' ? b.type + ' has no fixed limit.' : (d.self ? 'You have ' : d.employee + ' has ') + b.balance + ' day' + (b.balance === 1 ? '' : 's') + ' of ' + b.type + ' left' + (b.pending ? ' - ' + b.available + ' after ' + b.pending + ' pending day' + (b.pending === 1 ? '' : 's') : '') + ' (' + b.used + ' used of ' + b.granted + ').' }
      return d.employee + ' has ' + d.balances.filter((b) => b.balance !== 'no limit').slice(0, 3).map((b) => b.balance + ' days of ' + b.type).join(', ') + ' left' + (d.balances.some((b) => b.pending) ? ', with some requests pending' : '') + '.'
    case 'list_leave_requests': return d.count === 0 ? 'There are no matching leave requests.' : 'There ' + (d.count === 1 ? 'is 1 request' : 'are ' + d.count + ' requests') + ': ' + d.requests.slice(0, 5).map((r, i) => (i + 1) + '. ' + r.employee + ' - ' + r.days + ' day' + (r.days > 1 ? 's' : '') + ' (' + r.from + (r.to !== r.from ? ' to ' + r.to : '') + ')').join('; ') + '.' + (d.can_decide && d.requests.some((r) => r.status === 'Pending') ? ' Would you like to approve or reject any of them?' : '')
    case 'pending_tasks': return d.items.length ? 'Waiting for you: ' + d.items.map((i) => i.count + ' ' + i.task.toLowerCase()).join('; ') + '.' : 'Nothing is waiting for you right now.'
    case 'list_tickets': return d.count === 0 ? 'No tickets match.' : d.count + ' ticket' + (d.count === 1 ? '' : 's') + ': ' + d.tickets.slice(0, 5).map((x) => x.id + ' ' + x.subject + ' (' + x.status + ')').join('; ') + '.'
    case 'recruitment': return d.openings ? d.count + ' open positions.' : d.pipeline ? 'Pipeline: ' + d.pipeline.filter((p) => p.candidates).map((p) => p.candidates + ' at ' + p.stage).join(', ') + '.' : d.count + ' candidate' + (d.count === 1 ? '' : 's') + '.'
    case 'headcount_report': return d.directory_total + ' people in the directory. Six-month turnover is ' + d.six_month_turnover_percent + '%.'
    case 'onboarding_checklist': return 'Here is an onboarding checklist for a ' + d.role + ' starting ' + d.start_date + ': ' + d.tasks.length + ' tasks across HR, IT, Finance, Admin, the manager and the new joiner.'
    case 'search_policies': return d.found ? bestSentences(d.articles[0].text, input.query, 2) + ' (Source: ' + d.articles[0].title + ', updated ' + d.articles[0].updated + '.)' : 'I could not find a policy that answers that, and I would rather not guess. Say "create an HR ticket about ..." and I will prepare one for HR to answer.'
    case 'my_payslips': return d.payslips ? 'Your latest payslip is for ' + d.payslips[0].month + ': net ' + d.payslips[0].net + '. To download it, open Payroll > My payslips > View and choose Print or save PDF - or use the link below.' : d.note
    case 'explain_payslip': return !d.month ? d.note : !d.previous ? 'This is your first payslip here, so there is nothing to compare with.' : (d.not_current ? 'This month\'s payslip is not released yet, so here is your latest one. ' : '') + 'In ' + d.month + ' your deductions were Rs ' + d.deductions.toLocaleString('en-IN') + (d.deductions === d.previous.deductions ? ', the same as ' : d.deductions > d.previous.deductions ? ', Rs ' + (d.deductions - d.previous.deductions).toLocaleString('en-IN') + ' more than ' : ', Rs ' + (d.previous.deductions - d.deductions).toLocaleString('en-IN') + ' less than ') + d.compared_with + '. ' + (d.reasons.length ? 'Why: ' + d.reasons.join('; ') + '.' : 'Nothing changed in your earnings or deductions.') + ' If something still looks wrong, I can raise a Payroll ticket.'
    case 'holidays': return d.count ? d.count + ' ' + (input.include_optional ? 'holidays (including optional ones)' : 'company holidays') + ' in ' + d.year + (input.upcoming_only ? ' still to come' : '') + '.' + (d.next_holiday ? ' The next one is ' + d.next_holiday + '.' : '') : 'No holidays match.'
    case 'my_performance': return d.found === 0 ? 'No appraisal is open for you this cycle.' : 'Your ' + d.cycle + ' appraisal is at ' + d.stage.toLowerCase() + '. ' + d.next_step + '. Self reviews close ' + d.deadlines.selfReviewCloses + ' and manager reviews are due ' + d.deadlines.managerReviewDue + '.'
    case 'my_learning': return 'You have ' + d.enrolments.length + ' course' + (d.enrolments.length === 1 ? '' : 's') + (d.enrolments.some((e) => e.status !== 'Completed') ? ', ' + d.enrolments.filter((e) => e.status !== 'Completed').length + ' still open' : '') + '. ' + (d.skill_gaps.length ? 'Skill gaps for your role: ' + d.skill_gaps.map((g) => g.skill).join(', ') + '. Ask me to enrol you in a course for any of them.' : 'You meet every skill your role needs.')
    case 'my_onboarding': return !d.status ? (d.documents.length ? 'You have no onboarding in progress. Your documents are listed below.' : 'You have no onboarding in progress.') : 'Your onboarding is ' + d.progress.percent + '% done. ' + (d.open_tasks.length ? d.open_tasks.length + ' tasks are open' + (d.open_tasks.some((x) => x.owner === 'New joiner') ? ', including ' + d.open_tasks.filter((x) => x.owner === 'New joiner').length + ' of yours' : '') + '. ' : '') + (d.policies_to_acknowledge.length ? 'Still to acknowledge: ' + d.policies_to_acknowledge.join(', ') + '.' : '')
    default: return result.proposal ? result.proposal.summary + '. Please check the details and confirm.' : 'Done.'
  }
}

/** Remember the pending items just listed, for "approve the first one". */
export function remember(tool, result) {
  if (tool === 'list_leave_requests' && result.data?.requests) return { pending: result.data.requests.filter((r) => r.status === 'Pending').map((r) => r.id) }
  return {}
}

/** Answer one message with the built-in engine. */
export function answerWithRules(message, ctx, memory) {
  const intent = parseIntent(message, ctx, memory)
  if (intent.reply) return { reply: intent.reply, cards: [], proposals: [], refused: intent.refused, memory: intent.memory || {} }
  if (!TOOLS[intent.tool]) return { reply: helpText(ctx), cards: [], proposals: [], memory: {} }
  const result = runTool(intent.tool, intent.input, ctx)
  // An unrecognised message that no policy covers gets the help text.
  if (intent.fallback && !result.data?.found) {
    return { reply: 'I am not sure about that, and I would rather not guess. ' + helpText(ctx) + ' Or say "create an HR ticket about ..." and HR will answer it.', cards: [], proposals: [], tools: [intent.tool], memory: {} }
  }
  // Keep a half-finished leave application so the next message can complete it.
  const keep = intent.keep && /Which type|reason/.test(result.error || '') ? intent.keep : {}
  return {
    reply: describe(intent.tool, result, intent.input),
    cards: result.card ? [result.card] : [],
    proposals: result.proposal ? [result.proposal] : [],
    tools: [intent.tool],
    memory: { ...remember(intent.tool, result), ...keep },
  }
}

// Built-in understanding for the HR Assistant: turns a message into one tool
// call with keyword and pattern matching. Used when no language model is
// configured (and always in the offline demo). The same tools run either
// way, so permissions and confirmations behave identically.

import { leaveBalances } from '../../data/mock.js'
import { PERMS } from '../../data/accounts.js'
import { TOOLS, runTool, findPeople, sensitiveTopic, SENSITIVE_REPLY } from './tools.js'

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
  if (has(t, /\b(apply|take|book|request)\b.*\bleave\b|\bleave\b.*\b(from|on)\b/) && !has(t, /\b(pending|show|list|balance|approv)\w*/)) {
    const dates = datesIn(text, ctx.today)
    if (!dates.length) return { reply: 'Which dates? For example "apply for casual leave from 12 Oct to 13 Oct".' }
    const type = leaveBalances.map((l) => l.type).find((lt) => t.includes(lt.toLowerCase().split(' ')[0])) || (has(t, /\bsick\b|\bcasual\b/) ? 'Casual Or Sick Leave' : leaveBalances[0].type)
    const reason = text.match(/\b(?:because(?: of)?|due to|reason:?)\s+(.+)$/i)?.[1]
    return { tool: 'propose_leave_application', input: { type, from: dates[0], to: dates[1] || dates[0], reason: reason && !datesIn(reason, ctx.today).length ? reason : undefined } }
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
  return { reply: 'I did not catch that. ' + helpText(ctx) }
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
  return ['What is my leave balance?', 'My attendance this month', 'Apply for casual leave tomorrow', 'Who is my manager?', 'What is pending for me?']
}

export function helpText(ctx) {
  const can = (p) => ctx.actor.perms.includes(p)
  const lines = ['I can look things up and prepare actions for you to confirm.']
  lines.push(can(PERMS.HR_PEOPLE)
    ? 'Try: "' + suggestions(ctx).slice(0, 3).join('", "') + '".'
    : 'Try: "What is my leave balance?", "My attendance this month", or "Apply for casual leave from 12 Oct to 13 Oct".')
  lines.push('I never change salaries, terminate, promote or discipline anyone, and I do not share bank, PAN or Aadhaar details.')
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
    case 'leave_balance': return d.employee + ' has ' + d.balances.map((b) => b.balance + ' ' + b.type).slice(0, 3).join(', ') + ' left, among others.'
    case 'list_leave_requests': return d.count === 0 ? 'There are no matching leave requests.' : 'There ' + (d.count === 1 ? 'is 1 request' : 'are ' + d.count + ' requests') + ': ' + d.requests.slice(0, 5).map((r, i) => (i + 1) + '. ' + r.employee + ' - ' + r.days + ' day' + (r.days > 1 ? 's' : '') + ' (' + r.from + (r.to !== r.from ? ' to ' + r.to : '') + ')').join('; ') + '.' + (d.can_decide && d.requests.some((r) => r.status === 'Pending') ? ' Would you like to approve or reject any of them?' : '')
    case 'pending_tasks': return d.items.length ? 'Waiting for you: ' + d.items.map((i) => i.count + ' ' + i.task.toLowerCase()).join('; ') + '.' : 'Nothing is waiting for you right now.'
    case 'list_tickets': return d.count === 0 ? 'No tickets match.' : d.count + ' ticket' + (d.count === 1 ? '' : 's') + ': ' + d.tickets.slice(0, 5).map((x) => x.id + ' ' + x.subject + ' (' + x.status + ')').join('; ') + '.'
    case 'recruitment': return d.openings ? d.count + ' open positions.' : d.pipeline ? 'Pipeline: ' + d.pipeline.filter((p) => p.candidates).map((p) => p.candidates + ' at ' + p.stage).join(', ') + '.' : d.count + ' candidate' + (d.count === 1 ? '' : 's') + '.'
    case 'headcount_report': return d.directory_total + ' people in the directory. Six-month turnover is ' + d.six_month_turnover_percent + '%.'
    case 'onboarding_checklist': return 'Here is an onboarding checklist for a ' + d.role + ' starting ' + d.start_date + ': ' + d.tasks.length + ' tasks across HR, IT, Finance, Admin, the manager and the new joiner.'
    default: return result.proposal ? result.proposal.summary + '. Please confirm.' : 'Done.'
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
  if (intent.reply) return { reply: intent.reply, cards: [], proposals: [], refused: intent.refused, memory: {} }
  if (!TOOLS[intent.tool]) return { reply: helpText(ctx), cards: [], proposals: [], memory: {} }
  const result = runTool(intent.tool, intent.input, ctx)
  return {
    reply: describe(intent.tool, result, intent.input),
    cards: result.card ? [result.card] : [],
    proposals: result.proposal ? [result.proposal] : [],
    tools: [intent.tool],
    memory: remember(intent.tool, result),
  }
}

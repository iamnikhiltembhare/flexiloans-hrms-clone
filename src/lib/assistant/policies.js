// HR knowledge base: the policies, FAQs and procedures the HR Assistant
// answers from. Each article is short and self-contained so a search result
// can be shown as-is and quoted with its title as the source.
//
// Keep this in step with the published handbook; `updated` is shown to people.

export const POLICIES_KB = [
  { id: 'wfh', title: 'Work from home policy', category: 'Attendance', updated: '2026-07-01',
    keywords: 'wfh work from home remote hybrid home office',
    body: 'Hybrid roles can work from home up to 2 days a week, agreed with your manager in advance. Sales, collections field staff and branch operations roles are office or field based. When you work from home, punch in from the HRMS and choose "Work from home" so the day is recorded as remote. You must be reachable during core hours (10:30 to 17:30) and follow the information security policy on home networks. More than 2 remote days in a week, or working from another city, needs your manager\'s approval and an HR Records ticket.' },
  { id: 'leave', title: 'Leave policy', category: 'Leave', updated: '2026-04-01',
    keywords: 'leave casual sick privilege earned annual carry forward encash lapse apply types entitlement',
    body: 'Yearly entitlement (January to December): Privilege Leave 21 days, Casual or Sick Leave 7 days, Restricted Holiday 1 day, Paternity Leave 10 days, Bereavement Leave 7 days, Comp-Off up to 3 days as earned for weekend or holiday work, and Leave Without Pay up to 30 days. Up to 15 days of unused Privilege Leave carry forward to the next year; Casual or Sick Leave lapses on 31 December. Apply in the HRMS (Leave, or ask the HR Assistant) at least 7 days ahead for planned leave; sick leave can be applied on the day. Leave counts working days only - weekends and company holidays inside a request are not deducted. Sick leave of more than 2 consecutive days needs a medical certificate uploaded to the Document Center. Requests go to HR for approval and you are notified of the decision.' },
  { id: 'maternity', title: 'Maternity, paternity and adoption leave', category: 'Leave', updated: '2026-04-01',
    keywords: 'maternity paternity adoption parental baby child birth',
    body: 'Maternity leave is 26 weeks of paid leave for the first two children (12 weeks from the third), as per the Maternity Benefit Act, with 12 weeks for adoption of a child under 3 months. Paternity leave is 10 working days, to be taken within 3 months of the birth or adoption. Tell HR at least 8 weeks before planned maternity leave by raising an HR Records ticket; HR will share the benefits and creche options.' },
  { id: 'attendance', title: 'Attendance and regularisation', category: 'Attendance', updated: '2026-06-15',
    keywords: 'attendance punch in out late shift hours timing regularise regularization missed punch overtime',
    body: 'The standard shift is 9 hours including breaks, starting between 09:00 and 10:15. Arrivals after 10:15 are marked late; three late marks in a month count as half a day of Casual Leave. Punch in and out from the HRMS or the office biometric reader. If you missed a punch, were on a client visit, or worked from home without punching, open the day in Attendance and request a regularisation within 60 days; HR approves it. Hours beyond 9 in a day are recorded as overtime and paid at 1.5 times the hourly basic rate for eligible roles.' },
  { id: 'holidays', title: 'Holidays and restricted holidays', category: 'Leave', updated: '2026-01-02',
    keywords: 'holiday holidays calendar festival restricted optional public national diwali',
    body: 'The office is closed on the company holidays in the Holiday Calendar. In addition you can pick 1 restricted (optional) holiday a year from the optional list - apply for them like leave, choosing Restricted Holiday. Regional offices may swap a holiday for a local festival with HRBP approval. Dates marked as lunar may move by a day; HR announces the final date.' },
  { id: 'payroll', title: 'Salary, payslips and pay dates', category: 'Payroll', updated: '2026-04-01',
    keywords: 'salary pay payslip pay slip salary slip download pay date credited when paid net gross ctc structure',
    body: 'Salary is credited on the last working day of each month. Your payslip is released in the HRMS once payroll is marked paid: open Payroll, then My payslips, then View, and use "Print or save PDF" to download it. Fixed pay is prorated for loss-of-pay days (unapproved absences and Leave Without Pay). Overtime and any bonus appear as separate earnings. Your salary structure (Basic 40% of monthly CTC, HRA 50% of Basic, conveyance, medical, LTA and special allowance) is under Payroll, Salary structure. For a missing or wrong payment raise a Payroll ticket; the Payroll Desk replies within 2 working days.' },
  { id: 'deductions', title: 'Salary deductions explained', category: 'Payroll', updated: '2026-04-01',
    keywords: 'deduction deductions pf provident fund esi professional tax tds income tax lop loss of pay higher less lower why cut',
    body: 'Deductions on a payslip: Provident Fund is 12% of the Basic you earned that month, capped at 1,800. ESI (0.75%) applies only when gross pay is 21,000 or less. Professional Tax is 200 a month. Income Tax (TDS) is estimated each month from your projected annual income under the new tax regime, so it rises in a month with a bonus or overtime and changes after you submit a tax declaration. Loss-of-pay days reduce earnings rather than appearing as a deduction. Deductions usually go up because of a bonus or overtime (more TDS) or a change in your declaration; they go down with loss-of-pay days (lower Basic, so lower PF).' },
  { id: 'tax', title: 'Income tax and investment declarations', category: 'Payroll', updated: '2026-04-01',
    keywords: 'tax regime declaration 80c 80d hra exemption investment proof form 16 tds old new',
    body: 'The new tax regime is the default for FY 2026-27, with the Section 87A rebate making income up to 12 lakh tax-free and a 75,000 standard deduction. You can choose the old regime in Payroll, Tax declaration before 30 April. Declare investments (80C, 80D, HRA rent) by 30 June; submit proofs between 1 and 31 January or TDS is recalculated without them. Form 16 is published in the Document Center by 15 June each year.' },
  { id: 'insurance', title: 'Health insurance and benefits', category: 'Benefits', updated: '2026-09-11',
    keywords: 'insurance health medical mediclaim family floater cover coverage hospital cashless benefits top up parents opd life term accident nomination',
    body: 'From 1 November 2026 group health insurance is a 7.5 lakh family floater covering you, your spouse and up to two children, including day-care procedures and cashless treatment at network hospitals. You can add parents for a subsidised top-up premium, deducted from salary. Term life cover is 3 times annual CTC and personal accident cover is 5 times; both are company paid. Submit or update your insurance nomination form in the Document Center by 20 October 2026. For claims or cover questions raise a Benefits ticket.' },
  { id: 'reimbursement', title: 'Reimbursements and travel', category: 'Benefits', updated: '2026-05-10',
    keywords: 'reimbursement claim expense travel fuel mobile internet broadband per diem hotel bill',
    body: 'Submit expense claims with bills within 30 days of spending, through a Finance ticket. Monthly limits: mobile and internet 1,500, fuel for field roles as per grade. Business travel must be approved in advance by your manager; hotels are booked through Admin. Per diem is 1,200 a day in metros and 900 elsewhere. Approved claims are paid with the next salary.' },
  { id: 'conduct', title: 'Code of conduct', category: 'Conduct', updated: '2026-01-15',
    keywords: 'code of conduct ethics gift conflict of interest behaviour dress',
    body: 'Treat colleagues and customers with respect, avoid conflicts of interest and declare any that arise, do not accept gifts worth more than 2,000, and protect customer data. The dress code is business casual in offices; wear your company ID card at all times, and field staff meeting customers wear the company-branded shirt. Report concerns through Speak Up in the HRMS, openly or anonymously; retaliation against anyone who raises a concern is a disciplinary offence.' },
  { id: 'posh', title: 'Prevention of sexual harassment (POSH)', category: 'Conduct', updated: '2026-01-15',
    keywords: 'posh harassment sexual internal committee ic complaint',
    body: 'FlexiLoans has zero tolerance for sexual harassment. Complaints go to the Internal Committee, which inquires within 90 days and keeps the matter confidential. Raise a complaint through Speak Up (choose Harassment - POSH) or email the Internal Committee. Everyone completes POSH training at induction and every year.' },
  { id: 'security', title: 'Information security and acceptable use', category: 'IT', updated: '2026-03-01',
    keywords: 'it security password laptop vpn phishing data usb software access acceptable use',
    body: 'Use your company laptop and accounts only for work, keep the VPN on for internal systems, never share passwords or OTPs, and report phishing to IT immediately. Installing unapproved software or copying customer data to personal devices is not allowed. For access requests, a new laptop or IT problems raise an IT ticket; the IT Helpdesk responds within 8 working hours.' },
  { id: 'performance', title: 'Performance review cycle', category: 'Performance', updated: '2026-08-20',
    keywords: 'performance review appraisal rating cycle goals self assessment manager review mid year annual',
    body: 'There are two cycles a year: mid-year (goals and self review in September to October) and year-end (March to April). For the mid-year cycle FY 2026-27, goals must add up to 100% weight, self reviews close on 12 October 2026 and manager reviews are completed by 24 October 2026. Ratings are on a 1 to 5 scale. Salary revisions follow the year-end cycle and are communicated by HR, not through the assistant.' },
  { id: 'learning', title: 'Learning and development', category: 'Learning', updated: '2026-06-01',
    keywords: 'training course learning certification skill development sponsorship budget mandatory',
    body: 'Mandatory courses (KYC and AML awareness, information security, POSH) must be completed by their due dates. Everyone can enrol in catalogue courses from Learning in the HRMS; courses that close a skill gap for your role are recommended first. External certifications are sponsored up to 50,000 a year with manager approval, with a 12-month retention agreement above 25,000.' },
  { id: 'onboarding', title: 'Joining documents and onboarding', category: 'Onboarding', updated: '2026-02-01',
    keywords: 'onboarding joining documents new joiner submit pan aadhaar address proof relieving letter induction buddy',
    body: 'New joiners submit PAN, Aadhaar, address proof, education certificates, the previous employer\'s relieving letter and bank details before or on day 1, by uploading them to the Document Center. HR verifies them within 2 working days. Your onboarding checklist in the HRMS shows your tasks and the policies to acknowledge; IT, Admin, Finance and your manager complete theirs in parallel.' },
  { id: 'profile', title: 'Updating your personal details', category: 'Records', updated: '2026-02-01',
    keywords: 'profile update change personal details mobile phone number emergency contact address bank name',
    body: 'You can update your personal mobile number and emergency contact yourself in the HRMS or through the HR Assistant. A new address, a name correction or new bank details need proof and HR verification, so raise an HR Records ticket and upload the document; HR updates the record within 3 working days. Bank changes take effect from the next payroll run.' },
  { id: 'exit', title: 'Resignation and notice period', category: 'Records', updated: '2026-01-15',
    keywords: 'resign resignation notice period exit full and final settlement relieving experience letter',
    body: 'The notice period is 60 days (30 days during probation). Speak to your manager, then submit your resignation to HR. Unused Privilege Leave up to 30 days is encashed in the full and final settlement, paid within 45 days of the last working day, along with the relieving and experience letters.' },
  { id: 'helpdesk', title: 'Getting help from HR, payroll and IT', category: 'Support', updated: '2026-05-01',
    keywords: 'help ticket support helpdesk contact hr payroll it raise query sla',
    body: 'Raise a ticket from the Request Hub or ask the HR Assistant to create one. Payroll, Benefits and HR Records tickets go to HR (reply within 2 working days); IT and Finance tickets go to those teams and some need a super admin\'s approval. You are notified at every status change.' },
]

const STOP = new Set('a an and are about can do does for from have how i if in is it me my of on or our the to what when where which who why will with you your this that there get policy company rules'.split(' '))
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))
const stem = (w) => w.replace(/(ies|es|s|ing|ed)$/, '')
// Everyday abbreviations people type, spelled out as the policies write them.
const SYNONYMS = [[/\bpf\b/gi, 'provident fund pf'], [/\btds\b/gi, 'income tax tds'], [/\bwfh\b/gi, 'work from home'], [/\bpt\b/gi, 'professional tax'], [/\blop\b/gi, 'loss of pay'], [/\bmediclaim\b/gi, 'health insurance']]
const expand = (q) => SYNONYMS.reduce((s, [re, w]) => s.replace(re, w), String(q || ''))

/** Best matching articles for a question: [{ ...article, score }], strongest first. */
export function searchPolicies(query, limit = 3) {
  const q = [...new Set(words(expand(query)).map(stem))]
  if (!q.length) return []
  return POLICIES_KB.map((a) => {
    const title = words(a.title).map(stem)
    const kw = words(a.keywords).map(stem)
    const body = words(a.body).map(stem)
    let score = 0
    let matched = 0
    for (const w of q) {
      const hit = title.includes(w) || kw.includes(w) || body.includes(w)
      if (hit) matched++
      if (title.includes(w)) score += 4
      if (kw.includes(w)) score += 3
      else if (body.includes(w)) score += 1
    }
    // Phrases like "work from home" count for more than their words.
    if (/work.from.home|wfh/i.test(query) && a.id === 'wfh') score += 6
    return { ...a, score, matched }
  }).filter((a) => a.score >= 3 && a.matched >= Math.ceil(q.length / 2)).sort((a, b) => b.score - a.score).slice(0, limit)
}

/** The `n` sentences of an article that best answer the question, in their original order. */
export function bestSentences(text, query, n = 2) {
  const q = new Set(words(expand(query)).map(stem))
  // A sentence ends at . ! or ? followed by a capital letter - not at "7.5".
  const parts = text.match(/[\s\S]+?(?:[.!?](?=\s+[A-Z("])|$)/g) || [text]
  const scored = parts.map((p, i) => ({ p: p.trim(), i, score: new Set(words(p).map(stem).filter((w) => q.has(w))).size }))
  const top = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, n)
  return (top.length ? top : scored.slice(0, n)).sort((a, b) => a.i - b.i).map((x) => x.p).join(' ')
}

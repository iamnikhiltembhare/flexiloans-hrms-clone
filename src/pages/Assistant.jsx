import { Sparkles, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/ui.jsx'
import AssistantChat from '../components/assistant/AssistantChat.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMS } from '../data/accounts.js'

const EVERYONE = [
  'Company policies, benefits and insurance, answered from the HR handbook with the source',
  'Leave balances, and leave applications checked against your balance and the holiday calendar',
  'Your attendance and work hours',
  'Your payslips to view and download, and why pay or deductions changed',
  'Holiday calendar, performance review dates, training and onboarding',
  'Updating your mobile number or emergency contact',
  'Raising HR, payroll, benefits, IT or finance tickets',
]
const HR = [
  'Search employees by name, department, location or joining date',
  'Company attendance, late and absent lists, monthly reports',
  'Pending leave, regularisations and tickets to approve',
  'Open positions, the hiring pipeline, headcount and onboarding checklists',
]

export default function Assistant() {
  const { can } = useAuth()
  const items = can(PERMS.HR_PEOPLE) ? [...EVERYONE.slice(0, 2), ...HR, ...EVERYONE.slice(5)] : EVERYONE
  return (
    <>
      <PageHeader title="HR Assistant" subtitle="Ask in plain language: policies, leave, pay, holidays, reviews and HR requests - it shows you the details before anything is submitted" />
      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <section className="card overflow-hidden h-[calc(100dvh-15rem)] min-h-[28rem]"><AssistantChat /></section>
        <aside className="card p-4 h-fit space-y-3 text-[12.5px] text-body">
          <p className="flex items-center gap-2 font-semibold text-navy"><Sparkles size={15} className="text-[#7C3AED]" /> What it can do</p>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            {items.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <p className="flex items-center gap-2 font-semibold text-navy pt-1"><ShieldCheck size={15} className="text-[#16A34A]" /> Safeguards</p>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li>Uses your signed-in identity and sees only what your role can see - never someone else's pay</li>
            <li>Shows the details of every request and waits for your Confirm; it then goes through the normal checks and approvals</li>
            <li>If the handbook does not cover a question it offers an HR ticket instead of guessing</li>
            <li>Never changes salaries, terminates, promotes or disciplines anyone, and never shares bank, PAN or Aadhaar details</li>
            <li>Questions and actions are recorded in the audit log</li>
          </ul>
        </aside>
      </div>
    </>
  )
}

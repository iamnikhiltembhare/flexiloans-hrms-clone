import { Sparkles, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/ui.jsx'
import AssistantChat from '../components/assistant/AssistantChat.jsx'

export default function Assistant() {
  return (
    <>
      <PageHeader title="HR Assistant" subtitle="Ask in plain language: find people, check attendance and leave, run reports, prepare approvals" />
      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <section className="card overflow-hidden h-[calc(100dvh-15rem)] min-h-[28rem]"><AssistantChat /></section>
        <aside className="card p-4 h-fit space-y-3 text-[12.5px] text-body">
          <p className="flex items-center gap-2 font-semibold text-navy"><Sparkles size={15} className="text-[#7C3AED]" /> What it can do</p>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li>Search employees by name, department, location or joining date</li>
            <li>Today's attendance, late and absent lists, monthly reports</li>
            <li>Leave balances and pending requests</li>
            <li>Tickets, open positions and the hiring pipeline</li>
            <li>Headcount and turnover reports, onboarding checklists</li>
          </ul>
          <p className="flex items-center gap-2 font-semibold text-navy pt-1"><ShieldCheck size={15} className="text-[#16A34A]" /> Safeguards</p>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li>Sees only what your role can see</li>
            <li>Every change waits for your Confirm, then goes through the normal checks</li>
            <li>Never changes salaries, terminates, promotes or disciplines anyone, and never shares bank, PAN or Aadhaar details</li>
            <li>Questions and actions are recorded in the audit log</li>
          </ul>
        </aside>
      </div>
    </>
  )
}

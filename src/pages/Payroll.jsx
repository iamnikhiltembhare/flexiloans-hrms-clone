import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Wallet, TrendingUp, Receipt, PiggyBank, Play, BadgeCheck, Eye, Printer, Calculator } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, Tabs, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { INR } from '../data/mock.js'
import { PERMS } from '../data/accounts.js'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { downloadFile, downloadCSV } from '../lib/download.js'
import { BRAND } from '../lib/brand.js'
import { structureFor, computeRun, monthLabel } from '../lib/hr/payroll.js'
import { localDate } from '../lib/actions.js'

const thisMonth = () => localDate().slice(0, 7)
const prevMonths = (n) => {
  const d = new Date()
  return Array.from({ length: n }, (_, i) => { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') })
}

/** Printable payslip; also used for the text download. */
function Payslip({ p, emp }) {
  return (
    <div className="print-area text-[12.5px] text-body">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-[15px] font-bold text-navy">{BRAND.company}</p>
          <p className="text-[11px] text-muted">Payslip for {monthLabel(p.month)}</p>
        </div>
        <Badge tone="green">Net {INR(p.net)}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 border-b border-line text-[12px]">
        <span className="text-muted">Employee</span><span className="text-right font-medium text-navy">{p.employee} ({p.empId})</span>
        <span className="text-muted">Designation</span><span className="text-right">{p.designation}</span>
        <span className="text-muted">Department</span><span className="text-right">{p.department}</span>
        <span className="text-muted">Working / paid days</span><span className="text-right font-mono">{p.workingDays} / {p.paidDays}</span>
        <span className="text-muted">Loss of pay days</span><span className="text-right font-mono">{p.lopDays}</span>
        <span className="text-muted">Overtime</span><span className="text-right font-mono">{p.overtimeHours} h</span>
        {emp?.bank && <><span className="text-muted">Bank</span><span className="text-right">{emp.bank}</span></>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 pt-3">
        {[['Earnings', p.earnings, p.gross], ['Deductions', p.deductions, p.totalDeductions]].map(([title, rows, total]) => (
          <div key={title}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-faint">{title}</p>
            {rows.map((r) => (
              <div key={r.head} className="flex justify-between gap-2 border-b border-line/60 py-1"><span>{r.head}</span><span className="font-mono">{INR(r.amount)}</span></div>
            ))}
            <div className="flex justify-between gap-2 py-1.5 font-semibold text-navy"><span>Total</span><span className="font-mono">{INR(total)}</span></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between rounded-lg bg-brand px-3 py-2.5 text-white font-semibold">
        <span>Net pay</span><span className="font-mono">{INR(p.net)}</span>
      </div>
      <p className="mt-2 text-[10.5px] text-faint">Computed by the {BRAND.company} HRMS payroll engine. Indicative figures, not a statutory payslip.</p>
    </div>
  )
}

const payslipText = (p) => {
  const line = (a, b) => a.padEnd(38) + String(b).padStart(12)
  return [
    BRAND.company.toUpperCase() + ' - PAYSLIP ' + monthLabel(p.month).toUpperCase(), '='.repeat(50), '',
    'Employee   : ' + p.employee + ' (' + p.empId + ')', 'Designation: ' + p.designation, 'Department : ' + p.department,
    'Paid days  : ' + p.paidDays + ' of ' + p.workingDays + '   LOP: ' + p.lopDays + '   OT: ' + p.overtimeHours + ' h', '',
    'EARNINGS', '-'.repeat(50), ...p.earnings.map((r) => line(r.head, INR(r.amount))), line('Gross', INR(p.gross)), '',
    'DEDUCTIONS', '-'.repeat(50), ...p.deductions.map((r) => line(r.head, INR(r.amount))), line('Total deductions', INR(p.totalDeductions)), '',
    '='.repeat(50), line('NET PAY', INR(p.net)), '='.repeat(50),
  ].join('\n')
}

export default function Payroll() {
  const { toast, notify, payroll, employees, leaveRequests, runPayroll, payPayroll } = useApp()
  const { user, can } = useAuth()
  const hr = can(PERMS.HR_PEOPLE)
  const [tab, setTab] = useState('My payslips')
  const [view, setView] = useState(null)
  // ?payslip=PS-... (from the HR Assistant) opens that payslip straight away.
  const [params, setParams] = useSearchParams()
  const wanted = params.get('payslip')

  const me = employees.find((e) => e.id === user.id) || { ...user }
  const structure = useMemo(() => structureFor(me), [me])
  const monthly = structure.earnings.reduce((s, e) => s + e.amount, 0)
  const mine = (payroll?.payslips || []).filter((p) => p.empId === user.id).sort((a, b) => b.month.localeCompare(a.month))
  const runs = [...(payroll?.runs || [])].sort((a, b) => b.month.localeCompare(a.month))
  const statusOf = (month) => runs.find((r) => r.month === month)?.status || 'Paid'
  const latest = mine[0]
  useEffect(() => {
    if (!wanted) return
    const slip = mine.find((p) => p.id === wanted)
    if (slip) { setTab('My payslips'); setView(slip); setParams({}, { replace: true }) }
  }, [wanted, mine, setParams])

  const exportMine = () => {
    downloadCSV('payslips-' + user.id + '.csv', [
      { header: 'Month', key: 'month' }, { header: 'Paid days', key: 'paidDays' }, { header: 'LOP', key: 'lopDays' },
      { header: 'Overtime h', key: 'overtimeHours' }, { header: 'Gross', key: 'gross' }, { header: 'Deductions', key: 'totalDeductions' }, { header: 'Net', key: 'net' },
    ], mine)
    toast('Export ready', mine.length + ' payslips exported to CSV')
  }

  return (
    <>
      <PageHeader title="Payroll" subtitle="Payslips, salary structure, tax and payroll runs"
        actions={<button className="btn-secondary" onClick={exportMine} disabled={!mine.length}><Download size={13} /> Export my payslips</button>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Monthly gross (fixed)" value={INR(monthly)} hint="Before loss of pay and overtime" icon={Wallet} tone="cyan" />
        <StatCard label="Last net pay" value={latest ? INR(latest.net) : '--'} hint={latest ? monthLabel(latest.month) : 'No payslip released yet'} icon={TrendingUp} tone="green" />
        <StatCard label="Last deductions" value={latest ? INR(latest.totalDeductions) : '--'} hint="PF, PT and TDS" icon={Receipt} tone="amber" />
        <StatCard label="Annual CTC" value={INR(structure.ctc)} hint={'Includes employer PF ' + INR(structure.employerPf * 12)} icon={PiggyBank} tone="blue" />
      </div>

      <Tabs tabs={['My payslips', 'Salary structure', 'Tax declaration', ...(hr ? ['Payroll runs'] : [])]} active={tab} onChange={setTab} />

      {tab === 'My payslips' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'month', header: 'Pay period', render: (r) => monthLabel(r.month) },
              { key: 'paidDays', header: 'Paid days', align: 'right', mono: true, render: (r) => r.paidDays + '/' + r.workingDays },
              { key: 'lopDays', header: 'LOP', align: 'right', mono: true },
              { key: 'overtimeHours', header: 'OT hrs', align: 'right', mono: true },
              { key: 'gross', header: 'Gross', align: 'right', mono: true, render: (r) => INR(r.gross) },
              { key: 'totalDeductions', header: 'Deductions', align: 'right', mono: true, render: (r) => INR(r.totalDeductions) },
              { key: 'net', header: 'Net pay', align: 'right', mono: true, render: (r) => <span className="font-semibold text-navy">{INR(r.net)}</span> },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(statusOf(r.month))}>{statusOf(r.month)}</Badge> },
              { key: 'action', header: '', align: 'right', render: (r) => (
                <span className="flex gap-1.5 justify-end">
                  <button className="btn-ghost px-2 py-1" onClick={() => setView(r)}><Eye size={12} /> View</button>
                  <button className="btn-ghost px-2 py-1" onClick={() => downloadFile('payslip-' + r.month + '.txt', payslipText(r))}><Download size={12} /></button>
                </span>
              )},
            ]}
            rows={mine}
            empty="Your payslips appear here once HR releases a payroll run."
          />
        </Card>
      )}

      {tab === 'Salary structure' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Monthly earnings" subtitle={'Annual CTC ' + INR(structure.ctc)} bodyClass="p-0">
            <Table
              columns={[
                { key: 'head', header: 'Component' },
                { key: 'amount', header: 'Monthly', align: 'right', mono: true, render: (r) => INR(r.amount) },
                { key: 'annual', header: 'Annual', align: 'right', mono: true, render: (r) => INR(r.amount * 12) },
              ]}
              rows={structure.earnings}
            />
            <div className="flex justify-between px-3 py-3 bg-brand text-white text-[13px] font-medium">
              <span>Total earnings</span><span className="font-mono">{INR(monthly)} / month</span>
            </div>
          </Card>
          <Card title="How pay is calculated" bodyClass="p-4 space-y-2 text-[12.5px] text-body">
            <p><strong className="text-navy">Loss of pay.</strong> Fixed pay is prorated by paid days: working days minus unapproved absences and Leave Without Pay.</p>
            <p><strong className="text-navy">Overtime.</strong> Hours beyond the 9-hour shift, paid at the hourly basic rate times the run's overtime multiplier.</p>
            <p><strong className="text-navy">Deductions.</strong> Employee PF at 12% of basic (capped at {INR(1800)}), ESI when gross is {INR(21000)} or less, professional tax, and TDS estimated under the new regime with the standard deduction.</p>
            <p><strong className="text-navy">Employer PF.</strong> {INR(structure.employerPf)} a month, part of CTC but not of take-home.</p>
          </Card>
        </div>
      )}

      {tab === 'Tax declaration' && (
        <Card title="Investment declaration FY 2026-27" subtitle="Window closes 15 January 2027">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Section 80C', 150000, 112000],
              ['Section 80D - Health insurance', 25000, 25000],
              ['HRA exemption', 240000, 216000],
              ['Section 80CCD(1B) - NPS', 50000, 0],
            ].map(([head, limit, declared]) => (
              <div key={head} className="rounded-lg border border-line p-3.5">
                <div className="flex justify-between items-baseline">
                  <p className="text-[13px] font-medium text-navy">{head}</p>
                  <Badge tone={declared >= limit ? 'green' : declared > 0 ? 'amber' : 'gray'}>{declared >= limit ? 'Maxed' : declared > 0 ? 'Partial' : 'Not declared'}</Badge>
                </div>
                <p className="text-[12px] text-muted mt-1.5 font-mono">{INR(declared)} declared of {INR(limit)}</p>
                <div className="h-1.5 w-full rounded-full bg-line overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-cyan" style={{ width: Math.min(100, (declared / limit) * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border-l-[3px] border-cyan bg-cyan-bg px-3.5 py-3">
            <p className="text-[12px] text-body">You are on the <strong>new tax regime</strong>, which is what the payroll engine uses to estimate TDS. Deductions under 80C and 80D do not reduce taxable income under this regime.</p>
          </div>
        </Card>
      )}

      {tab === 'Payroll runs' && hr && (
        <PayrollRuns runs={runs} payslips={payroll?.payslips || []} employees={employees} leaveRequests={leaveRequests}
          onRun={(month, opts) => {
            runPayroll(month, opts)
            notify({ title: monthLabel(month) + ' payroll processed', detail: employees.length + ' payslips computed - review, then mark as paid', to: '/payroll', kind: 'task' })
            toast('Payroll processed', monthLabel(month) + ': ' + employees.length + ' payslips computed')
          }}
          onPay={(month) => { payPayroll(month); toast('Payroll released', 'Employees can now see their ' + monthLabel(month) + ' payslips') }}
          onView={setView} />
      )}

      <Modal open={!!view} onClose={() => setView(null)} title="Payslip" subtitle={view ? monthLabel(view.month) : ''} width="max-w-2xl"
        footer={view && <>
          <button className="btn-ghost" onClick={() => downloadFile('payslip-' + view.month + '-' + view.empId + '.txt', payslipText(view))}><Download size={13} /> Download</button>
          <button className="btn-primary" onClick={() => window.print()}><Printer size={13} /> Print or save PDF</button>
        </>}>
        {view && <Payslip p={view} emp={view.empId === user.id ? user : null} />}
      </Modal>
    </>
  )
}

function PayrollRuns({ runs, payslips, employees, leaveRequests, onRun, onPay, onView }) {
  const months = prevMonths(4)
  const [month, setMonth] = useState(thisMonth())
  const [bonusPercent, setBonus] = useState(0)
  const [otMultiplier, setOt] = useState(1.5)
  const [open, setOpen] = useState(runs[0]?.month || null)
  const existing = runs.find((r) => r.month === month)
  const preview = useMemo(() => computeRun(employees, month, { leaveRequests }, { bonusPercent, otMultiplier }).run, [employees, month, leaveRequests, bonusPercent, otMultiplier])
  const register = payslips.filter((p) => p.month === open)

  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
      <Card title="Run payroll" subtitle="Computes every employee's payslip from attendance and leave" bodyClass="p-4 space-y-3">
        <div><label className="label" htmlFor="pr-month">Month</label>
          <select id="pr-month" className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}{runs.find((r) => r.month === m) ? ' - ' + runs.find((r) => r.month === m).status : ''}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="pr-bonus">Bonus % of basic</label><input id="pr-bonus" type="number" min="0" max="100" className="input" value={bonusPercent} onChange={(e) => setBonus(Math.max(0, Math.min(100, Number(e.target.value))))} /></div>
          <div><label className="label" htmlFor="pr-ot">Overtime rate</label>
            <select id="pr-ot" className="input" value={otMultiplier} onChange={(e) => setOt(Number(e.target.value))}>{[1, 1.5, 2].map((x) => <option key={x} value={x}>{x}x</option>)}</select>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 p-3 text-[12px] space-y-1">
          <p className="flex items-center gap-1.5 font-semibold text-navy"><Calculator size={13} /> Preview - {monthLabel(month)}</p>
          <div className="flex justify-between"><span className="text-muted">Employees</span><span className="font-mono">{preview.employees}</span></div>
          <div className="flex justify-between"><span className="text-muted">Gross</span><span className="font-mono">{INR(preview.gross)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Deductions</span><span className="font-mono">{INR(preview.deductions)}</span></div>
          <div className="flex justify-between font-semibold text-navy"><span>Net payout</span><span className="font-mono">{INR(preview.net)}</span></div>
        </div>
        {existing?.status === 'Paid'
          ? <p className="text-[12px] text-muted">{monthLabel(month)} is paid and locked.</p>
          : <button className="btn-primary w-full justify-center" onClick={() => { onRun(month, { bonusPercent, otMultiplier }); setOpen(month) }}>
              <Play size={13} /> {existing ? 'Re-run' : 'Run'} {monthLabel(month)} payroll
            </button>}
      </Card>

      <div className="space-y-4">
        <Card title="Payroll runs" bodyClass="p-0">
          <Table
            columns={[
              { key: 'month', header: 'Month', render: (r) => monthLabel(r.month) },
              { key: 'employees', header: 'Payslips', align: 'right', mono: true },
              { key: 'gross', header: 'Gross', align: 'right', mono: true, render: (r) => INR(r.gross) },
              { key: 'net', header: 'Net', align: 'right', mono: true, render: (r) => INR(r.net) },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
              { key: 'action', header: '', align: 'right', render: (r) => (
                <span className="flex gap-1.5 justify-end">
                  <button className="btn-ghost px-2 py-1" onClick={() => setOpen(r.month)}>Register</button>
                  {r.status !== 'Paid' && <button className="btn-primary px-2 py-1" onClick={() => onPay(r.month)}><BadgeCheck size={12} /> Mark paid</button>}
                </span>
              )},
            ]}
            rows={runs}
            empty="No payroll has been run yet."
          />
        </Card>
        {open && (
          <Card title={'Register - ' + monthLabel(open)} subtitle={register.length + ' payslips'} bodyClass="p-0"
            actions={<button className="btn-secondary" onClick={() => downloadCSV('payroll-register-' + open + '.csv', [
              { header: 'Employee ID', key: 'empId' }, { header: 'Employee', key: 'employee' }, { header: 'Department', key: 'department' },
              { header: 'Paid days', key: 'paidDays' }, { header: 'LOP', key: 'lopDays' }, { header: 'OT hours', key: 'overtimeHours' },
              { header: 'Gross', key: 'gross' }, { header: 'Deductions', key: 'totalDeductions' }, { header: 'Net', key: 'net' },
            ], register)}><Download size={13} /> CSV</button>}>
            <Table
              columns={[
                { key: 'employee', header: 'Employee' },
                { key: 'department', header: 'Department' },
                { key: 'paidDays', header: 'Paid', align: 'right', mono: true },
                { key: 'lopDays', header: 'LOP', align: 'right', mono: true },
                { key: 'overtimeHours', header: 'OT h', align: 'right', mono: true },
                { key: 'gross', header: 'Gross', align: 'right', mono: true, render: (r) => INR(r.gross) },
                { key: 'net', header: 'Net', align: 'right', mono: true, render: (r) => INR(r.net) },
                { key: 'v', header: '', align: 'right', render: (r) => <button className="btn-ghost px-2 py-1" onClick={() => onView(r)}><Eye size={12} /></button> },
              ]}
              rows={register}
            />
          </Card>
        )}
      </div>
    </div>
  )
}

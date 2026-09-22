import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { Download, FileSpreadsheet } from 'lucide-react'
import { PageHeader, Card, Tabs, Table, Badge } from '../components/ui.jsx'
import { headcountTrend, deptDistribution } from '../data/mock.js'
import { useApp } from '../context/DataContext.jsx'
import { downloadCSV } from '../lib/download.js'

const PIE = ['#1B365D', '#00B4D8', '#2563EB', '#7C3AED', '#16A34A', '#D97706', '#DC2626', '#0097B2', '#64748B', '#9333EA']
const tip = { contentStyle: { borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 } }

const attritionData = [
  { month: 'Apr', voluntary: 1.4, involuntary: 0.4 },
  { month: 'May', voluntary: 1.3, involuntary: 0.3 },
  { month: 'Jun', voluntary: 1.6, involuntary: 0.2 },
  { month: 'Jul', voluntary: 1.2, involuntary: 0.5 },
  { month: 'Aug', voluntary: 1.1, involuntary: 0.3 },
  { month: 'Sep', voluntary: 1.5, involuntary: 0.3 },
]

const REPORTS = [
  { name: 'Monthly headcount register', owner: 'HR Ops', frequency: 'Monthly', lastRun: '2026-09-01', format: 'XLSX' },
  { name: 'Attendance and overtime summary', owner: 'HR Ops', frequency: 'Monthly', lastRun: '2026-09-01', format: 'XLSX' },
  { name: 'Leave liability report', owner: 'Finance', frequency: 'Quarterly', lastRun: '2026-07-05', format: 'XLSX' },
  { name: 'Payroll register with statutory splits', owner: 'Payroll', frequency: 'Monthly', lastRun: '2026-08-31', format: 'CSV' },
  { name: 'PF and ESIC challan extract', owner: 'Payroll', frequency: 'Monthly', lastRun: '2026-09-07', format: 'CSV' },
  { name: 'Diversity and inclusion dashboard', owner: 'People Analytics', frequency: 'Quarterly', lastRun: '2026-07-12', format: 'PDF' },
  { name: 'Attrition and exit-interview themes', owner: 'People Analytics', frequency: 'Quarterly', lastRun: '2026-07-12', format: 'PDF' },
]

export default function Reports() {
  const { employees, toast } = useApp()
  const [tab, setTab] = useState('Workforce')
  const byLocation = [...new Set(employees.map((e) => e.location))]
    .map((l) => ({ name: l, value: employees.filter((e) => e.location === l).length }))

  const exportView = () => {
    if (tab === 'Scheduled reports') {
      downloadCSV('flexiloans-scheduled-reports.csv', [
        { header: 'Report', key: 'name' }, { header: 'Owner', key: 'owner' },
        { header: 'Frequency', key: 'frequency' }, { header: 'Last run', key: 'lastRun' },
        { header: 'Format', key: 'format' },
      ], REPORTS)
    } else if (tab === 'Attrition') {
      downloadCSV('flexiloans-attrition.csv', [
        { header: 'Month', key: 'month' }, { header: 'Voluntary %', key: 'voluntary' },
        { header: 'Involuntary %', key: 'involuntary' },
      ], attritionData)
    } else {
      downloadCSV('flexiloans-headcount.csv', [
        { header: 'Month', key: 'month' }, { header: 'Headcount', key: 'headcount' },
        { header: 'Joiners', key: 'joiners' }, { header: 'Exits', key: 'exits' },
      ], headcountTrend)
    }
    toast('Export ready', tab + ' data exported to CSV')
  }

  const runReport = (r) => toast('Report queued', r.name + ' will be emailed to ' + r.owner + ' as ' + r.format, 'info')

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        subtitle="Workforce insight for people and finance teams"
        actions={<button className="btn-secondary" onClick={exportView}><Download size={13} /> Export current view</button>}
      />

      <Tabs tabs={['Workforce', 'Attrition', 'Scheduled reports']} active={tab} onChange={setTab} />

      {tab === 'Workforce' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Joiners vs exits" subtitle="Rolling six months">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={headcountTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="joiners" fill="#00B4D8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="exits" fill="#1B365D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Headcount by department">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptDistribution} layout="vertical" margin={{ top: 0, right: 12, left: 44, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <Tooltip {...tip} />
                  <Bar dataKey="value" fill="#00B4D8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Distribution by location">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byLocation} dataKey="value" nameKey="name" outerRadius={82} isAnimationActive={false} label={{ fontSize: 10 }}>
                    {byLocation.map((d, i) => <Cell key={d.name} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip {...tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Gender split" subtitle="Company-wide">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Male', value: employees.filter((e) => e.gender === 'Male').length },
                      { name: 'Female', value: employees.filter((e) => e.gender === 'Female').length },
                    ]}
                    dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} isAnimationActive={false} label={{ fontSize: 11 }}>
                    <Cell fill="#1B365D" /><Cell fill="#00B4D8" />
                  </Pie>
                  <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {tab === 'Attrition' && (
        <Card title="Monthly attrition rate" subtitle="Percentage of average headcount">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attritionData} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="voluntary" stroke="#00B4D8" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="involuntary" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 rounded-lg border-l-[3px] border-cyan bg-cyan-bg px-3.5 py-3">
            <p className="text-[12px] text-[#374151]">
              Annualised voluntary attrition sits at <strong>16.2%</strong>, slightly above the 15% target.
              Collections and Sales account for just over half of all exits this half-year.
            </p>
          </div>
        </Card>
      )}

      {tab === 'Scheduled reports' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'name', header: 'Report', render: (r) => (
                <span className="flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-[#16A34A] shrink-0" />
                  <span className="text-[13px] text-navy">{r.name}</span>
                </span>
              )},
              { key: 'owner', header: 'Owner' },
              { key: 'frequency', header: 'Frequency', render: (r) => <Badge tone="blue">{r.frequency}</Badge> },
              { key: 'lastRun', header: 'Last run', mono: true },
              { key: 'format', header: 'Format', mono: true },
              { key: 'action', header: '', align: 'right', render: (r) => <button className="btn-ghost px-2 py-1" onClick={() => runReport(r)}><Download size={12} /> Run</button> },
            ]}
            rows={REPORTS}
          />
        </Card>
      )}
    </>
  )
}

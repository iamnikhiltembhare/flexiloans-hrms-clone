import { useState } from 'react'
import { PageHeader, Card, Tabs, Table, Badge, Field } from '../components/ui.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className={'relative h-5 w-9 rounded-full transition-colors shrink-0 ' + (on ? 'bg-cyan' : 'bg-line')}>
      <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ' + (on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

function Row({ title, desc, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-line last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-navy">{title}</p>
        {desc && <p className="text-[11px] text-muted mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

const LABELS = {
  email: 'Email notifications', push: 'Push notifications', digest: 'Weekly digest',
  approvals: 'Approval reminders', twoFactor: 'Two-factor authentication',
}

export default function Settings() {
  const { toast } = useApp()
  const { user } = useAuth()
  const [tab, setTab] = useState('Preferences')
  const [prefs, setPrefs] = useState({ email: true, push: false, digest: true, approvals: true, twoFactor: true })
  const set = (k) => (v) => {
    setPrefs((p) => ({ ...p, [k]: v }))
    toast(LABELS[k] + ' ' + (v ? 'on' : 'off'), 'Preference saved', v ? 'success' : 'info')
  }
  const pick = (label) => (e) => toast(label + ' updated', 'Now set to ' + e.target.value, 'info')

  return (
    <>
      <PageHeader title="Settings" subtitle="Preferences, access control and organisation setup" />

      <Tabs tabs={['Preferences', 'Notifications', 'Roles & access', 'Organisation', 'Leave policy']} active={tab} onChange={setTab} />

      {tab === 'Preferences' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Account">
            <Row title="Two-factor authentication" desc="Require an OTP on every new device sign-in">
              <Toggle on={prefs.twoFactor} onChange={set('twoFactor')} />
            </Row>
            <Row title="Language" desc="Interface language for this account">
              <select className="input py-1.5 text-xs w-auto" onChange={pick('Language')}><option>English (India)</option><option>Hindi</option><option>Marathi</option></select>
            </Row>
            <Row title="Time zone" desc="Used for attendance and reminders">
              <select className="input py-1.5 text-xs w-auto" onChange={pick('Time zone')}><option>Asia/Kolkata (IST)</option><option>Asia/Dubai</option></select>
            </Row>
            <Row title="Tax regime" desc="Applied from the next payroll cycle">
              <select className="input py-1.5 text-xs w-auto" onChange={pick('Tax regime')}><option>New regime</option><option>Old regime</option></select>
            </Row>
          </Card>

          <Card title="Session">
            <Row title="Signed in as" desc={user.email + " - " + user.role}><Badge tone="green">Active</Badge></Row>
            <Row title="Last sign-in" desc="21 September 2026, 09:34 IST from Mumbai"><Badge tone="gray">Chrome / macOS</Badge></Row>
            <Row title="Password" desc="Last changed 4 months ago"><button className="btn-secondary" onClick={() => toast('Password reset sent', 'Check your inbox for the reset link', 'info')}>Change</button></Row>
            <Row title="Active sessions" desc="2 devices currently signed in"><button className="btn-danger" onClick={() => toast('Signed out everywhere', 'Other devices will need to sign in again', 'warning')}>Sign out all</button></Row>
          </Card>
        </div>
      )}

      {tab === 'Notifications' && (
        <Card title="Notification channels" className="max-w-2xl">
          <Row title="Email notifications" desc="Leave decisions, payslips, policy updates"><Toggle on={prefs.email} onChange={set('email')} /></Row>
          <Row title="Push notifications" desc="Browser and mobile app alerts"><Toggle on={prefs.push} onChange={set('push')} /></Row>
          <Row title="Weekly digest" desc="Monday summary of approvals and team activity"><Toggle on={prefs.digest} onChange={set('digest')} /></Row>
          <Row title="Approval reminders" desc="Nudge me when a request has waited over 24 hours"><Toggle on={prefs.approvals} onChange={set('approvals')} /></Row>
        </Card>
      )}

      {tab === 'Roles & access' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'role', header: 'Role' },
              { key: 'users', header: 'Users', align: 'right', mono: true },
              { key: 'scope', header: 'Scope' },
              { key: 'permissions', header: 'Key permissions' },
            ]}
            rows={[
              { role: 'Super Admin', users: 3, scope: 'Organisation', permissions: 'Full access including payroll and settings' },
              { role: 'HR Admin', users: 11, scope: 'Organisation', permissions: 'Employee records, leave, recruitment, reports' },
              { role: 'Payroll Manager', users: 4, scope: 'Payroll module', permissions: 'Salary structures, payslips, statutory filings' },
              { role: 'Manager', users: 78, scope: 'Own team', permissions: 'Approve leave and attendance, view team reports' },
              { role: 'Employee', users: 472, scope: 'Self', permissions: 'Own profile, attendance, leave, payslips' },
            ]}
          />
        </Card>
      )}

      {tab === 'Organisation' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Company details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Legal entity" value="Epimoney Private Limited" />
              <Field label="Brand" value="FlexiLoans" />
              <Field label="Registered office" value="Mumbai, Maharashtra" />
              <Field label="CIN" value="U65990MH2015PTC****" />
              <Field label="PF establishment code" value="MHBAN****" />
              <Field label="Financial year" value="April to March" />
            </div>
          </Card>
          <Card title="Work week & shifts">
            <Row title="Work week" desc="Monday to Friday"><Badge tone="cyan">5 days</Badge></Row>
            <Row title="General shift" desc="09:30 to 18:30 IST"><Badge tone="blue">9 hours</Badge></Row>
            <Row title="Grace period" desc="Late mark applied after this buffer"><Badge tone="amber">15 min</Badge></Row>
            <Row title="WFH allowance" desc="Per calendar month, per employee"><Badge tone="purple">8 days</Badge></Row>
          </Card>
        </div>
      )}

      {tab === 'Leave policy' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'type', header: 'Leave type' },
              { key: 'entitlement', header: 'Annual entitlement', align: 'right', mono: true },
              { key: 'accrual', header: 'Accrual' },
              { key: 'carry', header: 'Carry forward' },
              { key: 'encash', header: 'Encashable', render: (r) => <Badge tone={r.encash === 'Yes' ? 'green' : 'gray'}>{r.encash}</Badge> },
            ]}
            rows={[
              { type: 'Casual Leave', entitlement: 12, accrual: 'Monthly (1/month)', carry: 'Not allowed', encash: 'No' },
              { type: 'Sick Leave', entitlement: 12, accrual: 'Credited upfront', carry: 'Up to 6 days', encash: 'No' },
              { type: 'Earned Leave', entitlement: 18, accrual: 'Monthly (1.5/month)', carry: 'Up to 30 days', encash: 'Yes' },
              { type: 'Maternity Leave', entitlement: 182, accrual: 'As per Act', carry: 'Not applicable', encash: 'No' },
              { type: 'Paternity Leave', entitlement: 10, accrual: 'Per event', carry: 'Not applicable', encash: 'No' },
              { type: 'Comp Off', entitlement: 4, accrual: 'On approval', carry: 'Expires in 60 days', encash: 'No' },
            ]}
          />
        </Card>
      )}
    </>
  )
}

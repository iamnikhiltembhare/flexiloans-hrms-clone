import { useState } from 'react'
import { Check, X, Download, ShieldCheck, Users, ScrollText, Plug } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, Tabs, SearchInput } from '../components/ui.jsx'
import { ACCOUNTS, ROLES } from '../data/accounts.js'
import { auditLog, roleMatrix, integrations, systemHealth } from '../data/mock.js'
import { useApp } from '../context/DataContext.jsx'
import { downloadCSV } from '../lib/download.js'

const YesNo = ({ on }) => on
  ? <Check size={14} className="text-[#16A34A]" />
  : <X size={14} className="text-faint" />

export default function SystemAdmin() {
  const { toast } = useApp()
  const [tab, setTab] = useState('User accounts')
  const [q, setQ] = useState('')

  const accounts = ACCOUNTS.map((a) => ({
    username: a.username,
    name: a.profile.name,
    email: a.profile.email,
    empId: a.profile.id,
    role: ROLES[a.role].label,
    tone: ROLES[a.role].tone,
    perms: ROLES[a.role].perms.length,
    status: 'Active',
  })).filter((a) => (a.name + a.username + a.role).toLowerCase().includes(q.toLowerCase()))

  const exportAudit = () => {
    downloadCSV('flexiloans-audit-log.csv', [
      { header: 'Event', key: 'id' }, { header: 'When', key: 'at' },
      { header: 'Actor', key: 'actor' }, { header: 'Action', key: 'action' },
      { header: 'Target', key: 'target' }, { header: 'Source', key: 'ip' },
    ], auditLog)
    toast('Audit log exported', auditLog.length + ' events written to CSV')
  }

  return (
    <>
      <PageHeader
        title="System administration"
        subtitle="Accounts, role permissions, audit trail and platform status"
        actions={<button className="btn-secondary" onClick={exportAudit}><Download size={13} /> Export audit log</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Configured roles" value={Object.keys(ROLES).length} icon={ShieldCheck} tone="purple" />
        <StatCard label="Demo logins" value={ACCOUNTS.length} hint="seeded accounts in this build" icon={Users} tone="cyan" />
        <StatCard label="Audit events" value={auditLog.length} hint="shown in this view" icon={ScrollText} tone="blue" />
        <StatCard label="Integrations" value={integrations.filter((i) => i.status === 'Connected').length + '/' + integrations.length} hint="fully connected" icon={Plug} tone="green" />
      </div>

      <Tabs tabs={['User accounts', 'Role permissions', 'Audit log', 'Platform status']} active={tab} onChange={setTab} />

      {tab === 'User accounts' && (
        <Card bodyClass="p-0">
          <div className="p-3 border-b border-line">
            <div className="w-full sm:w-64"><SearchInput value={q} onChange={setQ} placeholder="Search accounts..." /></div>
          </div>
          <Table
            columns={[
              { key: 'name', header: 'User' },
              { key: 'username', header: 'Username', mono: true },
              { key: 'empId', header: 'Emp ID', mono: true },
              { key: 'email', header: 'Email' },
              { key: 'role', header: 'Role', render: (r) => <Badge tone={r.tone}>{r.role}</Badge> },
              { key: 'perms', header: 'Permissions', align: 'right', mono: true },
              { key: 'status', header: 'Status', render: () => <Badge tone="green">Active</Badge> },
            ]}
            rows={accounts}
            empty="No accounts match your search."
          />
        </Card>
      )}

      {tab === 'Role permissions' && (
        <Card title="Permission matrix" subtitle="What each role can reach" bodyClass="p-0">
          <Table
            columns={[
              { key: 'role', header: 'Role' },
              { key: 'users', header: 'Users', align: 'right', mono: true },
              { key: 'self', header: 'Self service', render: (r) => <YesNo on={r.self} /> },
              { key: 'people', header: 'Employees', render: (r) => <YesNo on={r.people} /> },
              { key: 'hiring', header: 'Recruitment', render: (r) => <YesNo on={r.hiring} /> },
              { key: 'desk', header: 'Helpdesk', render: (r) => <YesNo on={r.desk} /> },
              { key: 'reports', header: 'Reports', render: (r) => <YesNo on={r.reports} /> },
              { key: 'settings', header: 'Settings', render: (r) => <YesNo on={r.settings} /> },
              { key: 'system', header: 'System admin', render: (r) => <YesNo on={r.system} /> },
            ]}
            rows={roleMatrix}
          />
          <div className="m-4 rounded-lg border-l-[3px] border-cyan bg-cyan-bg px-3.5 py-3">
            <p className="text-[12px] text-[#374151]">
              Permissions are defined in <code className="font-mono text-[11px]">src/data/accounts.js</code> and
              enforced in two places: the sidebar hides modules a role cannot reach, and each route is wrapped
              in a guard so a typed URL lands on the access-denied screen.
            </p>
          </div>
        </Card>
      )}

      {tab === 'Audit log' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'id', header: 'Event', mono: true },
              { key: 'at', header: 'When', mono: true },
              { key: 'actor', header: 'Actor' },
              { key: 'action', header: 'Action', render: (r) => (
                <Badge tone={r.action.includes('Failed') ? 'red' : r.action.includes('Role') ? 'purple' : 'gray'}>{r.action}</Badge>
              )},
              { key: 'target', header: 'Target' },
              { key: 'ip', header: 'Source', mono: true },
            ]}
            rows={auditLog}
          />
        </Card>
      )}

      {tab === 'Platform status' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Services" bodyClass="p-0">
            <Table
              columns={[
                { key: 'name', header: 'Service' },
                { key: 'status', header: 'Status', render: (r) => (
                  <Badge tone={r.status === 'Operational' ? 'green' : 'amber'}>{r.status}</Badge>
                )},
                { key: 'uptime', header: 'Uptime', align: 'right', mono: true },
                { key: 'latency', header: 'Latency', align: 'right', mono: true },
              ]}
              rows={systemHealth}
            />
          </Card>
          <Card title="Integrations" bodyClass="p-0">
            <Table
              columns={[
                { key: 'name', header: 'Integration' },
                { key: 'status', header: 'Status', render: (r) => (
                  <Badge tone={r.status === 'Connected' ? 'green' : r.status === 'Partial' ? 'amber' : 'red'}>{r.status}</Badge>
                )},
                { key: 'lastSync', header: 'Last sync', align: 'right', mono: true },
              ]}
              rows={integrations}
            />
          </Card>
        </div>
      )}
    </>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Check, X, Download, ShieldCheck, Users, ScrollText, Plug, UserPlus, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { PageHeader, Card, Table, Badge, StatCard, Tabs, SearchInput } from '../components/ui.jsx'
import { ALL_ACCOUNTS, ROLES } from '../data/accounts.js'
import { departments, locations } from '../data/mock.js'
import Modal from '../components/Modal.jsx'
import { auditLog, roleMatrix, integrations, systemHealth } from '../data/mock.js'
import { useApp } from '../context/DataContext.jsx'
import { downloadCSV } from '../lib/download.js'

const YesNo = ({ on }) => on
  ? <Check size={14} className="text-[#16A34A]" />
  : <X size={14} className="text-faint" />

export default function SystemAdmin() {
  const { toast, notify, listUsers, listAudit } = useApp()
  const [tab, setTab] = useState('User accounts')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  // Accounts come from the server (or this browser, offline), so users an
  // admin creates show up here straight away.
  const [list, setList] = useState(null)
  const load = useCallback(() => listUsers().then(setList).catch((e) => toast('Could not load accounts', e.message, 'error')), [listUsers, toast])
  useEffect(() => { load() }, [load])

  const accounts = (list || ALL_ACCOUNTS.map((a) => ({ username: a.username, name: a.profile.name, email: a.profile.email, empId: a.profile.id, roleKey: a.role, source: 'seed' })))
    .map((a) => ({ ...a, role: ROLES[a.roleKey].label, tone: ROLES[a.roleKey].tone, perms: ROLES[a.roleKey].perms.length }))
    .filter((a) => (a.name + a.username + a.role).toLowerCase().includes(q.toLowerCase()))
  const createdCount = (list || []).filter((a) => a.source === 'admin').length

  // Real events (every change and every assistant question) above the sample history.
  const [events, setEvents] = useState([])
  useEffect(() => { listAudit().then(setEvents).catch(() => {}) }, [listAudit, tab])
  const ACTION_LABEL = { 'assistant.ask': 'Asked the assistant', 'assistant.refused': 'Assistant refused', 'leave.setStatus': 'Leave decision', 'ticket.setStatus': 'Ticket update',
    'regularisation.decide': 'Regularisation decision', 'regularisation.add': 'Regularisation request', 'leave.add': 'Leave applied', 'candidate.advance': 'Candidate moved', 'punch.toggle': 'Punch in/out' }
  const auditRows = [
    ...events.map((e) => ({ id: e.id, at: new Date(e.at).toLocaleString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ''), actor: e.actor, action: ACTION_LABEL[e.action] || e.action,
      target: [e.target, e.detail && '"' + e.detail + '"'].filter(Boolean).join(' - '), ip: e.via === 'assistant' ? 'HR Assistant' : 'App' })),
    ...auditLog,
  ]

  const exportAudit = () => {
    downloadCSV('flexiloans-audit-log.csv', [
      { header: 'Event', key: 'id' }, { header: 'When', key: 'at' },
      { header: 'Actor', key: 'actor' }, { header: 'Action', key: 'action' },
      { header: 'Target', key: 'target' }, { header: 'Source', key: 'ip' },
    ], auditRows)
    toast('Audit log exported', auditRows.length + ' events written to CSV')
  }

  return (
    <>
      <PageHeader
        title="System administration"
        subtitle="Accounts, role permissions, audit trail and platform status"
        actions={<>
          <button className="btn-secondary" onClick={exportAudit}><Download size={13} /> Export audit log</button>
          <button className="btn-primary" onClick={() => setCreating(true)}><UserPlus size={13} /> Create user</button>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Configured roles" value={Object.keys(ROLES).length} icon={ShieldCheck} tone="purple" />
        <StatCard label="Sign-in accounts" value={list ? list.length : ALL_ACCOUNTS.length}
          hint={createdCount ? createdCount + ' created by admins' : 'every employee plus HR and admin'} icon={Users} tone="cyan" />
        <StatCard label="Audit events" value={auditRows.length} hint={events.length ? events.filter((e) => e.via === 'assistant').length + ' through the HR Assistant' : 'shown in this view'} icon={ScrollText} tone="blue" />
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
              { key: 'source', header: 'Added', render: (r) => r.source === 'admin'
                ? <span className="text-[11px]"><Badge tone="purple">By admin</Badge>{r.createdBy && <span className="block text-faint mt-0.5">{r.createdBy}</span>}</span>
                : <span className="text-[11px] text-faint">Directory</span> },
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
            <p className="text-[12px] text-body">
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
                <Badge tone={/Failed|refused/.test(r.action) ? 'red' : /Role|assistant/i.test(r.action) ? 'purple' : 'gray'}>{r.action}</Badge>
              )},
              { key: 'target', header: 'Target', render: (r) => <span className="block max-w-[26rem] whitespace-normal">{r.target}</span> },
              { key: 'ip', header: 'Source', mono: true },
            ]}
            rows={auditRows}
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
      <CreateUser open={creating} onClose={() => setCreating(false)}
        onCreated={(u) => {
          toast('User created', u.name + ' can now sign in as ' + u.username)
          notify({ title: 'New user ' + u.username, detail: u.name + ' - ' + u.role, to: '/system', kind: 'task' })
          load()
        }} />
    </>
  )
}

const slug = (name) => name.trim().toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')
const makePassword = () => {
  const words = ['Flexi', 'Horizon', 'Summit', 'Cedar', 'Nova', 'Harbor']
  return words[Math.floor(Math.random() * words.length)] + '@' + (1000 + Math.floor(Math.random() * 9000))
}
const BLANK = { name: '', username: '', role: 'employee', department: 'Engineering', designation: '', location: 'Mumbai HQ', password: '' }

function CreateUser({ open, onClose, onCreated }) {
  const { createUser } = useApp()
  const [form, setForm] = useState(BLANK)
  const [touchedUsername, setTouchedUsername] = useState(false)
  const [show, setShow] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => {
    const v = e.target.value
    setForm((f) => ({ ...f, [k]: v, ...(k === 'name' && !touchedUsername ? { username: slug(v) } : {}) }))
    if (k === 'username') setTouchedUsername(true)
  }
  const close = () => { setForm(BLANK); setTouchedUsername(false); setErr(''); onClose() }

  const submit = async (e) => {
    e?.preventDefault()
    if (!form.name.trim()) { setErr('Enter the person\'s full name.'); return }
    setBusy(true); setErr('')
    try {
      const made = await createUser(form)
      onCreated(made)
      close()
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Create user" subtitle="Adds the person to the People directory with a login"
      footer={<>
        <button className="btn-ghost" onClick={close}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}><UserPlus size={13} /> {busy ? 'Creating...' : 'Create user'}</button>
      </>}>
      <form onSubmit={submit} className="grid gap-3">
        <div><label className="label">Full name *</label><input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Priya Kapoor" autoFocus /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Username *</label><input className="input font-mono" value={form.username} onChange={set('username')} placeholder="priya.kapoor" autoCapitalize="none" /></div>
          <div><label className="label">Role *</label>
            <select className="input" value={form.role} onChange={set('role')}>
              {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <p className="-mt-1 text-[11px] text-muted">{ROLES[form.role].description}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Department</label><select className="input" value={form.department} onChange={set('department')}>{departments.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className="label">Location</label><select className="input" value={form.location} onChange={set('location')}>{locations.map((l) => <option key={l}>{l}</option>)}</select></div>
        </div>
        <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={set('designation')} placeholder={ROLES[form.role].label} /></div>
        <div>
          <label className="label">Starting password *</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input className="input font-mono pr-9" type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="At least 8 characters, letters and numbers" autoComplete="new-password" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-navy" aria-label="Toggle password visibility">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setForm((f) => ({ ...f, password: makePassword() }))}><RefreshCw size={13} /> Generate</button>
          </div>
          <p className="mt-1 text-[11px] text-muted">Share it with the person; they sign in with the username above.</p>
        </div>
        {err && <p className="text-[12px] text-[#DC2626]">{err}</p>}
      </form>
    </Modal>
  )
}

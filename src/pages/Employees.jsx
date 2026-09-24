import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, UserPlus, Users, UserCheck, UserMinus, MapPin } from 'lucide-react'
import { PageHeader, Card, Table, Badge, Avatar, SearchInput, Select, statusTone, StatCard } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { departments, locations } from '../data/mock.js'
import { useApp } from '../context/DataContext.jsx'
import { downloadCSV } from '../lib/download.js'
import { BRAND } from '../lib/brand.js'

const BLANK = { name: '', email: '', phone: '', department: 'Product', designation: '', location: 'Mumbai HQ', gender: 'Female' }

export default function Employees() {
  const { employees, addEmployee, toast, notify } = useApp()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('All departments')
  const [loc, setLoc] = useState('All locations')
  const [status, setStatus] = useState('All statuses')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')

  const rows = useMemo(() => employees.filter((e) =>
    (e.name + e.id + e.email + e.designation).toLowerCase().includes(q.toLowerCase())
    && (dept === 'All departments' || e.department === dept)
    && (loc === 'All locations' || e.location === loc)
    && (status === 'All statuses' || e.status === status)
  ), [employees, q, dept, loc, status])

  const exportCsv = () => {
    downloadCSV('flexiloans-employees.csv', [
      { header: 'Employee ID', key: 'id' }, { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' }, { header: 'Phone', key: 'phone' },
      { header: 'Designation', key: 'designation' }, { header: 'Department', key: 'department' },
      { header: 'Location', key: 'location' }, { header: 'Date of joining', key: 'joinDate' },
      { header: 'Status', key: 'status' },
    ], rows)
    toast('Export ready', rows.length + ' employees exported to CSV')
  }

  const save = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.designation.trim()) { setErr('Name and designation are required.'); return }
    const email = form.email.trim() || form.name.trim().toLowerCase().replace(/\s+/g, '.') + '@' + BRAND.emailDomain
    addEmployee({ ...form, name: form.name.trim(), email })
    notify({ title: 'New employee added', detail: form.name.trim() + ' joined ' + form.department, to: '/employees', kind: 'task' })
    toast('Employee added', form.name.trim() + ' is now in the directory')
    setForm(BLANK); setErr(''); setOpen(false)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const columns = [
    { key: 'name', header: 'Employee', render: (r) => (
      <Link to={'/employees/' + r.id} className="flex items-center gap-2.5 group">
        <Avatar name={r.name} size={30} />
        <span>
          <span className="block text-[13px] font-medium text-navy group-hover:text-cyan">{r.name}</span>
          <span className="block text-[11px] text-muted">{r.email}</span>
        </span>
      </Link>
    )},
    { key: 'id', header: 'Emp ID', mono: true },
    { key: 'designation', header: 'Designation' },
    { key: 'department', header: 'Department' },
    { key: 'location', header: 'Location' },
    { key: 'joinDate', header: 'Date of joining', mono: true },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  ]

  return (
    <>
      <PageHeader
        title="Employee directory"
        subtitle={rows.length + ' of ' + employees.length + ' employees'}
        actions={<>
          <button className="btn-secondary" onClick={exportCsv}><Download size={13} /> Export</button>
          <button className="btn-primary" onClick={() => setOpen(true)}><UserPlus size={13} /> Add employee</button>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
        <StatCard label="Total" value={employees.length} icon={Users} tone="cyan" />
        <StatCard label="Active" value={employees.filter((e) => e.status === 'Active').length} icon={UserCheck} tone="green" />
        <StatCard label="On notice" value={employees.filter((e) => e.status === 'On Notice').length} icon={UserMinus} tone="red" />
        <StatCard label="Locations" value={new Set(employees.map((e) => e.location)).size} icon={MapPin} tone="blue" />
      </div>

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <div className="w-full sm:w-64"><SearchInput value={q} onChange={setQ} placeholder="Search by name, ID, role..." /></div>
          <Select value={dept} onChange={setDept} options={['All departments', ...departments]} />
          <Select value={loc} onChange={setLoc} options={['All locations', ...locations]} />
          <Select value={status} onChange={setStatus} options={['All statuses', 'Active', 'Probation', 'On Notice']} />
          {(q || dept !== 'All departments' || loc !== 'All locations' || status !== 'All statuses') && (
            <button className="btn-ghost" onClick={() => { setQ(''); setDept('All departments'); setLoc('All locations'); setStatus('All statuses') }}>Reset</button>
          )}
        </div>
        <Table columns={columns} rows={rows} empty="No employees match these filters." />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add employee" subtitle="Creates a record in this demo session"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Add employee</button>
        </>}>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Full name *</label><input className="input" value={form.name} onChange={set('name')} placeholder="Ananya Rao" /></div>
          <div><label className="label">Designation *</label><input className="input" value={form.designation} onChange={set('designation')} placeholder="Product Manager" /></div>
          <div><label className="label">Official email</label><input className="input" value={form.email} onChange={set('email')} placeholder="auto-generated if blank" /></div>
          <div><label className="label">Mobile</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="+91 98200 00000" /></div>
          <div><label className="label">Department</label>
            <select className="input" value={form.department} onChange={set('department')}>{departments.map((d) => <option key={d}>{d}</option>)}</select>
          </div>
          <div><label className="label">Location</label>
            <select className="input" value={form.location} onChange={set('location')}>{locations.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
          {err && <p className="sm:col-span-2 text-[12px] text-[#DC2626]">{err}</p>}
        </form>
      </Modal>
    </>
  )
}

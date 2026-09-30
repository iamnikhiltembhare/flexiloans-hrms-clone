import { useState } from 'react'
import { Mail, Phone, MapPin, Pencil } from 'lucide-react'
import { PageHeader, Card, Badge, Avatar, Field, Tabs, Table, statusTone } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/DataContext.jsx'
import Modal from '../components/Modal.jsx'
import { INR } from '../data/mock.js'
import { balancesFor } from '../lib/hr/leave.js'
import { monthLabel } from '../lib/hr/payroll.js'
import { BRAND } from '../lib/brand.js'
import SecuritySettings from '../components/SecuritySettings.jsx'

export default function Profile() {
  const { user } = useAuth()
  const { documents, toast, leaveRequests, payroll, employees, hrAction, addTicket } = useApp()
  const rec = employees.find((e) => e.id === user.id) || {}
  const ec = rec.emergencyContact
  const leaveBalances = balancesFor(user.id, leaveRequests).map((b) => ({ ...b, total: b.granted }))
  const payslips = [...(payroll?.payslips || [])].filter((p) => p.empId === user.id).sort((a, b) => b.month.localeCompare(a.month))
    .map((p) => ({ ...p, month: monthLabel(p.month), deductions: p.totalDeductions, status: 'Paid' }))
  const [tab, setTab] = useState('Personal')
  const [open, setOpen] = useState(false)
  const BLANK_REQ = { field: 'Personal mobile', value: '', name: '', relationship: '', note: '' }
  const [req, setReq] = useState(BLANK_REQ)
  // Mobile and emergency contact are yours to change; the rest need proof and HR.
  const direct = req.field === 'Personal mobile' || req.field === 'Emergency contact'
  const sendRequest = () => {
    if (direct) {
      const r = hrAction('profile.update', req.field === 'Personal mobile'
        ? { personalPhone: req.value }
        : { emergencyContact: { name: req.name, phone: req.value, relationship: req.relationship } })
      if (!r.ok) return
      toast('Profile updated', req.field + ' saved to your record')
    } else {
      if (!req.value.trim()) { toast('Add the new value', 'Say what it should be changed to', 'error'); return }
      const id = addTicket({ subject: 'Update ' + req.field.toLowerCase() + ' to: ' + req.value.trim().slice(0, 100), category: 'HR Records', priority: 'Low' })
      toast('Request raised', id + ' - upload the proof in the Document Center; HR updates it within 3 working days')
    }
    setReq(BLANK_REQ)
    setOpen(false)
  }

  return (
    <>
      <PageHeader title="My profile" subtitle={"Your employee record at " + BRAND.company} />

      <Card className="mb-4" bodyClass="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user?.name || 'User'} size={64} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="h1">{user?.name}</h2>
              <Badge tone="green">Active</Badge>
              <Badge tone="cyan">{user?.role}</Badge>
            </div>
            <p className="text-[13px] text-muted">{user?.designation} - {user?.department}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-[12px] text-muted">
              <span className="flex items-center gap-1.5"><Mail size={12} />{user?.email}</span>
              <span className="flex items-center gap-1.5"><Phone size={12} />{user?.phone}</span>
              <span className="flex items-center gap-1.5"><MapPin size={12} />{user?.location}</span>
            </div>
          </div>
          <button className="btn-primary ml-auto" onClick={() => setOpen(true)}><Pencil size={13} /> Request change</button>
        </div>
      </Card>

      <Tabs tabs={['Personal', 'Employment', 'Payroll & bank', 'Leave', 'Documents', 'Security']} active={tab} onChange={setTab} />

      {tab === 'Personal' && (
        <Card title="Personal information">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Full name" value={user?.name} />
            <Field label="Date of birth" value={user?.dob} />
            <Field label="Gender" value={user?.gender} />
            <Field label="Blood group" value={user?.bloodGroup} />
            <Field label="Personal mobile" value={rec.personalPhone || user?.phone} />
            <Field label="Official email" value={user?.email} />
            <Field label="Current address" value="Andheri East, Mumbai 400069" />
            <Field label="Emergency contact" value={ec ? ec.name + ' - ' + ec.phone : 'Not added yet'} />
            <Field label="Relationship" value={ec?.relationship} />
          </div>
        </Card>
      )}

      {tab === 'Security' && <SecuritySettings />}

      {tab === 'Employment' && (
        <Card title="Employment information">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Employee ID" value={user?.id} />
            <Field label="Date of joining" value={user?.joinDate} />
            <Field label="Designation" value={user?.designation} />
            <Field label="Department" value={user?.department} />
            <Field label="Grade" value={user?.grade} />
            <Field label="Employment type" value={user?.employmentType} />
            <Field label="Reporting manager" value={user?.manager} />
            <Field label="Work location" value={user?.location} />
            <Field label="Notice period" value="60 days" />
          </div>
        </Card>
      )}

      {tab === 'Payroll & bank' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Statutory & bank details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank account" value={user?.bank} />
              <Field label="PAN" value={user?.pan} />
              <Field label="UAN (PF)" value={user?.uan} />
              <Field label="Tax regime" value="New regime" />
            </div>
          </Card>
          <Card title="Recent payslips" bodyClass="p-0">
            <Table
              columns={[
                { key: 'month', header: 'Month' },
                { key: 'net', header: 'Net pay', align: 'right', mono: true, render: (r) => INR(r.net) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
              ]}
              rows={payslips.slice(0, 4)}
            />
          </Card>
        </div>
      )}

      {tab === 'Leave' && (
        <Card title="Leave balance" bodyClass="p-0">
          <Table
            columns={[
              { key: 'type', header: 'Leave type' },
              { key: 'code', header: 'Code', mono: true },
              { key: 'total', header: 'Entitled', align: 'right', mono: true },
              { key: 'used', header: 'Used', align: 'right', mono: true },
              { key: 'balance', header: 'Balance', align: 'right', mono: true, render: (r) => r.total - r.used },
            ]}
            rows={leaveBalances}
          />
        </Card>
      )}

      {tab === 'Documents' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'name', header: 'Document' },
              { key: 'category', header: 'Category' },
              { key: 'size', header: 'Size', mono: true },
              { key: 'uploaded', header: 'Uploaded', mono: true },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
            ]}
            rows={documents}
          />
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Change your details" subtitle={direct ? 'Saved to your record straight away - only you and HR can see it' : 'Needs proof, so HR Ops reviews it'}
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={sendRequest}>{direct ? 'Save' : 'Send to HR'}</button>
        </>}>
        <div className="grid gap-3">
          <div><label className="label">Field</label>
            <select className="input" value={req.field} onChange={(e) => setReq({ ...req, field: e.target.value })}>
              <option>Personal mobile</option><option>Current address</option><option>Emergency contact</option>
              <option>Bank account</option><option>Name spelling</option>
            </select>
          </div>
          {req.field === 'Emergency contact' && <>
            <div><label className="label">Contact name</label><input className="input" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} placeholder={ec?.name} /></div>
            <div><label className="label">Relationship</label><input className="input" value={req.relationship} onChange={(e) => setReq({ ...req, relationship: e.target.value })} placeholder={ec?.relationship || 'Spouse, Father...'} /></div>
          </>}
          <div><label className="label">{direct ? 'Phone number' : 'New value'}</label><input className="input" value={req.value} onChange={(e) => setReq({ ...req, value: e.target.value })} placeholder={direct ? '+91 98200 12345' : 'What it should be changed to'} /></div>
          {!direct && <p className="text-[11px] text-muted">This raises an HR Records ticket. Upload the proof (address proof, bank letter or ID) in the Document Center.</p>}
        </div>
      </Modal>
    </>
  )
}

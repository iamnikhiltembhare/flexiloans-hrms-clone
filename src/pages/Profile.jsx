import { useState } from 'react'
import { Mail, Phone, MapPin, Pencil } from 'lucide-react'
import { PageHeader, Card, Badge, Avatar, Field, Tabs, Table, statusTone } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/DataContext.jsx'
import Modal from '../components/Modal.jsx'
import { leaveBalances, payslips, INR } from '../data/mock.js'
import { BRAND } from '../lib/brand.js'

export default function Profile() {
  const { user } = useAuth()
  const { documents, toast, notify } = useApp()
  const [tab, setTab] = useState('Personal')
  const [open, setOpen] = useState(false)
  const [req, setReq] = useState({ field: 'Personal mobile', value: '', note: '' })

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

      <Tabs tabs={['Personal', 'Employment', 'Payroll & bank', 'Leave', 'Documents']} active={tab} onChange={setTab} />

      {tab === 'Personal' && (
        <Card title="Personal information">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Full name" value={user?.name} />
            <Field label="Date of birth" value={user?.dob} />
            <Field label="Gender" value={user?.gender} />
            <Field label="Blood group" value={user?.bloodGroup} />
            <Field label="Personal mobile" value={user?.phone} />
            <Field label="Official email" value={user?.email} />
            <Field label="Current address" value="Andheri East, Mumbai 400069" />
            <Field label="Emergency contact" value="Sunita Tembhare - +91 98330 22118" />
            <Field label="Relationship" value="Spouse" />
          </div>
        </Card>
      )}

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

      <Modal open={open} onClose={() => setOpen(false)} title="Request a profile change" subtitle="HR Ops reviews changes to your record"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={() => {
            notify({ title: 'Profile change requested', detail: req.field + ' - pending HR Ops review', to: '/profile', kind: 'task' })
            toast('Request sent', req.field + ' change is pending HR Ops review')
            setReq({ field: 'Personal mobile', value: '', note: '' })
            setOpen(false)
          }}>Send request</button>
        </>}>
        <div className="grid gap-3">
          <div><label className="label">Field</label>
            <select className="input" value={req.field} onChange={(e) => setReq({ ...req, field: e.target.value })}>
              <option>Personal mobile</option><option>Current address</option><option>Emergency contact</option>
              <option>Bank account</option><option>Name spelling</option>
            </select>
          </div>
          <div><label className="label">New value</label><input className="input" value={req.value} onChange={(e) => setReq({ ...req, value: e.target.value })} placeholder="What it should be changed to" /></div>
          <div><label className="label">Note for HR</label><textarea className="input min-h-[80px]" value={req.note} onChange={(e) => setReq({ ...req, note: e.target.value })} /></div>
        </div>
      </Modal>
    </>
  )
}

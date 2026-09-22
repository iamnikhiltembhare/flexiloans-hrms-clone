import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, MapPin } from 'lucide-react'
import { Card, Badge, Avatar, Field, Tabs, Table, statusTone, Progress } from '../components/ui.jsx'
import { attendanceLog, goals, documents } from '../data/mock.js'
import { useApp } from '../context/DataContext.jsx'

export default function EmployeeDetail() {
  const { id } = useParams()
  const { employees, leaveRequests, toast } = useApp()
  const emp = employees.find((e) => e.id === id)
  const [tab, setTab] = useState('Overview')

  if (!emp) return (
    <Card><p className="text-[13px] text-muted">No employee found with ID {id}. <Link className="text-cyan hover:underline" to="/employees">Back to directory</Link></p></Card>
  )

  return (
    <>
      <Link to="/employees" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-navy mb-3">
        <ArrowLeft size={14} /> Back to directory
      </Link>

      <Card className="mb-4" bodyClass="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={emp.name} size={62} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="h1">{emp.name}</h1>
              <Badge tone={statusTone(emp.status)}>{emp.status}</Badge>
            </div>
            <p className="text-[13px] text-muted">{emp.designation} - {emp.department}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-[12px] text-muted">
              <span className="flex items-center gap-1.5"><Mail size={12} />{emp.email}</span>
              <span className="flex items-center gap-1.5"><Phone size={12} />{emp.phone}</span>
              <span className="flex items-center gap-1.5"><MapPin size={12} />{emp.location}</span>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary" onClick={() => toast('Message sent', 'A note was sent to ' + emp.name + ' on email', 'info')}>Message</button>
            <button className="btn-primary" onClick={() => toast('Edit request raised', 'HR Ops will review changes to ' + emp.name + "'s record")}>Edit profile</button>
          </div>
        </div>
      </Card>

      <Tabs tabs={['Overview', 'Attendance', 'Leave', 'Performance', 'Documents']} active={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Employment details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Employee ID" value={emp.id} />
              <Field label="Date of joining" value={emp.joinDate} />
              <Field label="Reporting manager" value={emp.manager} />
              <Field label="Employment type" value={emp.employmentType} />
              <Field label="Department" value={emp.department} />
              <Field label="Designation" value={emp.designation} />
              <Field label="Work location" value={emp.location} />
              <Field label="Total experience" value={emp.experience} />
            </div>
          </Card>
          <Card title="Personal details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Gender" value={emp.gender} />
              <Field label="Official email" value={emp.email} />
              <Field label="Mobile" value={emp.phone} />
              <Field label="Status" value={emp.status} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'Attendance' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'date', header: 'Date', mono: true },
              { key: 'day', header: 'Day' },
              { key: 'checkIn', header: 'Check in', mono: true },
              { key: 'checkOut', header: 'Check out', mono: true },
              { key: 'hours', header: 'Hours', mono: true },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
            ]}
            rows={attendanceLog}
          />
        </Card>
      )}

      {tab === 'Leave' && (
        <Card bodyClass="p-0">
          <Table
            columns={[
              { key: 'id', header: 'Request', mono: true },
              { key: 'type', header: 'Type' },
              { key: 'from', header: 'From', mono: true },
              { key: 'to', header: 'To', mono: true },
              { key: 'days', header: 'Days', align: 'right', mono: true },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
            ]}
            rows={leaveRequests.slice(0, 5)}
          />
        </Card>
      )}

      {tab === 'Performance' && (
        <Card title="Current cycle goals">
          <div className="space-y-4">
            {goals.map((g) => (
              <div key={g.title}>
                <div className="flex justify-between gap-3 text-[13px] mb-1.5">
                  <span className="text-[#374151]">{g.title}</span>
                  <span className="font-mono text-navy shrink-0">{g.progress}%</span>
                </div>
                <Progress value={g.progress} color={g.status === 'On Track' ? '#16A34A' : g.status === 'At Risk' ? '#D97706' : '#DC2626'} />
              </div>
            ))}
          </div>
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
    </>
  )
}

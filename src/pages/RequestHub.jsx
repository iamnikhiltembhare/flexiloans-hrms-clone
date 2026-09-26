import { useMemo, useState } from 'react'
import { Layers, Clock, CheckCircle2, Send, Frame } from 'lucide-react'
import { PageHeader, Card, Table, Badge, Tabs, SearchInput, Select, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { requestTypes } from '../data/engage.js'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePersistentState } from '../lib/persist.js'

const CATEGORIES = ['All categories', ...new Set(requestTypes.map((r) => r.category))]

export default function RequestHub() {
  const { toast, notify } = useApp()
  const { user } = useAuth()
  const [tab, setTab] = useState('Apply')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All categories')
  const [requests, setRequests] = usePersistentState('hubRequests', [])
  const [pick, setPick] = useState(null)
  const [note, setNote] = useState('')

  const types = useMemo(() => requestTypes.filter((r) =>
    (r.name + r.desc).toLowerCase().includes(q.toLowerCase())
    && (cat === 'All categories' || r.category === cat)
  ), [q, cat])

  const pending = requests.filter((r) => r.status === 'Pending')
  const closed = requests.filter((r) => r.status !== 'Pending')

  const submit = () => {
    const id = 'RQ-' + (4100 + requests.length)
    setRequests((l) => [{
      id, type: pick.name, category: pick.category, note: note.trim() || '--',
      raised: new Date().toISOString().slice(0, 10), status: 'Pending', sla: pick.sla, owner: user.manager,
    }, ...l])
    notify({ title: 'Request raised', detail: pick.name + ' - ' + id, to: '/requests', kind: 'task' })
    toast('Request raised', id + ' sent to ' + user.manager)
    setPick(null); setNote(''); setTab('Pending')
  }

  const close = (id) => {
    setRequests((l) => l.map((r) => (r.id === id ? { ...r, status: 'Withdrawn' } : r)))
    toast('Request withdrawn', id + ' has been closed', 'warning')
  }

  const cols = [
    { key: 'id', header: 'Request', mono: true },
    { key: 'type', header: 'Type' },
    { key: 'category', header: 'Category', render: (r) => <Badge tone="blue">{r.category}</Badge> },
    { key: 'raised', header: 'Raised on', mono: true },
    { key: 'sla', header: 'SLA' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  ]

  return (
    <>
      <PageHeader title="Request Hub" subtitle="Raise and track workplace requests" />

      <div className="grid gap-4 sm:grid-cols-3 mb-4 stagger">
        <Card bodyClass="p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] uppercase tracking-wide text-faint">Request types</p>
              <p className="text-2xl font-semibold text-navy font-mono mt-1">{requestTypes.length}</p></div>
            <span className="grid place-items-center h-9 w-9 rounded-lg bg-cyan-bg text-[#0097B2]"><Layers size={17} /></span>
          </div>
        </Card>
        <Card bodyClass="p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] uppercase tracking-wide text-faint">Pending</p>
              <p className="text-2xl font-semibold text-navy font-mono mt-1">{pending.length}</p></div>
            <span className="grid place-items-center h-9 w-9 rounded-lg bg-[rgba(217,119,6,0.1)] text-[#D97706]"><Clock size={17} /></span>
          </div>
        </Card>
        <Card bodyClass="p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] uppercase tracking-wide text-faint">Closed</p>
              <p className="text-2xl font-semibold text-navy font-mono mt-1">{closed.length}</p></div>
            <span className="grid place-items-center h-9 w-9 rounded-lg bg-[rgba(22,163,74,0.1)] text-[#16A34A]"><CheckCircle2 size={17} /></span>
          </div>
        </Card>
      </div>

      <Tabs tabs={['Apply', 'Pending', 'Closed']} active={tab} onChange={setTab} />

      {tab === 'Apply' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="w-full sm:w-64"><SearchInput value={q} onChange={setQ} placeholder="Search request types..." /></div>
            <Select value={cat} onChange={setCat} options={CATEGORIES} />
          </div>

          {types.length === 0 ? (
            <Card bodyClass="p-12">
              <div className="text-center">
                <Frame size={40} className="mx-auto text-faint mb-3" />
                <p className="text-[14px] font-medium text-navy">It's empty in here!</p>
                <p className="text-[12px] text-muted mt-1">No request types match your search.</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger">
              {types.map((r) => (
                <Card key={r.name} bodyClass="p-4">
                  <Badge tone="blue">{r.category}</Badge>
                  <p className="text-[13px] font-semibold text-navy mt-2">{r.name}</p>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed min-h-[2.4rem]">{r.desc}</p>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-line">
                    <span className="text-[10px] text-faint">SLA {r.sla}</span>
                    <button className="btn-primary px-2.5 py-1" onClick={() => setPick(r)}>Apply</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'Pending' && (
        <Card bodyClass="p-0">
          <Table
            columns={[...cols, { key: 'a', header: '', align: 'right', render: (r) => (
              <button className="btn-ghost px-2 py-1" onClick={() => close(r.id)}>Withdraw</button>
            )}]}
            rows={pending}
            empty="Nothing pending. Raise a request from the Apply tab."
          />
        </Card>
      )}

      {tab === 'Closed' && (
        <Card bodyClass="p-0">
          <Table columns={cols} rows={closed} empty="No closed requests yet." />
        </Card>
      )}

      <Modal open={Boolean(pick)} onClose={() => setPick(null)} title={pick?.name}
        subtitle={pick ? pick.category + ' - SLA ' + pick.sla : ''}
        footer={<>
          <button className="btn-ghost" onClick={() => setPick(null)}>Cancel</button>
          <button className="btn-primary" onClick={submit}><Send size={13} /> Raise request</button>
        </>}>
        {pick && (
          <div className="grid gap-3">
            <p className="text-[12px] text-muted">{pick.desc}</p>
            <div><label className="label">Details</label>
              <textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Anything your approver should know" />
            </div>
            <div className="rounded-lg border-l-[3px] border-cyan bg-cyan-bg px-3.5 py-2.5">
              <p className="text-[12px] text-body">Goes to <strong className="text-navy">{user.manager}</strong> for approval.</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

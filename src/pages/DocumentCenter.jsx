import { useState } from 'react'
import {
  Wallet, FileSpreadsheet, BookOpen, FileText, Upload, Download, Mail, Plus, ChevronRight,
} from 'lucide-react'
import { PageHeader, Card, Table, Badge, Tabs, statusTone } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { documentCategories, letterTypes, letterRequests } from '../data/engage.js'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { downloadFile } from '../lib/download.js'
import { usePersistentState } from '../lib/persist.js'

const ICONS = { payslip: Wallet, tax: FileSpreadsheet, policy: BookOpen, form: FileText }
const TONES = { payslip: 'cyan', tax: 'green', policy: 'purple', form: 'amber' }

export default function DocumentCenter() {
  const { documents, addDocument, toast, notify } = useApp()
  const { user } = useAuth()
  const [tab, setTab] = useState('Documents')
  const [letters, setLetters] = usePersistentState('letterRequests', letterRequests)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type: letterTypes[0], purpose: '' })
  const [category, setCategory] = useState(null)

  const raiseLetter = () => {
    const id = 'LTR-' + (2042 + letters.length - letterRequests.length)
    setLetters((l) => [{ id, type: form.type, raised: new Date().toISOString().slice(0, 10), status: 'Pending', remarks: 'With HR Ops' }, ...l])
    notify({ title: 'Letter requested', detail: form.type + ' - ' + id, to: '/document-center', kind: 'task' })
    toast('Letter requested', id + ' sent to HR Ops')
    setForm({ type: letterTypes[0], purpose: '' }); setOpen(false)
  }

  const grab = (name) => {
    downloadFile(name.replace(/\s+/g, '-').toLowerCase() + '.txt',
      'FlexiLoans HRMS demo document\n\n' + name + '\nIssued to: ' + user.name + '\n\nPlaceholder content from the demo build.')
    toast('Download started', name + ' (demo placeholder)', 'info')
  }

  const pending = letters.filter((l) => l.status === 'Pending').length
  const closed = letters.filter((l) => l.status === 'Closed').length

  return (
    <>
      <PageHeader
        title="Document Center"
        subtitle="Everything issued to you, in one place"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={13} /> Request a letter</button>}
      />

      {/* Hero */}
      <Card className="mb-4" bodyClass="p-0">
        <div className="flex items-center gap-6 px-6 py-5 bg-[linear-gradient(100deg,#E0F7FA_0%,#F5F7FA_60%)]">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-navy">We've got it sorted for you!</h2>
            <p className="text-[13px] text-[#374151] mt-1.5">All documents are now in one place.</p>
            <p className="text-[13px] text-[#374151]">
              You can request a new letter if you don't find the one you were looking for.
            </p>
          </div>
          <svg width="120" height="88" viewBox="0 0 120 88" className="hidden sm:block shrink-0" aria-hidden="true">
            <rect x="62" y="8" width="46" height="60" rx="4" fill="#fff" stroke="#00B4D8" strokeWidth="2" />
            <path d="M70 22h30M70 32h30M70 42h20" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="30" cy="26" r="9" fill="#1B365D" />
            <path d="M16 72c0-9 6-16 14-16s14 7 14 16z" fill="#1B365D" />
            <path d="M44 48l14-6" stroke="#00B4D8" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </Card>

      <Tabs tabs={['Documents', 'Letter requests']} active={tab} onChange={setTab} />

      {tab === 'Documents' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4 stagger">
            {documentCategories.map((c) => {
              const Icon = ICONS[c.icon] || FileText
              const tone = TONES[c.icon] || 'cyan'
              const ring = { cyan: 'bg-cyan-bg text-[#0097B2]', green: 'bg-[rgba(22,163,74,0.1)] text-[#16A34A]',
                purple: 'bg-[rgba(124,58,237,0.1)] text-[#7C3AED]', amber: 'bg-[rgba(217,119,6,0.1)] text-[#D97706]' }[tone]
              return (
                <Card key={c.name} bodyClass="p-4">
                  <div className="flex items-start gap-3">
                    <span className={'grid place-items-center h-10 w-10 rounded-lg shrink-0 ' + ring}><Icon size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-navy">{c.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">{c.note}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-line">
                    <span className="text-[11px] text-faint font-mono">{c.count} files</span>
                    <button className="flex items-center gap-1 text-[12px] text-cyan hover:underline"
                      onClick={() => setCategory(c)}>
                      View All <ChevronRight size={12} />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>

          <Card title="My documents" subtitle="Uploaded to your personal vault" bodyClass="p-0"
            actions={<label className="btn-secondary cursor-pointer">
              <Upload size={13} /> Upload
              <input type="file" multiple className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                files.forEach((f) => addDocument({
                  name: f.name, category: 'Onboarding',
                  size: f.size < 1048576 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB',
                }))
                toast('Upload complete', files.length + ' file' + (files.length > 1 ? 's' : '') + ' sent for verification')
                e.target.value = ''
              }} />
            </label>}>
            <Table
              columns={[
                { key: 'name', header: 'Document', render: (r) => (
                  <span className="flex items-center gap-2">
                    <FileText size={14} className="text-[#DC2626] shrink-0" />
                    <span className="text-[13px] text-navy">{r.name}</span>
                  </span>
                )},
                { key: 'category', header: 'Category', render: (r) => <Badge tone="blue">{r.category}</Badge> },
                { key: 'size', header: 'Size', mono: true },
                { key: 'uploaded', header: 'Uploaded', mono: true },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
                { key: 'a', header: '', align: 'right', render: (r) => (
                  <button className="btn-ghost px-2 py-1" onClick={() => grab(r.name)}><Download size={12} /></button>
                )},
              ]}
              rows={documents}
            />
          </Card>
        </>
      )}

      {tab === 'Letter requests' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-4 stagger">
            <Card bodyClass="p-4">
              <p className="text-[10px] uppercase tracking-wide text-faint">Pending</p>
              <p className="text-2xl font-semibold text-navy font-mono mt-1">{pending}</p>
            </Card>
            <Card bodyClass="p-4">
              <p className="text-[10px] uppercase tracking-wide text-faint">Closed</p>
              <p className="text-2xl font-semibold text-navy font-mono mt-1">{closed}</p>
            </Card>
            <Card bodyClass="p-4">
              <p className="text-[10px] uppercase tracking-wide text-faint">Letter types available</p>
              <p className="text-2xl font-semibold text-navy font-mono mt-1">{letterTypes.length}</p>
            </Card>
          </div>

          <Card bodyClass="p-0"
            actions={<button className="btn-primary" onClick={() => setOpen(true)}><Mail size={13} /> New request</button>}>
            <Table
              columns={[
                { key: 'id', header: 'Request', mono: true },
                { key: 'type', header: 'Letter type' },
                { key: 'raised', header: 'Raised on', mono: true },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
                { key: 'remarks', header: 'Remarks' },
                { key: 'a', header: '', align: 'right', render: (r) => r.status === 'Closed'
                  ? <button className="btn-ghost px-2 py-1" onClick={() => grab(r.type)}><Download size={12} /> Letter</button>
                  : null },
              ]}
              rows={letters}
              empty="No letter requests yet."
            />
          </Card>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Request a letter"
        subtitle="HR Ops usually issue these within 3 working days"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={raiseLetter}>Submit request</button>
        </>}>
        <div className="grid gap-3">
          <div><label className="label">Letter type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {letterTypes.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="label">Purpose</label>
            <textarea className="input min-h-[80px]" value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="Bank account opening, visa application, rental agreement..." />
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(category)} onClose={() => setCategory(null)} title={category?.name}
        subtitle={category?.note}>
        {category && (
          <div className="space-y-2">
            {Array.from({ length: Math.min(6, category.count) }, (_, i) => `${category.name} ${2026 - Math.floor(i / 2)}-${String(12 - i).padStart(2, '0')}.pdf`).map((n) => (
              <div key={n} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-[#DC2626] shrink-0" />
                  <span className="text-[12px] text-navy truncate">{n}</span>
                </span>
                <button className="btn-ghost px-2 py-1 shrink-0" onClick={() => grab(n)}><Download size={12} /></button>
              </div>
            ))}
            {category.count > 6 && <p className="text-[11px] text-faint text-center pt-1">and {category.count - 6} more</p>}
          </div>
        )}
      </Modal>
    </>
  )
}

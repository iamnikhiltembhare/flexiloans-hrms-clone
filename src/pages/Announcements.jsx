import { useState } from 'react'
import { Pin, Plus } from 'lucide-react'
import { PageHeader, Card, Badge, Tabs, Avatar } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { useApp } from '../context/DataContext.jsx'

const TAGS = ['Policy', 'Performance', 'Benefits', 'Event', 'Compliance']
const TAG_TONE = { Policy: 'cyan', Performance: 'purple', Benefits: 'green', Event: 'blue', Compliance: 'amber' }
const BLANK = { title: '', body: '', tag: 'Policy' }

export default function Announcements() {
  const { announcements, addAnnouncement, toast, notify } = useApp()
  const [tab, setTab] = useState('All')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [err, setErr] = useState('')

  const tabs = ['All', 'Pinned', ...TAGS]
  const list = announcements.filter((a) => (tab === 'All' ? true : tab === 'Pinned' ? a.pinned : a.tag === tab))

  const post = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) { setErr('A title and a message are both required.'); return }
    addAnnouncement({ title: form.title.trim(), body: form.body.trim(), tag: form.tag })
    notify({ title: 'Announcement published', detail: form.title.trim(), to: '/announcements', kind: 'info' })
    toast('Announcement published', 'Everyone in the organisation can see it now')
    setForm(BLANK); setErr(''); setOpen(false); setTab('All')
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Company-wide updates from HR, Compliance and Leadership"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={13} /> New announcement</button>}
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="space-y-3">
        {list.map((a) => (
          <Card key={a.id} bodyClass="p-4">
            <div className="flex items-start gap-3">
              <Avatar name={a.author} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <h2 className="h2 flex items-center gap-2">
                    {a.pinned && <Pin size={13} className="text-cyan shrink-0" />}
                    {a.title}
                  </h2>
                  <Badge tone={TAG_TONE[a.tag] || 'gray'}>{a.tag}</Badge>
                </div>
                <p className="text-[13px] text-[#374151] mt-1.5 leading-relaxed whitespace-pre-line">{a.body}</p>
                <p className="text-[11px] text-faint mt-2.5">Posted by {a.author} on {a.date}</p>
              </div>
            </div>
          </Card>
        ))}
        {list.length === 0 && <Card><p className="text-[13px] text-muted text-center py-6">No announcements in this category.</p></Card>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New announcement" subtitle="Visible to all employees"
        footer={<>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={post}>Publish</button>
        </>}>
        <form onSubmit={post} className="grid gap-3">
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={set('title')} placeholder="What is this about?" /></div>
          <div><label className="label">Category</label>
            <select className="input" value={form.tag} onChange={set('tag')}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div><label className="label">Message *</label><textarea className="input min-h-[120px]" value={form.body} onChange={set('body')} placeholder="Write the announcement" /></div>
          {err && <p className="text-[12px] text-[#DC2626]">{err}</p>}
        </form>
      </Modal>
    </>
  )
}

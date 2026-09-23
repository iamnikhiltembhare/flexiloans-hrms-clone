import { useMemo, useState } from 'react'
import { Heart, MessageCircle, Send, Image, Search, ChevronDown, Sparkles } from 'lucide-react'
import { PageHeader, Card, Badge, Avatar, SearchInput } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/DataContext.jsx'
import {
  posts as seedPosts, seedComments, feedGroups, feedLocations, feedDepartments,
} from '../data/engage.js'
import { usePersistentState } from '../lib/persist.js'

function Accordion({ title, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-line pt-2.5 mt-2.5">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[12px] font-medium text-navy">
        {title}
        <ChevronDown size={13} className={'text-muted transition-transform duration-200 ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-[12px] text-[#374151] cursor-pointer py-0.5">
              <input type="radio" name={title} checked={value === o} onChange={() => onChange(o)}
                className="accent-cyan" />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Engage() {
  const { user } = useAuth()
  const { toast, notify } = useApp()

  const [feed, setFeed] = usePersistentState('engageFeed', seedPosts)
  const [comments, setComments] = usePersistentState('engageComments', seedComments)
  const [activity, setActivity] = useState('All Activities')
  const [group, setGroup] = useState('All Groups')
  const [location, setLocation] = useState('All Locations')
  const [department, setDepartment] = useState('All Departments')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('Newest first')
  const [draft, setDraft] = useState('')
  const [composing, setComposing] = useState(false)
  const [openComments, setOpenComments] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')

  const shown = useMemo(() => {
    let list = feed.filter((p) =>
      (p.body + p.author + p.group).toLowerCase().includes(q.toLowerCase())
      && (group === 'All Groups' || p.group === group)
      && (location === 'All Locations' || p.location === location || p.location === 'All Locations')
      && (department === 'All Departments' || p.department === department)
      && (activity === 'All Activities' || p.kind === 'Post')
    )
    if (sort === 'Oldest first') list = [...list].reverse()
    return list
  }, [feed, q, group, location, department, activity, sort])

  const react = (id) => setFeed((l) => l.map((p) => (p.id === id
    ? { ...p, reacted: !p.reacted, reactions: p.reactions + (p.reacted ? -1 : 1) }
    : p)))

  const publish = () => {
    if (!draft.trim()) return
    const id = 'P-' + (105 + feed.length - seedPosts.length)
    setFeed((l) => [{
      id, author: user.name, avatarName: user.name,
      group: group === 'All Groups' ? 'Announcements' : group,
      location: user.location || 'Mumbai HQ', department: user.department || 'Product',
      kind: 'Post', time: 'Just now', body: draft.trim(),
      reactions: 0, comments: 0, reacted: false,
    }, ...l])
    notify({ title: 'Post published', detail: 'Your update is live on the Engage feed', to: '/engage', kind: 'info' })
    toast('Posted', 'Your update is now on the feed')
    setDraft(''); setComposing(false)
  }

  const addComment = (id) => {
    if (!commentDraft.trim()) return
    setComments((c) => ({ ...c, [id]: [...(c[id] || []), { author: user.name, time: 'Just now', body: commentDraft.trim() }] }))
    setFeed((l) => l.map((p) => (p.id === id ? { ...p, comments: p.comments + 1 } : p)))
    setCommentDraft('')
    toast('Comment added')
  }

  return (
    <>
      <PageHeader title="Engage" subtitle="What is happening across FlexiLoans" />

      {/* Composer */}
      <Card className="mb-4" bodyClass="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-navy">Hey {user.shortName || user.name.split(' ')[0]},</p>
            <p className="text-[12px] text-muted">Ready to dive in?</p>
          </div>
          <button onClick={() => setComposing((v) => !v)}
            className="shrink-0 rounded-card border border-line px-4 py-3 text-center hover:border-cyan hover:bg-cyan-bg/40 transition-colors">
            <Image size={18} className="mx-auto text-cyan" />
            <span className="block text-[11px] text-muted mt-1">Create Post</span>
          </button>
        </div>

        {composing && (
          <div className="mt-3 pt-3 border-t border-line">
            <textarea className="input min-h-[90px]" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder="Share an update with your colleagues" />
            <div className="flex justify-end gap-2 mt-2">
              <button className="btn-ghost" onClick={() => { setDraft(''); setComposing(false) }}>Cancel</button>
              <button className="btn-primary" onClick={publish}><Send size={13} /> Post</button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        {/* Filter rail */}
        <Card title="Filters" bodyClass="p-3.5" className="h-fit">
          <p className="text-[12px] font-medium text-navy mb-2">Activities</p>
          {['All Activities', 'Posts'].map((a) => (
            <label key={a} className="flex items-center gap-2 text-[12px] text-[#374151] cursor-pointer py-0.5">
              <input type="radio" name="activity" checked={activity === a}
                onChange={() => setActivity(a)} className="accent-cyan" />
              {a}
            </label>
          ))}

          <div className="mt-3"><SearchInput value={q} onChange={setQ} placeholder="Search" /></div>

          <Accordion title="Groups" options={feedGroups} value={group} onChange={setGroup} />
          <Accordion title="Location" options={feedLocations} value={location} onChange={setLocation} />
          <Accordion title="Department" options={feedDepartments} value={department} onChange={setDepartment} />

          {(group !== 'All Groups' || location !== 'All Locations' || department !== 'All Departments' || q) && (
            <button className="btn-ghost w-full justify-center mt-3"
              onClick={() => { setGroup('All Groups'); setLocation('All Locations'); setDepartment('All Departments'); setQ('') }}>
              Reset filters
            </button>
          )}
        </Card>

        {/* Feed */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[13px] font-medium text-navy">
              {activity} - {group}
              <span className="text-muted font-normal"> ({shown.length})</span>
            </p>
            <label className="flex items-center gap-1.5 text-[11px] text-muted">
              Sort:
              <select className="input py-1 text-xs w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option>Newest first</option><option>Oldest first</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            {shown.length === 0 && (
              <Card bodyClass="p-10">
                <div className="text-center">
                  <Sparkles size={26} className="mx-auto text-faint mb-2" />
                  <p className="text-[13px] text-muted">Nothing here yet. Try clearing a filter.</p>
                </div>
              </Card>
            )}

            {shown.map((p) => (
              <Card key={p.id} bodyClass="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={p.avatarName} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[13px] font-semibold text-navy">{p.author}</p>
                        <p className="text-[11px] text-muted">Group: {p.group}</p>
                      </div>
                      <span className="text-[11px] text-faint whitespace-nowrap">{p.time}</span>
                    </div>

                    <p className="text-[13px] text-[#374151] mt-2 leading-relaxed">{p.body}</p>

                    {p.highlight && (
                      <div className="mt-3 rounded-card bg-cyan-bg/60 border border-cyan/20 px-4 py-5 text-center">
                        <p className="text-[15px] font-semibold text-navy">{p.highlight}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-line">
                      <button onClick={() => react(p.id)}
                        className={'flex items-center gap-1.5 text-[12px] transition-colors ' +
                          (p.reacted ? 'text-[#DC2626]' : 'text-muted hover:text-navy')}>
                        <Heart size={14} className={p.reacted ? 'fill-[#DC2626]' : ''} />
                        {p.reactions > 0 ? p.reactions : ''} Reaction{p.reactions === 1 ? '' : 's'}
                      </button>
                      <button onClick={() => setOpenComments(openComments === p.id ? null : p.id)}
                        className="flex items-center gap-1.5 text-[12px] text-muted hover:text-navy">
                        <MessageCircle size={14} />
                        {p.comments > 0 ? p.comments : ''} Comment{p.comments === 1 ? '' : 's'}
                      </button>
                    </div>

                    {openComments === p.id && (
                      <div className="mt-3 space-y-2.5">
                        {(comments[p.id] || []).map((c, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <Avatar name={c.author} size={26} />
                            <div className="min-w-0 flex-1 rounded-lg bg-canvas px-3 py-2">
                              <p className="text-[12px] font-medium text-navy">{c.author}
                                <span className="text-[10px] text-faint font-normal ml-2">{c.time}</span>
                              </p>
                              <p className="text-[12px] text-[#374151] mt-0.5">{c.body}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <Avatar name={user.name} size={26} />
                          <input className="input py-1.5 text-xs" value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addComment(p.id) }}
                            placeholder="Write a comment..." />
                          <button className="btn-primary px-2 py-1.5" onClick={() => addComment(p.id)}>
                            <Send size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

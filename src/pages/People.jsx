import { useMemo, useState } from 'react'
import { Star, Mail, Phone, MapPin, Users, Network } from 'lucide-react'
import { PageHeader, Card, Badge, Avatar, SearchInput, Select } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import { departments, locations } from '../data/mock.js'
import { useApp } from '../context/DataContext.jsx'
import { usePersistentState } from '../lib/persist.js'

/** Compact person row used in both the starred rail and the main list. */
function PersonRow({ p, starred, onStar, onOpen }) {
  return (
    <div className="lift flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-canvas">
      <button onClick={() => onOpen(p)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
        <Avatar name={p.name} size={32} />
        <span className="min-w-0">
          <span className="block text-[12px] font-medium text-navy truncate">{p.name}</span>
          <span className="block text-[10px] text-muted truncate">{p.designation}</span>
        </span>
      </button>
      <button onClick={() => onStar(p.id)} aria-label="Star"
        className="shrink-0 transition-transform duration-150 hover:scale-110">
        <Star size={14} className={starred ? 'text-[#D97706] fill-[#D97706]' : 'text-faint'} />
      </button>
    </div>
  )
}

export default function People() {
  const { employees, toast } = useApp()
  const [view, setView] = useState('Directory')
  const [tab, setTab] = useState('Everyone')
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('All departments')
  const [loc, setLoc] = useState('All locations')
  const [starred, setStarred] = usePersistentState('starredPeople', [])
  const [open, setOpen] = useState(null)

  const list = useMemo(() => employees.filter((e) =>
    (e.name + e.designation + e.department + e.id).toLowerCase().includes(q.toLowerCase())
    && (dept === 'All departments' || e.department === dept)
    && (loc === 'All locations' || e.location === loc)
  ), [employees, q, dept, loc])

  const shown = tab === 'Starred' ? list.filter((e) => starred.includes(e.id)) : list

  const toggleStar = (id) => setStarred((s) => {
    const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    toast(s.includes(id) ? 'Removed from starred' : 'Added to starred')
    return next
  })

  // Org chart: group by department, first manager-looking title heads the branch
  const tree = useMemo(() => departments.map((d) => {
    const members = employees.filter((e) => e.department === d)
    const head = members.find((m) => /manager|head|lead|controller|director/i.test(m.designation)) || members[0]
    return { dept: d, head, members: members.filter((m) => m !== head) }
  }).filter((b) => b.head), [employees])

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${employees.length} colleagues across ${new Set(employees.map((e) => e.location)).size} locations`}
        actions={
          <span className="flex rounded-lg border border-line overflow-hidden">
            {['Directory', 'Org Chart'].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={'flex items-center gap-1.5 px-3 py-1.5 text-[12px] transition-colors ' +
                  (view === v ? 'bg-cyan text-white' : 'text-muted hover:bg-canvas')}>
                {v === 'Directory' ? <Users size={13} /> : <Network size={13} />} {v}
              </button>
            ))}
          </span>
        }
      />

      {view === 'Directory' ? (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <Card bodyClass="p-3" className="h-fit">
            <div className="flex gap-4 border-b border-line mb-3">
              {['Starred', 'Everyone'].map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={'relative pb-2 text-[13px] ' + (tab === t ? 'text-navy font-medium' : 'text-muted hover:text-navy')}>
                  {t}
                  <span className={'absolute left-0 -bottom-px h-0.5 rounded-full bg-cyan transition-all duration-300 ' +
                    (tab === t ? 'w-full' : 'w-0')} />
                </button>
              ))}
            </div>

            <SearchInput value={q} onChange={setQ} placeholder="Enter Emp. Name or ID" />
            <div className="flex gap-2 mt-2">
              <Select value={dept} onChange={setDept} options={['All departments', ...departments]} className="flex-1 min-w-0" />
              <Select value={loc} onChange={setLoc} options={['All locations', ...locations]} className="flex-1 min-w-0" />
            </div>

            <div className="mt-3 max-h-[26rem] overflow-y-auto">
              {shown.length === 0 && (
                <p className="text-[12px] text-muted text-center py-6">
                  {tab === 'Starred' ? "Looks like you don't have any records" : 'No colleagues match these filters.'}
                </p>
              )}
              {shown.map((p) => (
                <PersonRow key={p.id} p={p} starred={starred.includes(p.id)} onStar={toggleStar} onOpen={setOpen} />
              ))}
            </div>
          </Card>

          {tab === 'Starred' && starred.length === 0 ? (
            <Card bodyClass="p-12">
              <div className="text-center">
                <Star size={46} className="mx-auto text-[#D97706]/30 mb-3" />
                <p className="text-[13px] text-muted">Hey, you haven't starred any peers!</p>
                <p className="text-[11px] text-faint mt-1">
                  Star a colleague from the list to keep them handy here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.slice(0, 12).map((p) => (
                <Card key={p.id} bodyClass="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={p.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-navy truncate">{p.name}</p>
                      <p className="text-[11px] text-muted">{p.designation}</p>
                      <Badge tone="blue">{p.department}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-line space-y-1.5 text-[11px] text-muted">
                    <p className="flex items-center gap-1.5 truncate"><Mail size={11} />{p.email}</p>
                    <p className="flex items-center gap-1.5"><Phone size={11} />{p.phone}</p>
                    <p className="flex items-center gap-1.5"><MapPin size={11} />{p.location}</p>
                  </div>
                </Card>
              ))}
              {shown.length > 12 && (
                <Card bodyClass="p-6"><p className="text-[12px] text-muted text-center">
                  and {shown.length - 12} more - narrow the filters to see them
                </p></Card>
              )}
            </div>
          )}
        </div>
      ) : (
        <Card title="Organisation chart" subtitle="Reporting structure by department">
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[52rem]">
              {/* Root */}
              <div className="flex justify-center">
                <div className="rounded-card border-2 border-brand bg-brand text-white px-5 py-3 text-center">
                  <p className="text-[13px] font-semibold">Rakesh Menon</p>
                  <p className="text-[10px] text-white/60">Chief Executive Officer</p>
                </div>
              </div>
              <div className="h-6 w-px bg-line mx-auto" />
              <div className="h-px bg-line w-[86%] mx-auto" />

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-0">
                {tree.map((b) => (
                  <div key={b.dept} className="flex flex-col items-center">
                    <div className="h-6 w-px bg-line" />
                    <div className="rounded-card border border-cyan bg-cyan-bg/50 px-3 py-2.5 text-center w-full">
                      <Avatar name={b.head.name} size={30} />
                      <p className="text-[12px] font-medium text-navy mt-1.5 truncate">{b.head.name}</p>
                      <p className="text-[10px] text-muted truncate">{b.head.designation}</p>
                      <Badge tone="cyan">{b.dept}</Badge>
                    </div>

                    {b.members.slice(0, 3).map((m) => (
                      <div key={m.id} className="w-full flex flex-col items-center">
                        <div className="h-4 w-px bg-line" />
                        <button onClick={() => setOpen(m)}
                          className="lift rounded-lg border border-line bg-surface px-2.5 py-2 w-full text-center hover:border-cyan">
                          <p className="text-[11px] font-medium text-navy truncate">{m.name}</p>
                          <p className="text-[9px] text-muted truncate">{m.designation}</p>
                        </button>
                      </div>
                    ))}
                    {b.members.length > 3 && (
                      <p className="text-[10px] text-faint mt-1.5">+{b.members.length - 3} more</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name} subtitle={open?.designation}>
        {open && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-3">
              <Avatar name={open.name} size={54} />
              <div>
                <p className="text-[13px] font-semibold text-navy">{open.name}</p>
                <p className="text-[12px] text-muted">{open.designation}</p>
                <Badge tone="blue">{open.department}</Badge>
              </div>
            </div>
            {[['Employee ID', open.id], ['Email', open.email], ['Mobile', open.phone],
              ['Location', open.location], ['Reporting to', open.manager], ['Date of joining', open.joinDate]].map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] uppercase tracking-wide text-faint">{k}</p>
                <p className="text-[13px] text-body mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}

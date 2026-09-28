import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Send, Download, Check, X, Loader2, ShieldAlert, ArrowRight, Trash2, ChevronDown, BookOpen } from 'lucide-react'
import { useApp } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Avatar, Badge, statusTone } from '../ui.jsx'
import { suggestions } from '../../lib/assistant/rules.js'
import { downloadCSV } from '../../lib/download.js'
import { PERMS } from '../../data/accounts.js'
import { haptic } from '../../lib/native.js'

// The HR Assistant conversation: messages, result cards, confirmations and
// the composer. Used by the floating panel and the full HR Assistant page.

const CONFIRM_WORDS = /^(yes|y|confirm|confirmed|go ahead|do it|approve it|ok|okay|sure|proceed)\b/i
const CANCEL_WORDS = /^(no|n|cancel|stop|don'?t|never ?mind|abort)\b/i
const id = () => Math.random().toString(36).slice(2, 10)
const label = (k) => ({ joinDate: 'Joined', firstIn: 'First in', avgHours: 'Avg hrs', raisedBy: 'Raised by', employees: 'Employees', dept: 'Department' }[k] || k.charAt(0).toUpperCase() + k.slice(1))

/** Light formatting: **bold**, "- " bullets and "1." numbered lines. */
function RichText({ text }) {
  const lines = String(text || '').split('\n')
  const bold = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (/^\*\*[^*]+\*\*$/.test(part) ? <strong key={i} className="font-semibold text-navy">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>))
  const out = []
  let list = null
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (m) { (list ||= []).push(<li key={i}>{bold(m[1])}</li>); return }
    if (list) { out.push(<ul key={'l' + i} className="list-disc pl-5 space-y-0.5">{list}</ul>); list = null }
    if (line.trim()) out.push(<p key={i}>{bold(line)}</p>)
  })
  if (list) out.push(<ul key="lend" className="list-disc pl-5 space-y-0.5">{list}</ul>)
  return <div className="space-y-1.5">{out}</div>
}

function CardFrame({ title, action, children }) {
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface overflow-hidden">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
          <p className="text-[11.5px] font-semibold text-navy truncate">{title}</p>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function CsvButton({ card }) {
  if (!card.csv || !card.rows?.length) return null
  const cols = card.columns || Object.keys(card.rows[0])
  return (
    <button className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-cyan-ink hover:bg-cyan-bg"
      onClick={() => downloadCSV(card.csv + '.csv', cols.map((c) => ({ header: label(c), key: c })), card.rows)}>
      <Download size={12} /> CSV
    </button>
  )
}

function TableCard({ card }) {
  const [all, setAll] = useState(false)
  const cols = card.columns || (card.rows[0] ? Object.keys(card.rows[0]) : [])
  const rows = all ? card.rows : card.rows.slice(0, 8)
  return (
    <CardFrame title={card.title} action={<CsvButton card={card} />}>
      {card.rows.length === 0 ? <p className="px-3 py-3 text-[12px] text-muted">Nothing to show.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr>{cols.map((c) => <th key={c} className="px-2.5 py-1.5 text-left font-semibold text-faint uppercase tracking-wide text-[9.5px] whitespace-nowrap">{label(c)}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {cols.map((c) => (
                    <td key={c} className="px-2.5 py-1.5 whitespace-nowrap text-body">
                      {c === 'status' ? <Badge tone={statusTone(r[c])}>{r[c]}</Badge> : String(r[c] ?? '--')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {card.rows.length > 8 && (
        <button onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-3 py-1.5 text-[11px] font-medium text-cyan-ink hover:bg-canvas flex items-center justify-center gap-1">
          {all ? 'Show fewer' : 'Show all ' + card.rows.length} <ChevronDown size={12} className={all ? 'rotate-180' : ''} />
        </button>
      )}
    </CardFrame>
  )
}

const STAT_TONE = { green: 'text-[#16A34A]', amber: 'text-[#D97706]', red: 'text-[#DC2626]', purple: 'text-[#7C3AED]', gray: 'text-muted' }
function StatsCard({ card }) {
  return (
    <CardFrame title={card.title}>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-px bg-line">
        {card.stats.map(([k, v, tone]) => (
          <div key={k} className="bg-surface px-2 py-2 text-center">
            <p className={'text-[18px] font-bold font-mono leading-none ' + STAT_TONE[tone]}>{v}</p>
            <p className="mt-1 text-[10px] text-muted">{k}</p>
          </div>
        ))}
      </div>
      {card.table && <div className="border-t border-line"><TableCard card={{ ...card.table, title: 'Needs attention' }} /></div>}
    </CardFrame>
  )
}

function PeopleCard({ card, onNavigate }) {
  const { can } = useAuth()
  return (
    <div className="mt-2 grid gap-2">
      {card.rows.map((e) => (
        <Link key={e.id} to={can(PERMS.HR_PEOPLE) ? '/employees/' + e.id : '/people'} onClick={onNavigate}
          className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-2.5 hover:border-cyan">
          <Avatar name={e.name} size={34} />
          <span className="min-w-0 text-[11.5px] leading-snug">
            <span className="block text-[13px] font-semibold text-navy">{e.name} <span className="font-mono text-[10.5px] text-faint">{e.id}</span></span>
            <span className="block text-body">{e.designation} - {e.department}</span>
            <span className="block text-muted">{e.location} - reports to {e.manager} - joined {e.joinDate}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function TasksCard({ card, onNavigate }) {
  if (!card.rows.length) return <CardFrame><p className="px-3 py-3 text-[12px] text-muted">You are all caught up.</p></CardFrame>
  return (
    <CardFrame title="Waiting for you">
      {card.rows.map((t) => (
        <Link key={t.task} to={t.to} onClick={onNavigate} className="flex items-center gap-2.5 border-t first:border-t-0 border-line px-3 py-2 hover:bg-canvas">
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-cyan-bg px-1.5 text-[11px] font-bold text-cyan-ink">{t.count}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-navy">{t.task}</span>
            <span className="block truncate text-[10.5px] text-muted">{t.detail}</span>
          </span>
          <ArrowRight size={13} className="text-faint" />
        </Link>
      ))}
    </CardFrame>
  )
}

/** Knowledge-base answers: the policy text, with its source and date. */
function PolicyCard({ card }) {
  const [open, setOpen] = useState(false)
  const [first, ...more] = card.rows
  return (
    <CardFrame title={<span className="inline-flex items-center gap-1.5"><BookOpen size={12} /> {first.title}</span>}
      action={<span className="shrink-0 text-[10px] text-faint">Updated {first.updated}</span>}>
      <p className={'px-3 py-2.5 text-[11.5px] leading-relaxed text-body ' + (open ? '' : 'line-clamp-4')}>{first.body}</p>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-1.5">
        <button className="text-[11px] font-medium text-cyan-ink" onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read the full policy'}</button>
        {more.map((m) => <span key={m.id} className="text-[10.5px] text-faint">Also see: {m.title}</span>)}
      </div>
    </CardFrame>
  )
}

/** Links into the app, e.g. a payslip to view and download. */
function LinksCard({ card, onNavigate }) {
  return (
    <CardFrame title={card.title}>
      {card.rows.map((r) => (
        <Link key={r.to + r.label} to={r.to} onClick={onNavigate} className="flex items-center gap-2.5 border-t first:border-t-0 border-line px-3 py-2 hover:bg-canvas">
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-navy">{r.label}</span>
            {r.detail && <span className="block truncate text-[10.5px] text-muted">{r.detail}</span>}
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-ink">{r.action || 'Open'} <ArrowRight size={12} /></span>
        </Link>
      ))}
    </CardFrame>
  )
}

function ChecklistCard({ card }) {
  const [done, setDone] = useState({})
  const owners = [...new Set(card.rows.map((r) => r.owner))]
  return (
    <CardFrame title={card.title} action={<CsvButton card={{ ...card, columns: ['owner', 'task', 'due'] }} />}>
      {owners.map((o) => (
        <div key={o} className="border-t first:border-t-0 border-line px-3 py-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-faint">{o}</p>
          {card.rows.filter((r) => r.owner === o).map((r) => {
            const k = o + r.task
            return (
              <label key={k} className="flex items-start gap-2 py-0.5 text-[11.5px] text-body cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-cyan" checked={!!done[k]} onChange={() => setDone((d) => ({ ...d, [k]: !d[k] }))} />
                <span className={'flex-1 ' + (done[k] ? 'line-through text-faint' : '')}>{r.task}</span>
                <span className="font-mono text-[10px] text-faint">{r.due}</span>
              </label>
            )
          })}
        </div>
      ))}
    </CardFrame>
  )
}

function ResultCard({ card, onNavigate }) {
  if (card.kind === 'table') return <TableCard card={card} />
  if (card.kind === 'stats') return <StatsCard card={card} />
  if (card.kind === 'people') return <PeopleCard card={card} onNavigate={onNavigate} />
  if (card.kind === 'tasks') return <TasksCard card={card} onNavigate={onNavigate} />
  if (card.kind === 'checklist') return <ChecklistCard card={card} />
  if (card.kind === 'policy') return <PolicyCard card={card} />
  if (card.kind === 'links') return <LinksCard card={card} onNavigate={onNavigate} />
  if (card.kind === 'note') return <CardFrame><p className="px-3 py-2.5 text-[12px] text-muted">{card.text}</p></CardFrame>
  return null
}

const TONE_RING = { green: 'border-[#16A34A]/40', red: 'border-[#DC2626]/40', blue: 'border-cyan/50' }
function ProposalCard({ p, state, onConfirm, onCancel }) {
  const status = state?.status || (p.stale ? 'expired' : 'pending')
  return (
    <div className={'mt-2 rounded-xl border-2 bg-surface p-3 ' + (TONE_RING[p.tone] || 'border-line')}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-faint"><ShieldAlert size={12} /> Needs your confirmation</p>
      <p className="mt-1 text-[13px] font-semibold text-navy">{p.summary}</p>
      {p.detail && <p className="mt-0.5 text-[11.5px] text-muted">{p.detail}</p>}
      <div className="mt-2.5 flex items-center gap-2">
        {status === 'pending' && <>
          <button className="btn-primary px-3 py-1.5" onClick={onConfirm}><Check size={13} /> Confirm</button>
          <button className="btn-ghost px-3 py-1.5" onClick={onCancel}><X size={13} /> Cancel</button>
        </>}
        {status === 'running' && <span className="flex items-center gap-1.5 text-[12px] text-muted"><Loader2 size={13} className="animate-spin" /> Working...</span>}
        {status === 'done' && <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#16A34A]"><Check size={13} /> Done</span>}
        {status === 'cancelled' && <span className="text-[12px] text-muted">Cancelled - nothing was changed.</span>}
        {status === 'expired' && <span className="text-[12px] text-muted">From an earlier session - ask again to act on it.</span>}
        {status === 'failed' && <span className="text-[12px] text-[#DC2626]">Not done: {state.error}</span>}
      </div>
    </div>
  )
}

export default function AssistantChat({ onNavigate }) {
  const { user } = useAuth()
  const { askAssistant, loadChat, saveChat, clearChat, runAction, online } = useApp()
  const [messages, setMessages] = useState([])
  const [engine, setEngine] = useState(online ? null : 'rules')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [decisions, setDecisions] = useState({})   // proposal id -> { status, error }
  const memory = useRef({})
  const scroller = useRef(null)
  const input = useRef(null)
  const ctx = { actor: user }

  // Earlier conversation; proposals from it can no longer be confirmed.
  useEffect(() => {
    let live = true
    loadChat().then(({ messages: m, engine: e }) => {
      if (!live) return
      setMessages((m || []).map((x) => ({ ...x, id: x.id || id(), proposals: (x.proposals || []).map((p) => ({ ...p, stale: true })) })))
      if (e) setEngine(e)
    }).catch(() => {})
    return () => { live = false }
  }, [loadChat])

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])
  useEffect(() => { if (!online) saveChat(messages.map(({ id: _id, ...m }) => m)) }, [messages, online, saveChat])

  const push = (m) => setMessages((list) => [...list, { id: id(), at: new Date().toISOString(), ...m }])
  const latestPending = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const p = (messages[i].proposals || []).find((x) => !x.stale && !decisions[x.id])
      if (p) return p
    }
    return null
  }

  const confirm = useCallback(async (p) => {
    haptic()
    setDecisions((d) => ({ ...d, [p.id]: { status: 'running' } }))
    const r = await runAction(p.type, p.payload, 'assistant')
    if (r.ok) {
      haptic('success')
      setDecisions((d) => ({ ...d, [p.id]: { status: 'done' } }))
      const next = {
        'leave.add': 'Submitted to HR for approval. You will get a notification when it is approved or rejected, and you can follow it under Leave.',
        'ticket.add': 'Ticket ' + (r.result || '') + ' is open. You will be notified at every status change, and you can follow it in the Request Hub.',
        'profile.update': 'Your record is updated. Only you and HR can see these details.',
        'course.enroll': 'You are enrolled. Track it under Learning.',
      }[p.type] || 'Anyone affected has been notified.'
      push({ role: 'assistant', text: 'Done: ' + p.summary + '. ' + next })
    } else {
      setDecisions((d) => ({ ...d, [p.id]: { status: 'failed', error: r.error } }))
      push({ role: 'assistant', text: 'That did not go through: ' + r.error })
    }
  }, [runAction]) // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = (p) => {
    setDecisions((d) => ({ ...d, [p.id]: { status: 'cancelled' } }))
    push({ role: 'assistant', text: 'Cancelled. Nothing was changed.' })
  }

  const send = async (textArg) => {
    const text = String(textArg ?? draft).trim()
    if (!text || busy) return
    setDraft('')
    push({ role: 'user', text })
    // "confirm" / "cancel" act on the latest proposal right here.
    const pending = latestPending()
    if (pending && CONFIRM_WORDS.test(text)) { confirm(pending); return }
    if (pending && CANCEL_WORDS.test(text)) { cancel(pending); return }
    setBusy(true)
    try {
      const r = await askAssistant(text, memory.current)
      // A leave draft lasts only until the next answer that does not keep it.
      memory.current = { ...memory.current, leaveDraft: undefined, ...(r.memory || {}) }
      if (r.engine && r.engine !== 'policy') setEngine(r.engine)
      push({ role: 'assistant', text: r.reply, cards: r.cards, proposals: r.proposals, engine: r.engine })
    } catch (err) {
      push({ role: 'assistant', text: 'Sorry, I could not reach the server: ' + err.message })
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  const clear = async () => {
    await clearChat().catch(() => {})
    setMessages([]); setDecisions({}); memory.current = {}
  }

  const chips = suggestions(ctx)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="px-1 pt-4 pb-2 text-center">
            <span className="assistant-orb mx-auto grid h-12 w-12 place-items-center rounded-2xl text-white"><Sparkles size={22} /></span>
            <p className="mt-3 text-[15px] font-bold text-navy">Hi {user?.name?.split(' ')[0]}, how can I help?</p>
            <p className="mx-auto mt-1 max-w-xs text-[12px] text-muted">I look things up and prepare actions for you to confirm. I never change pay, jobs or records on my own.</p>
          </div>
        )}
        {messages.map((m) => m.role === 'user' ? (
          <div key={m.id} className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-btn px-3 py-2 text-[13px] text-white whitespace-pre-wrap break-words">{m.text}</p>
          </div>
        ) : (
          <div key={m.id} className="flex gap-2">
            <span className="assistant-orb mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"><Sparkles size={14} /></span>
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-3 py-2 text-[13px] text-body leading-relaxed">
                <RichText text={m.text} />
              </div>
              {(m.cards || []).map((c, i) => <ResultCard key={i} card={c} onNavigate={onNavigate} />)}
              {(m.proposals || []).map((p) => (
                <ProposalCard key={p.id} p={p} state={decisions[p.id]} onConfirm={() => confirm(p)} onCancel={() => cancel(p)} />
              ))}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2">
            <span className="assistant-orb grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"><Sparkles size={14} /></span>
            <span className="typing rounded-2xl rounded-tl-md border border-line bg-surface px-3 py-2.5" aria-label="Assistant is typing"><i /><i /><i /></span>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-3 sm:px-4 pt-2.5 assistant-composer">
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {chips.map((c) => (
            <button key={c} onClick={() => send(c)} disabled={busy}
              className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] text-body hover:border-cyan hover:text-cyan-ink disabled:opacity-50">{c}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-end gap-2">
          <textarea ref={input} id="assistant-input" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={'Ask about employees, attendance, leave...'} aria-label="Message the HR Assistant"
            className="input min-h-[40px] max-h-32 resize-none py-2.5 text-[13px]" />
          <button type="submit" disabled={busy || !draft.trim()} className="btn-primary h-10 w-10 justify-center p-0 disabled:opacity-50" aria-label="Send">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        <div className="flex items-center justify-between py-1.5 text-[10.5px] text-faint">
          <span>{engine === 'claude' ? 'AI answers from Claude. ' : engine === 'rules' ? 'Built-in assistant. ' : ''}Actions always need your Confirm.</span>
          {messages.length > 0 && <button onClick={clear} className="flex items-center gap-1 hover:text-navy"><Trash2 size={11} /> Clear</button>}
        </div>
      </div>
    </div>
  )
}

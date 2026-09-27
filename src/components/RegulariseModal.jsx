import { useState } from 'react'
import { CalendarClock, LogIn, LogOut } from 'lucide-react'
import Modal from './Modal.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { REGULARISATION_TYPES, localDate } from '../lib/actions.js'
import { haptic } from '../lib/native.js'

const toInput = (t) => (t && /^\d{2}:\d{2}$/.test(t) ? t : '')
const pretty = (d) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * Regularisation request form. `prefill` opens it: { date, recordedIn,
 * recordedOut } from the calendar day that was clicked, or just a date.
 */
export default function RegulariseModal({ prefill, onClose }) {
  if (!prefill) return null
  // A fresh form for every day that is clicked.
  return <RegulariseForm key={prefill.opened} prefill={prefill} onClose={onClose} />
}

function RegulariseForm({ prefill, onClose }) {
  const { addRegularisation, regularisations, notify, toast } = useApp()
  const { user } = useAuth()
  const [form, setForm] = useState(() => ({
    date: prefill.date || localDate(),
    in: toInput(prefill.recordedIn) || '10:00',
    out: toInput(prefill.recordedOut) || '19:00',
    type: prefill.recordedIn ? 'Wrong punch time' : 'Missed punch',
    reason: '',
  }))
  const [err, setErr] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const pending = regularisations.find((r) => r.empId === user?.id && r.date === form.date && r.status === 'Pending')

  const submit = (e) => {
    e?.preventDefault()
    if (!form.date) return setErr('Pick the date to regularise.')
    if (form.date > localDate()) return setErr('You cannot regularise a day that has not happened yet.')
    if (!form.in && !form.out) return setErr('Enter the punch-in time, the punch-out time, or both.')
    if (form.in && form.out && form.out <= form.in) return setErr('Punch-out must be after punch-in.')
    if (!form.reason.trim()) return setErr('Add a short reason so HR can approve it.')
    if (pending) return setErr('You already have a pending request (' + pending.id + ') for this day.')
    addRegularisation({ date: form.date, in: form.in || null, out: form.out || null, type: form.type, reason: form.reason.trim() })
    haptic('success')
    notify({ title: 'Regularisation submitted', detail: form.type + ' for ' + form.date + ' sent to HR', to: '/attendance', kind: 'task' })
    toast('Regularisation submitted', pretty(form.date) + ' is pending HR approval')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Regularise attendance" subtitle="Correct a missed or wrong punch; HR approves it"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit}><CalendarClock size={13} /> Submit request</button>
      </>}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-navy">{pretty(form.date)}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted font-mono">
            <span className="flex items-center gap-1"><LogIn size={12} /> recorded in {prefill.recordedIn || '--:--'}</span>
            <span className="flex items-center gap-1"><LogOut size={12} /> recorded out {prefill.recordedOut || '--:--'}</span>
          </p>
          {pending && <p className="mt-1.5 text-[11.5px] font-medium text-[#B45309]">{pending.id} is already pending for this day.</p>}
        </div>
        <div><label className="label" htmlFor="reg-date">Date *</label><input id="reg-date" type="date" className="input" max={localDate()} value={form.date} onChange={set('date')} /></div>
        <div><label className="label" htmlFor="reg-type">Reason type</label>
          <select id="reg-type" className="input" value={form.type} onChange={set('type')}>{REGULARISATION_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div><label className="label" htmlFor="reg-in">Correct punch-in</label><input id="reg-in" type="time" className="input" value={form.in} onChange={set('in')} /></div>
        <div><label className="label" htmlFor="reg-out">Correct punch-out</label><input id="reg-out" type="time" className="input" value={form.out} onChange={set('out')} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="reg-reason">Reason *</label>
          <textarea id="reg-reason" className="input min-h-[80px]" value={form.reason} onChange={set('reason')} placeholder="Client visit, biometric reader down, forgot to punch out..." />
        </div>
        {err && <p className="sm:col-span-2 text-[12px] text-[#DC2626]">{err}</p>}
      </form>
    </Modal>
  )
}

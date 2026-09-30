import { useEffect, useState } from 'react'
import { KeyRound, Smartphone, Mail, ShieldCheck, Loader2 } from 'lucide-react'
import { Card, Badge } from './ui.jsx'
import { useApp } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { security, recoveryAvailable } from '../lib/recovery.js'
import { passwordProblem } from '../lib/passwords.js'

// Profile > Security: change your password, and verify the mobile number
// used for account recovery. Contact details come back from the server masked.

export default function SecuritySettings() {
  const { toast } = useApp()
  const { user, adoptSession } = useAuth()
  const [info, setInfo] = useState(null)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [phone, setPhone] = useState('')
  const [verify, setVerify] = useState(null) // { requestId, message }
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState({})

  const load = () => security.get().then(setInfo).catch((e) => setError({ load: e.message }))
  useEffect(() => { if (recoveryAvailable) load() }, [])

  if (!recoveryAvailable) {
    return <Card title="Sign-in and security"><p className="text-[13px] text-muted">Password changes and recovery settings are handled by HR Ops in this version of the app.</p></Card>
  }

  const run = async (key, fn) => {
    setError((e) => ({ ...e, [key]: '' }))
    setBusy(key)
    try { await fn() } catch (e) { setError((x) => ({ ...x, [key]: e.message })) } finally { setBusy('') }
  }

  const changePassword = (e) => {
    e.preventDefault()
    const problem = passwordProblem(pw.next, { username: user.username, name: user.name })
    if (problem) { setError((x) => ({ ...x, pw: problem + '.' })); return }
    if (pw.next !== pw.confirm) { setError((x) => ({ ...x, pw: 'The two new passwords do not match.' })); return }
    run('pw', async () => {
      const r = await security.changePassword(pw.current, pw.next)
      adoptSession(r.token, r.user)
      setPw({ current: '', next: '', confirm: '' })
      toast('Password changed', r.message)
      load()
    })
  }

  const startPhone = (e) => {
    e.preventDefault()
    run('phone', async () => { const r = await security.startPhone(phone); setVerify(r); setCode('') })
  }
  const confirmPhone = (e) => {
    e.preventDefault()
    run('phone', async () => {
      const r = await security.confirmPhone(verify.requestId, code)
      toast('Mobile verified', r.message)
      setVerify(null); setPhone('')
      load()
    })
  }

  const err = (k) => error[k] && <p role="alert" className="text-[12px] text-[#DC2626]">{error[k]}</p>
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Change password" subtitle={info?.passwordChangedAt ? 'Last changed ' + new Date(info.passwordChangedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Signs you out on your other devices'}>
        <form onSubmit={changePassword} className="grid gap-3" noValidate>
          <div><label className="label" htmlFor="pw-cur">Current password</label><input id="pw-cur" type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div><label className="label" htmlFor="pw-new">New password</label><input id="pw-new" type="password" className="input" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <div><label className="label" htmlFor="pw-new2">Confirm new password</label><input id="pw-new2" type="password" className="input" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          <p className="text-[11.5px] text-muted">At least 8 characters with letters and numbers, not containing your username or name.</p>
          {err('pw')}
          <div><button className="btn-primary" disabled={busy === 'pw'}>{busy === 'pw' ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} Change password</button></div>
        </form>
      </Card>

      <Card title="Account recovery" subtitle="Where we send codes if you forget your username or password">
        {err('load')}
        {info && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5">
              <span className="flex items-center gap-2 text-[13px] text-body"><Mail size={14} className="text-faint" /> {info.email || 'No email on file'}</span>
              <Badge tone={info.channels.email ? 'green' : 'gray'}>{info.channels.email ? 'Email codes on' : 'Email unavailable'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5">
              <span className="flex items-center gap-2 text-[13px] text-body"><Smartphone size={14} className="text-faint" /> {info.phone || 'No mobile on file'}</span>
              <Badge tone={info.phoneVerified ? 'green' : 'amber'}>{info.phoneVerified ? 'Verified' : 'From HR records'}</Badge>
            </div>
            {info.channels.sms ? (
              !verify ? (
                <form onSubmit={startPhone} className="grid gap-2" noValidate>
                  <label className="label" htmlFor="rec-phone">Verify a mobile number for recovery</label>
                  <div className="flex gap-2">
                    <input id="rec-phone" className="input" inputMode="tel" autoComplete="tel" placeholder="+91 98200 12345" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <button className="btn-secondary shrink-0" disabled={busy === 'phone'}>Send code</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={confirmPhone} className="grid gap-2" noValidate>
                  <p className="text-[12.5px] text-muted">{verify.message}</p>
                  <div className="flex gap-2">
                    <input className="input font-mono tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                    <button className="btn-primary shrink-0" disabled={busy === 'phone'}><ShieldCheck size={13} /> Verify</button>
                  </div>
                  <button type="button" className="justify-self-start text-[12px] text-muted hover:text-navy" onClick={() => setVerify(null)}>Use a different number</button>
                </form>
              )
            ) : <p className="text-[12px] text-muted">SMS is not set up on this server, so mobile numbers cannot be verified yet.</p>}
            {err('phone')}
          </div>
        )}
      </Card>
    </div>
  )
}

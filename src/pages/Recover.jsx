import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, MessageSquare, KeyRound, UserRound, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import Logo from '../components/Logo.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { recovery, recoveryAvailable } from '../lib/recovery.js'
import { passwordProblem } from '../lib/passwords.js'
import { BRAND } from '../lib/brand.js'

// Forgotten password, username, or both: identify the account, prove it with
// a one-time code (SMS or email) or the email link, then set new details.
// Every server answer is shown as-is; the server decides what is safe to say.

const NEEDS = [
  { key: 'password', label: 'I forgot my password', icon: KeyRound },
  { key: 'username', label: 'I forgot my username', icon: UserRound },
  { key: 'both', label: 'I forgot both', icon: ShieldCheck },
]

function Notice({ tone = 'error', children }) {
  const skin = tone === 'error' ? 'border-[#DC2626]/40 bg-[#DC2626]/5 text-[#B91C1C] dark:text-[#FCA5A5]' : tone === 'success' ? 'border-[#16A34A]/40 bg-[#16A34A]/5 text-[#15803D] dark:text-[#86EFAC]' : 'border-line bg-canvas text-body'
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] leading-snug ' + skin}>
      {tone !== 'info' && <Icon size={15} className="mt-px shrink-0" />}<span>{children}</span>
    </p>
  )
}

const field = 'w-full rounded-full border border-line bg-surface px-4 py-3 text-[14px] outline-none transition-all focus:border-cyan focus:ring-2 focus:ring-cyan/20'
const primary = 'sheen w-full rounded-full py-3 text-[14px] font-medium text-white tracking-wide transition-all disabled:opacity-60'
const gradient = { background: 'linear-gradient(90deg,#7FD4EE 0%,#3FBEE4 50%,#7FD4EE 100%)' }

function PasswordRules({ value, username, name }) {
  const rules = [
    ['At least 8 characters', value.length >= 8],
    ['Letters and numbers', /[a-z]/i.test(value) && /\d/.test(value)],
    ['Not your username or name', !!value && !passwordProblem(value, { username, name })?.match(/username|name/)],
  ]
  return (
    <ul className="grid gap-1 px-2 text-[11.5px]">
      {rules.map(([t, ok]) => (
        <li key={t} className={'flex items-center gap-1.5 ' + (ok ? 'text-[#15803D] dark:text-[#86EFAC]' : 'text-muted')}>
          <CheckCircle2 size={12} className={ok ? '' : 'opacity-40'} /> {t}
        </li>
      ))}
    </ul>
  )
}

export default function Recover() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(params.get('token') ? 'link' : 'start')
  const [need, setNeed] = useState(['password', 'username', 'both'].includes(params.get('need')) ? params.get('need') : 'password')
  const [identifier, setIdentifier] = useState('')
  const [channel, setChannel] = useState('email')
  const [opts, setOpts] = useState(null)
  const [req, setReq] = useState(null)       // { requestId, message, expiresAt, resendAt }
  const [code, setCode] = useState('')
  const [ticket, setTicket] = useState(null) // { ticket, username, purpose }
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [newName, setNewName] = useState('')
  const [rename, setRename] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const codeRef = useRef(null)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  // Which channels this server can send on.
  useEffect(() => {
    if (!recoveryAvailable) return
    recovery.options().then((o) => {
      setOpts(o)
      if (!o.channels.email && o.channels.sms) setChannel('sms')
    }).catch((e) => setError(e.message))
  }, [])

  // Arriving from the email link - also when this screen is already open in
  // the same tab: exchange it at once and drop it from the URL.
  const linkToken = params.get('token')
  useEffect(() => {
    if (!linkToken || !recoveryAvailable) return
    setParams({}, { replace: true })
    setStep('link')
    setError('')
    setBusy(true)
    recovery.openLink(linkToken)
      .then((t) => { setTicket(t); setNeed(t.purpose); setStep('reset') })
      .catch((e) => { setError(e.message); setStep('start') })
      .finally(() => setBusy(false))
  }, [linkToken, setParams])

  useEffect(() => { if (step === 'code') codeRef.current?.focus() }, [step])

  const run = async (fn) => {
    setError('')
    setBusy(true)
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const send = (e) => {
    e?.preventDefault()
    if (!identifier.trim()) { setError('Enter your username, work email or registered mobile number.'); return }
    run(async () => {
      const r = await recovery.start(identifier.trim(), channel, need)
      setReq({ ...r, expiresAt: Date.now() + r.expiresInSec * 1000, resendAt: Date.now() + r.resendInSec * 1000 })
      setCode('')
      setStep('code')
    })
  }

  const check = (e) => {
    e?.preventDefault()
    const c = code.replace(/\D/g, '')
    if (c.length !== 6) { setError('Enter the 6-digit code.'); return }
    run(async () => {
      const t = await recovery.verify(req.requestId, c)
      setTicket(t)
      setStep('reset')
    })
  }

  const wantsPassword = need !== 'username'
  const save = (e) => {
    e?.preventDefault()
    const changes = {}
    if (wantsPassword) {
      const problem = passwordProblem(password, { username: rename && newName ? newName : ticket.username, name: ticket.name })
      if (problem) { setError(problem + '.'); return }
      if (password !== confirm) { setError('The two passwords do not match.'); return }
      changes.password = password
    }
    if (rename && newName.trim() && newName.trim().toLowerCase() !== ticket.username) changes.username = newName.trim().toLowerCase()
    if (!Object.keys(changes).length) { setDone({ username: ticket.username, message: 'Your username is ' + ticket.username + '. Sign in with it and your existing password.' }); setStep('done'); return }
    run(async () => {
      const r = await recovery.complete(ticket.ticket, changes)
      setDone(r)
      setStep('done')
    })
  }

  const left = req ? Math.max(0, Math.round((req.expiresAt - now) / 1000)) : 0
  const resendIn = req ? Math.max(0, Math.round((req.resendAt - now) / 1000)) : 0
  const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
  const channels = opts?.channels || {}
  const none = opts && !channels.email && !channels.sms

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-4 pb-10 recover-page">
      <div className="login-theme absolute right-4 z-20"><ThemeToggle /></div>
      <div className="w-full max-w-sm pt-16 sm:pt-20 rise">
        <div className="flex justify-center mb-7"><Logo variant="dark" size={36} /></div>

        {step !== 'done' && (
          <Link to="/login" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-navy"><ArrowLeft size={14} /> Back to sign in</Link>
        )}

        {!recoveryAvailable || none ? (
          <div className="space-y-3">
            <h1 className="text-[22px] font-bold text-navy">Account recovery</h1>
            <Notice tone="info">Self-service recovery is not available here right now. Contact HR Ops to reset your password or look up your username; they will verify your identity first.</Notice>
          </div>
        ) : (
          <>
            {step === 'start' && (
              <form onSubmit={send} className="space-y-4" noValidate>
                <div>
                  <h1 className="text-[22px] font-bold text-navy">Recover your account</h1>
                  <p className="mt-1 text-[13px] text-muted">We will send a one-time code to the email or mobile number registered with HR.</p>
                </div>
                <fieldset className="grid gap-2">
                  <legend className="sr-only">What do you need?</legend>
                  {NEEDS.map(({ key, label, icon: Icon }) => (
                    <label key={key} className={'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] transition-colors ' + (need === key ? 'border-cyan bg-cyan/10 text-navy font-medium' : 'border-line text-body')}>
                      <input type="radio" name="need" className="sr-only" checked={need === key} onChange={() => setNeed(key)} />
                      <Icon size={16} className={need === key ? 'text-cyan' : 'text-faint'} /> {label}
                    </label>
                  ))}
                </fieldset>
                <div>
                  <label htmlFor="rec-id" className="label">Username, work email or mobile number</label>
                  <input id="rec-id" className={field} value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder={need === 'password' ? 'e.g. firstname.lastname' : 'e.g. you@' + BRAND.emailDomain} />
                </div>
                <fieldset>
                  <legend className="label">Send my code by</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[['email', 'Email', Mail], ['sms', 'SMS', MessageSquare]].map(([k, t, Icon]) => (
                      <label key={k} className={'flex items-center justify-center gap-2 rounded-full border py-2.5 text-[13px] transition-colors ' +
                        (!channels[k] ? 'opacity-40 cursor-not-allowed border-line' : channel === k ? 'cursor-pointer border-cyan bg-cyan/10 text-navy font-medium' : 'cursor-pointer border-line text-body')}>
                        <input type="radio" name="channel" className="sr-only" disabled={!channels[k]} checked={channel === k} onChange={() => setChannel(k)} />
                        <Icon size={15} /> {t}
                      </label>
                    ))}
                  </div>
                  {channel === 'email' && opts?.link && <p className="mt-1.5 px-2 text-[11.5px] text-muted">The email also has a one-time link you can open instead of typing the code.</p>}
                  {channel === 'sms' && <p className="mt-1.5 px-2 text-[11.5px] text-muted">Only a mobile number verified with HR can receive codes.</p>}
                </fieldset>
                {error && <Notice>{error}</Notice>}
                <button type="submit" disabled={busy || !opts} className={primary} style={gradient}>
                  <span className="relative z-10 inline-flex items-center gap-2">{busy && <Loader2 size={15} className="animate-spin" />}SEND CODE</span>
                </button>
              </form>
            )}

            {step === 'code' && req && (
              <form onSubmit={check} className="space-y-4" noValidate>
                <div>
                  <h1 className="text-[22px] font-bold text-navy">Enter your code</h1>
                  <p className="mt-1 text-[13px] text-muted">{req.message}</p>
                </div>
                <div>
                  <label htmlFor="rec-code" className="label">6-digit code</label>
                  <input id="rec-code" ref={codeRef} className={field + ' text-center font-mono text-[22px] tracking-[0.5em]'} value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" />
                  <p className={'mt-1.5 px-2 text-[11.5px] ' + (left ? 'text-muted' : 'text-[#B91C1C]')}>{left ? 'Expires in ' + mmss(left) + '. It works once.' : 'This code has expired - ask for a new one.'}</p>
                </div>
                {error && <Notice>{error}</Notice>}
                <button type="submit" disabled={busy || !left} className={primary} style={gradient}>
                  <span className="relative z-10 inline-flex items-center gap-2">{busy && <Loader2 size={15} className="animate-spin" />}VERIFY</span>
                </button>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                  <button type="button" className="text-navy underline disabled:no-underline disabled:text-faint" disabled={resendIn > 0 || busy} onClick={send}>
                    {resendIn > 0 ? 'Resend in ' + resendIn + 's' : 'Send a new code'}
                  </button>
                  <button type="button" className="text-muted hover:text-navy" onClick={() => { setStep('start'); setError('') }}>Use a different method</button>
                </div>
                <p className="px-2 text-[11px] text-faint">Did not get it? Check the number or email HR has on file, and your spam folder. HR will never ask you for this code.</p>
              </form>
            )}

            {step === 'link' && (
              <div className="flex items-center gap-2 text-[13px] text-muted"><Loader2 size={16} className="animate-spin" /> Checking your recovery link...</div>
            )}

            {step === 'reset' && ticket && (
              <form onSubmit={save} className="space-y-4" noValidate>
                <div>
                  <h1 className="text-[22px] font-bold text-navy">{wantsPassword ? 'Set a new password' : 'Your username'}</h1>
                  <p className="mt-1 text-[13px] text-muted">Identity verified. This step expires in 15 minutes.</p>
                </div>
                <div className="rounded-xl border border-line bg-canvas px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">Your username</p>
                  <p className="mt-0.5 font-mono text-[15px] text-navy break-all">{ticket.username}</p>
                </div>
                {need !== 'password' && (
                  <label className="flex items-center gap-2 px-1 text-[13px] text-body">
                    <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} /> Choose a new username
                  </label>
                )}
                {rename && (
                  <div>
                    <label htmlFor="rec-name" className="label">New username</label>
                    <input id="rec-name" className={field} value={newName} onChange={(e) => setNewName(e.target.value.toLowerCase())} autoCapitalize="none" spellCheck="false" autoComplete="username" placeholder="3-40 characters, e.g. nikhil.t" />
                  </div>
                )}
                {wantsPassword && (
                  <>
                    <div className="relative">
                      <label htmlFor="rec-pw" className="label">New password</label>
                      <input id="rec-pw" type={show ? 'text' : 'password'} className={field + ' pr-11'} value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} autoComplete="new-password" />
                      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-4 bottom-3 text-navy/50 hover:text-navy">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                    <PasswordRules value={password} username={rename && newName ? newName : ticket.username} name={ticket.name} />
                    <div>
                      <label htmlFor="rec-pw2" className="label">Confirm new password</label>
                      <input id="rec-pw2" type={show ? 'text' : 'password'} className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                    </div>
                  </>
                )}
                {error && <Notice>{error}</Notice>}
                <button type="submit" disabled={busy} className={primary} style={gradient}>
                  <span className="relative z-10 inline-flex items-center gap-2">{busy && <Loader2 size={15} className="animate-spin" />}{wantsPassword ? 'SAVE NEW PASSWORD' : rename ? 'SAVE NEW USERNAME' : 'CONTINUE'}</span>
                </button>
                {wantsPassword && <p className="px-2 text-[11px] text-faint">Saving signs you out on every other device.</p>}
              </form>
            )}

            {step === 'done' && done && (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[#16A34A]/10 text-[#16A34A]"><CheckCircle2 size={28} /></span>
                  <h1 className="mt-3 text-[22px] font-bold text-navy">All set</h1>
                </div>
                <Notice tone="success">{done.message}</Notice>
                <p className="px-1 text-[12px] text-muted">We have also let you know by email or SMS. If you did not make this change, contact HR straight away.</p>
                <button type="button" className={primary} style={gradient} onClick={() => navigate('/login', { replace: true, state: { username: done.username } })}>
                  <span className="relative z-10">SIGN IN</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

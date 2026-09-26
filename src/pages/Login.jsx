import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { User, Lock, Eye, EyeOff, CalendarCheck, CalendarDays, Wallet, Smartphone, CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from '../components/Logo.jsx'
import { useParallaxScene } from '../lib/motion.js'
import { ACCOUNTS, ROLES, DEMO_PASSWORDS } from '../data/accounts.js'
import { BRAND, IS_PUBLIC_DEMO } from '../lib/brand.js'
import { API_MODE, IS_TEST_BUILD } from '../lib/api.js'
import { TEST_ACCOUNTS, TEST_PASSWORDS } from '../data/testAccounts.js'
import TestBanner from '../components/TestBanner.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'

// Quick-fill logins: test users in a test build, demo users in the offline
// demo, none in production (both conditions are build-time constants, so the
// passwords are stripped from any build that does not show them).
const QUICK_LOGINS = IS_TEST_BUILD
  ? { title: 'Test build - test logins', list: TEST_ACCOUNTS, passwords: TEST_PASSWORDS }
  : !API_MODE
    ? { title: 'Demo build - test logins', list: ACCOUNTS, passwords: DEMO_PASSWORDS }
    : null

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const scene = useParallaxScene()

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (!username.trim() || !password.trim()) { setError('Please enter both your username and password.'); return }
    setBusy(true)
    const problem = await login(username.trim(), password)
    setBusy(false)
    if (problem) { setError(problem); return }
    navigate('/', { replace: true })
  }

  const fill = (u, p) => { setUsername(u); setPassword(p); setError('') }

  // Already signed in (for example the app was reopened on this screen).
  if (user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
    <BrandPanel />
    <div ref={scene} className="scene min-h-screen relative overflow-hidden bg-surface flex items-center justify-center px-4">
      <TestBanner floating />
      <div className="login-theme absolute right-4 z-20"><ThemeToggle /></div>
      {/* Parallax backdrop: three depth layers that track the pointer */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="layer layer-1 absolute -top-24 -left-24 h-[26rem] w-[26rem] rounded-full blur-3xl opacity-50 drift-slow"
          style={{ background: 'radial-gradient(circle,#CFE6F7 0%,transparent 68%)' }} />
        <div className="layer layer-2 absolute top-1/4 -right-28 h-[22rem] w-[22rem] rounded-full blur-3xl opacity-45 drift"
          style={{ background: 'radial-gradient(circle,#BFEFF8 0%,transparent 68%)' }} />
        <div className="layer layer-3 absolute bottom-10 left-1/4 h-64 w-64 rounded-full blur-3xl opacity-35 drift-slow"
          style={{ background: 'radial-gradient(circle,#E2E8F7 0%,transparent 70%)' }} />

        <svg className="layer layer-1 absolute bottom-0 left-0 w-full" viewBox="0 0 1440 420" preserveAspectRatio="none">
          <path d="M0 210 C 320 90 560 330 840 240 C 1100 160 1280 260 1440 200 V420 H0 Z" fill="#E8EDF7" />
        </svg>
        <svg className="layer layer-2 absolute bottom-0 left-0 w-full" viewBox="0 0 1440 420" preserveAspectRatio="none">
          <path d="M0 290 C 300 190 620 380 900 300 C 1140 232 1300 320 1440 280 V420 H0 Z" fill="#DDE6F5" />
        </svg>
        <svg className="layer layer-3 absolute bottom-0 left-0 w-full" viewBox="0 0 1440 420" preserveAspectRatio="none">
          <path d="M0 350 C 340 280 640 420 940 360 C 1180 312 1320 372 1440 340 V420 H0 Z" fill="#CBD9EF" />
        </svg>
      </div>

      <div className="layer-card relative w-full max-w-sm rise">
        <div className="flex justify-center mb-8 drift-slow lg:hidden"><Logo variant="dark" size={40} /></div>
        <div className="hidden lg:block mb-7">
          <h1 className="text-[28px] font-bold tracking-tight text-navy">Welcome back</h1>
          <p className="text-[13.5px] text-muted mt-1">Sign in to your {BRAND.company} workspace.</p>
        </div>

        {IS_PUBLIC_DEMO && (
          <div className="mb-5 rounded-card border-l-[3px] border-[#D97706] bg-[rgba(217,119,6,0.08)] px-3.5 py-2.5">
            <p className="text-[12px] text-body">
              <strong className="text-navy">Demonstration build.</strong> A portfolio prototype with
              fabricated data. The sign-in below is not real authentication.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/50" />
            <input className="w-full rounded-full border border-line bg-surface/90 backdrop-blur pl-11 pr-4 py-3 text-[13px] outline-none transition-all duration-200 focus:border-cyan focus:ring-2 focus:ring-cyan/20 focus:-translate-y-0.5 focus:shadow-[0_8px_20px_-12px_rgba(27,54,93,.4)]"
              placeholder="Your Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/50" />
            <input type={show ? 'text' : 'password'}
              className="w-full rounded-full border border-line bg-surface/90 backdrop-blur pl-11 pr-11 py-3 text-[13px] outline-none transition-all duration-200 focus:border-cyan focus:ring-2 focus:ring-cyan/20 focus:-translate-y-0.5 focus:shadow-[0_8px_20px_-12px_rgba(27,54,93,.4)]"
              placeholder="Your Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label="Toggle password visibility"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-navy/50 hover:text-navy">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <p className="text-[12px] text-[#DC2626] px-2">{error}</p>}

          <button type="submit" disabled={busy}
            className="sheen w-full disabled:opacity-70 rounded-full py-3 text-[15px] font-medium text-white tracking-wide transition-all duration-300 hover:shadow-[0_10px_28px_-8px_rgba(0,180,216,.6)] hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: 'linear-gradient(90deg,#7FD4EE 0%,#3FBEE4 50%,#7FD4EE 100%)' }}>
            <span className="relative z-10">{busy ? 'SIGNING IN...' : 'LOGIN'}</span>
          </button>
        </form>

        <ul className="mt-5 space-y-1.5 text-[12px] list-disc pl-5 marker:text-navy/40">
          <li><a href="#" className="text-navy underline hover:text-cyan">Forgot your password?</a></li>
          <li><a href="#" className="text-navy underline hover:text-cyan">Forgot your username?</a></li>
        </ul>

        <p className="mt-8 text-center text-[12px] text-muted lg:hidden">{BRAND.poweredBy}</p>

        {QUICK_LOGINS && (
        <div className="mt-6 rounded-card border border-line bg-canvas/70 backdrop-blur-sm p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-faint mb-2">{QUICK_LOGINS.title}</p>
          {QUICK_LOGINS.list.map((a) => (
            <button key={a.username} type="button" onClick={() => fill(a.username, QUICK_LOGINS.passwords[a.username])}
              className="lift w-full text-left rounded-lg px-2.5 py-2 hover:bg-surface hover:shadow-[0_6px_16px_-10px_rgba(27,54,93,.5)]">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-navy">{ROLES[a.role].label}</span>
                <span className="text-[10px] font-mono text-muted">{a.username}</span>
              </span>
              <span className="block text-[10px] text-muted mt-0.5">{ROLES[a.role].description}</span>
            </button>
          ))}
          <p className="text-[10px] text-faint mt-2 px-2.5">Tap a row to fill the form.</p>
        </div>
        )}
      </div>
    </div>
    </div>
  )
}

// Desktop-only left half of the sign-in page: brand, what the app does, and
// a couple of floating preview cards.
const FEATURES = [
  { icon: CalendarCheck, text: 'Punch in and track attendance' },
  { icon: CalendarDays, text: 'Apply for and approve leave in seconds' },
  { icon: Wallet, text: 'Payslips, Form 16 and tax declarations' },
  { icon: Smartphone, text: 'The same account on the Android app' },
]

function BrandPanel() {
  return (
    <aside className="login-brand hidden lg:flex relative overflow-hidden flex-col justify-between p-12 xl:p-16 text-white">
      <Logo variant="light" size={40} />

      <div className="relative z-10 max-w-lg">
        <h2 className="text-[40px] xl:text-[46px] font-bold leading-[1.08] tracking-tight">
          Everything your people need, <span className="text-cyan">in one place.</span>
        </h2>
        <p className="mt-4 text-[15px] text-white/70 max-w-md">
          Attendance, leave, payroll and requests for every {BRAND.company} employee - on the web and on your phone.
        </p>
        <ul className="mt-8 space-y-3">
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <li key={text} className="flex items-center gap-3 text-[14px] text-white/85 rise" style={{ animationDelay: 120 + i * 70 + 'ms' }}>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"><Icon size={17} className="text-cyan" /></span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Floating preview cards */}
      <div className="pointer-events-none absolute right-10 top-24 w-60 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-md p-4 drift" aria-hidden="true">
        <p className="flex items-center gap-2 text-[12px] font-semibold"><CheckCircle2 size={15} className="text-[#4ADE80]" /> Leave approved</p>
        <p className="mt-1 text-[11px] text-white/65">2 days of Casual Leave - 12 to 13 Oct</p>
      </div>
      <div className="pointer-events-none absolute right-24 bottom-32 w-52 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-md p-4 drift-slow" aria-hidden="true">
        <p className="flex items-center gap-2 text-[12px] font-semibold"><Clock size={15} className="text-cyan" /> Punched in</p>
        <p className="mt-1 text-[22px] font-mono font-semibold">09:34 AM</p>
      </div>

      <p className="relative z-10 text-[12px] text-white/50">{BRAND.poweredBy}</p>
    </aside>
  )
}

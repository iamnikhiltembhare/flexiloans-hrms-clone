import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from '../components/Logo.jsx'
import { ACCOUNTS, ROLES } from '../data/accounts.js'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) { setError('Please enter both your username and password.'); return }
    if (!login(username.trim(), password)) { setError('That username and password do not match an account.'); return }
    navigate('/', { replace: true })
  }

  const fill = (u, p) => { setUsername(u); setPassword(p); setError('') }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center px-4">
      <svg className="absolute bottom-0 left-0 w-full pointer-events-none" viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 210 C 320 90 560 330 840 240 C 1100 160 1280 260 1440 200 V420 H0 Z" fill="#E8EDF7" />
        <path d="M0 290 C 300 190 620 380 900 300 C 1140 232 1300 320 1440 280 V420 H0 Z" fill="#DDE6F5" />
      </svg>

      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo variant="dark" size={40} /></div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/50" />
            <input className="w-full rounded-full border border-line bg-white pl-11 pr-4 py-3 text-[13px] outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/20"
              placeholder="Your Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/50" />
            <input type={show ? 'text' : 'password'}
              className="w-full rounded-full border border-line bg-white pl-11 pr-11 py-3 text-[13px] outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/20"
              placeholder="Your Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label="Toggle password visibility"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-navy/50 hover:text-navy">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <p className="text-[12px] text-[#DC2626] px-2">{error}</p>}

          <button type="submit"
            className="w-full rounded-full py-3 text-[15px] font-medium text-white tracking-wide transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(90deg,#7FD4EE 0%,#3FBEE4 50%,#7FD4EE 100%)' }}>
            LOGIN
          </button>
        </form>

        <ul className="mt-5 space-y-1.5 text-[12px] list-disc pl-5 marker:text-navy/40">
          <li><a href="#" className="text-navy underline hover:text-cyan">Forgot your password?</a></li>
          <li><a href="#" className="text-navy underline hover:text-cyan">Forgot your username?</a></li>
        </ul>

        <p className="mt-8 text-center text-[12px] text-muted">Powered by uKnowva</p>

        <div className="mt-6 rounded-card border border-line bg-canvas/70 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-faint mb-2">Demo build - test logins</p>
          {ACCOUNTS.map((a) => (
            <button key={a.username} type="button" onClick={() => fill(a.username, a.password)}
              className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-white transition-colors">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-navy">{ROLES[a.role].label}</span>
                <span className="text-[10px] font-mono text-muted">{a.username}</span>
              </span>
              <span className="block text-[10px] text-muted mt-0.5">{ROLES[a.role].description}</span>
            </button>
          ))}
          <p className="text-[10px] text-faint mt-2 px-2.5">Click a row to fill the form.</p>
        </div>
      </div>
    </div>
  )
}

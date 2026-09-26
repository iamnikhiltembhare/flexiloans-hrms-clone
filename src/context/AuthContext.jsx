import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authenticate } from '../data/accounts.js'
import { API_MODE, api, session, setUnauthorizedHandler } from '../lib/api.js'

const AuthContext = createContext(null)
const USER_KEY = 'fl_hrms_v1:user'

const saveUser = (u) => { try { localStorage.setItem(USER_KEY, JSON.stringify(u)) } catch { /* ignore */ } }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem(USER_KEY))
      // A cached user without a token cannot talk to the server.
      return API_MODE && !session.get() ? null : u
    } catch { return null }
  })

  const logout = useCallback(() => {
    setUser(null)
    session.clear()
    try { localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
  }, [])

  // Resolves to '' on success or to the message to show on the form.
  const login = useCallback(async (username, password) => {
    if (!API_MODE) {
      const u = authenticate(username, password)
      if (!u) return 'That username and password do not match an account.'
      setUser(u)
      saveUser(u)
      return ''
    }
    try {
      const { token, user: u } = await api('/api/auth/login', { method: 'POST', body: { username, password }, auth: false })
      session.set(token)
      setUser(u)
      saveUser(u)
      return ''
    } catch (err) {
      return err.message
    }
  }, [])

  // With a server, re-check the saved session on launch and sign out on any
  // 401, so a revoked or expired token never leaves a half-working app.
  useEffect(() => {
    if (!API_MODE) return
    setUnauthorizedHandler(logout)
    if (!session.get()) return
    api('/api/auth/me')
      .then(({ user: u }) => { setUser(u); saveUser(u) })
      .catch(() => { /* offline: keep the cached user; a 401 already signed out */ })
  }, [logout])

  // Permission check used by the sidebar and the route guards.
  const can = useCallback((perm) => {
    if (!user) return false
    if (!perm) return true
    return (user.perms || []).includes(perm)
  }, [user])

  const value = useMemo(
    () => ({ user, login, logout, can, role: user?.roleKey || null }),
    [user, login, logout, can])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

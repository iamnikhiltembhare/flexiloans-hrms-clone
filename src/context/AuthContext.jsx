import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { authenticate } from '../data/accounts.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('fl_hrms_user')) } catch { return null }
  })

  const login = useCallback((username, password) => {
    const u = authenticate(username, password)
    if (!u) return false
    setUser(u)
    try { sessionStorage.setItem('fl_hrms_user', JSON.stringify(u)) } catch { /* ignore */ }
    return true
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    try { sessionStorage.removeItem('fl_hrms_user') } catch { /* ignore */ }
  }, [])

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

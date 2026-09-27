// Users a super admin creates in the offline demo. There is no server, so
// they live in this browser only, alongside the rest of the demo data.

import { readStored, writeStored } from './persist.js'
import { ROLES } from '../data/accounts.js'

const KEY = 'createdAccounts'

export const createdAccounts = () => readStored(KEY, [])

export function addCreatedAccount(account) {
  writeStored(KEY, [...createdAccounts(), account])
}

/** Sign-in check for the offline demo's admin-created users. */
export function authenticateCreated(username, password) {
  const u = String(username).trim().toLowerCase()
  const found = createdAccounts().find((a) => a.username === u)
  if (!found || found.password !== password) return null
  const role = ROLES[found.role]
  return { ...found.profile, username: found.username, roleKey: found.role, role: role.label, dashboard: role.dashboard, perms: role.perms }
}

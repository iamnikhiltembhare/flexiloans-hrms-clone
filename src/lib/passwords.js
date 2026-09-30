// Password rules, shared by the API (recovery, change password, new users)
// and the screens, so both give the same message.

export function passwordProblem(password, { username, name } = {}) {
  const p = String(password || '')
  if (p.length < 8) return 'The password needs at least 8 characters'
  if (p.length > 128) return 'The password can be at most 128 characters'
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return 'The password needs both letters and numbers'
  const low = p.toLowerCase()
  if (username && low.includes(String(username).toLowerCase())) return 'The password cannot contain your username'
  if (name && String(name).split(/\s+/).some((w) => w.length > 3 && low.includes(w.toLowerCase()))) return 'The password cannot contain your name'
  if (/^(password|qwerty|welcome|flexiloans|letmein)\d*$/i.test(p) || /(.)\1{5,}/.test(p)) return 'That password is too easy to guess'
  return null
}

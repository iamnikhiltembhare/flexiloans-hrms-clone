import { useEffect, useRef, useState } from 'react'

// Everything the demo remembers lives under this prefix. Bump the version
// when a stored shape changes so old data is ignored rather than crashing.
export const STORE_PREFIX = 'fl_hrms_v1:'

const key = (name) => STORE_PREFIX + name

export function readStored(name, fallback) {
  try {
    const raw = localStorage.getItem(key(name))
    if (raw === null) return fallback
    const parsed = JSON.parse(raw)
    return parsed === null || parsed === undefined ? fallback : parsed
  } catch {
    // Private windows, blocked storage or corrupt JSON: fall back to the seed.
    return fallback
  }
}

export function writeStored(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value))
    return true
  } catch {
    // Quota exceeded or storage unavailable - the app keeps working in memory.
    return false
  }
}

/**
 * useState that survives a reload. Same signature as useState, plus the stored
 * key. Reads once on mount and writes on every change.
 */
export function usePersistentState(name, initial) {
  const [value, setValue] = useState(() => readStored(name, typeof initial === 'function' ? initial() : initial))
  const first = useRef(true)

  useEffect(() => {
    // Skip the write triggered by the initial render.
    if (first.current) { first.current = false; return }
    writeStored(name, value)
  }, [name, value])

  return [value, setValue]
}

/** Clear every key this app owns and hand back how many were removed. */
export function clearStoredState() {
  try {
    const doomed = Object.keys(localStorage).filter((k) => k.startsWith(STORE_PREFIX))
    doomed.forEach((k) => localStorage.removeItem(k))
    return doomed.length
  } catch {
    return 0
  }
}

/** Rough size of what we are storing, for the Settings readout. */
export function storedSize() {
  try {
    const bytes = Object.keys(localStorage)
      .filter((k) => k.startsWith(STORE_PREFIX))
      .reduce((sum, k) => sum + k.length + (localStorage.getItem(k) || '').length, 0)
    return bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB'
  } catch {
    return 'unavailable'
  }
}

/** True when the browser actually lets us persist. */
export function storageAvailable() {
  try {
    const probe = STORE_PREFIX + 'probe'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

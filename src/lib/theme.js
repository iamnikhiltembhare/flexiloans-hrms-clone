// Light / dark theme. The choice is 'light', 'dark' or 'system' (follow the
// device), remembered per device. index.html applies it before first paint;
// this module keeps it in sync afterwards and tells React about changes.

import { useSyncExternalStore } from 'react'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

const KEY = 'fl_hrms_v1:theme'
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
const listeners = new Set()

function readChoice() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}

let choice = readChoice()
const resolve = (c) => (c === 'system' ? (media?.matches ? 'dark' : 'light') : c)

function apply() {
  const dark = resolve(choice) === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111B2D' : '#FFFFFF')
  // Status-bar icons: light on the dark top bar, dark on the white one.
  if (Capacitor.isNativePlatform()) {
    SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  }
  listeners.forEach((fn) => fn())
}

media?.addEventListener?.('change', () => { if (choice === 'system') apply() })
apply()

export function setTheme(next) {
  choice = next
  try {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch { /* not remembered, still applied */ }
  // Cross-fade the colour change instead of snapping.
  document.documentElement.classList.add('theme-anim')
  apply()
  setTimeout(() => document.documentElement.classList.remove('theme-anim'), 350)
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
const snapshot = () => choice + ':' + resolve(choice)

/** { choice: 'light'|'dark'|'system', resolved: 'light'|'dark', setTheme, toggle } */
export function useTheme() {
  const [c, resolved] = useSyncExternalStore(subscribe, snapshot).split(':')
  return {
    choice: c,
    resolved,
    setTheme,
    toggle: () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
  }
}

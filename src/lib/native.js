// Native (Capacitor) integration. Every export is a safe no-op in a normal
// browser, so the web build and the Android app share the same code.

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { SplashScreen } from '@capacitor/splash-screen'

export const IS_NATIVE = Capacitor.isNativePlatform()

/** A light tap for toggles and navigation, or a success/warning buzz. */
export function haptic(kind = 'light') {
  if (!IS_NATIVE) return
  const run = kind === 'success' ? Haptics.notification({ type: NotificationType.Success })
    : kind === 'warning' ? Haptics.notification({ type: NotificationType.Warning })
      : Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
  run.catch(() => {})
}

// --- Android back button -------------------------------------------------
// Open overlays (dialogs, the side menu) register a close handler; the back
// button closes the newest one first, then walks back through history, and
// only leaves the app from the home screen.

const backStack = []

/** While `active`, the hardware back button calls `onBack` instead of navigating. */
export function useBackHandler(active, onBack) {
  const latest = useRef(onBack)
  useEffect(() => { latest.current = onBack })
  useEffect(() => {
    if (!active) return
    const entry = () => latest.current()
    backStack.push(entry)
    return () => {
      const i = backStack.lastIndexOf(entry)
      if (i >= 0) backStack.splice(i, 1)
    }
  }, [active])
}

/**
 * One-time native setup. `goBack` returns false when there is nowhere left
 * to go, which exits the app.
 */
export function startNative({ goBack }) {
  if (!IS_NATIVE) return () => {}
  document.documentElement.classList.add('native')

  // Status-bar icon colour follows the theme (lib/theme.js).
  // Let React paint once before revealing the app.
  requestAnimationFrame(() => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}))

  const sub = NativeApp.addListener('backButton', () => {
    if (backStack.length) { backStack[backStack.length - 1](); return }
    if (!goBack()) NativeApp.exitApp()
  })
  return () => { sub.then((s) => s.remove()) }
}

import { useEffect, useRef, useState } from 'react'
import { haptic } from './native.js'

const TRIGGER = 72   // px of (damped) pull needed to refresh
const MAX = 110

/**
 * Pull-to-refresh on a scroll container, for touch screens.
 * Returns [ref for the container, pull distance, refreshing flag].
 */
export function usePullToRefresh(onRefresh, enabled = true) {
  const ref = useRef(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const latest = useRef(onRefresh)
  useEffect(() => { latest.current = onRefresh })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let startY = null
    let distance = 0
    let armed = false

    const down = (e) => { startY = el.scrollTop <= 0 ? e.touches[0].clientY : null }
    const move = (e) => {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) { distance = 0; setPull(0); return }
      distance = Math.min(MAX, dy * 0.5)
      if (distance >= TRIGGER !== armed) { armed = distance >= TRIGGER; if (armed) haptic() }
      setPull(distance)
    }
    const up = async () => {
      if (startY === null) return
      startY = null
      if (distance >= TRIGGER) {
        setRefreshing(true)
        setPull(TRIGGER * 0.75)
        try { await latest.current() } finally { setRefreshing(false); setPull(0) }
      } else {
        setPull(0)
      }
      distance = 0
      armed = false
    }

    el.addEventListener('touchstart', down, { passive: true })
    el.addEventListener('touchmove', move, { passive: true })
    el.addEventListener('touchend', up)
    el.addEventListener('touchcancel', up)
    return () => {
      el.removeEventListener('touchstart', down)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', up)
      el.removeEventListener('touchcancel', up)
    }
  }, [enabled])

  return [ref, pull, refreshing, TRIGGER]
}

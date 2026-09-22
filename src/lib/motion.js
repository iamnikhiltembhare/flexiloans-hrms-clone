import { useEffect, useRef, useState } from 'react'

/** True when the viewer has asked the OS to reduce motion. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  useEffect(() => {
    let mq
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)') } catch { return }
    const on = (e) => setReduced(e.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/**
 * 3D tilt that follows the pointer across an element. Returns a ref to attach
 * plus handlers; the transform is written straight to the node so React never
 * re-renders during the movement.
 */
export function useTilt({ max = 7, scale = 1.015, glare = true } = {}) {
  const ref = useRef(null)
  const reduced = usePrefersReducedMotion()
  const frame = useRef(0)

  const apply = (e) => {
    const el = ref.current
    if (!el || reduced) return
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      const rx = (0.5 - py) * max * 2
      const ry = (px - 0.5) * max * 2
      el.style.transform =
        `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale})`
      if (glare) {
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%')
        el.style.setProperty('--gy', (py * 100).toFixed(1) + '%')
        el.style.setProperty('--ga', '1')
      }
    })
  }

  const reset = () => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(frame.current)
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
    if (glare) el.style.setProperty('--ga', '0')
  }

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return { ref, onMouseMove: apply, onMouseLeave: reset, disabled: reduced }
}

/**
 * Pointer position normalised to -1..1 around the centre of the viewport,
 * for parallax scenes. Updates via rAF and writes to CSS custom properties
 * on the supplied node.
 */
export function useParallaxScene() {
  const ref = useRef(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    let frame = 0
    const move = (e) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2
        const y = (e.clientY / window.innerHeight - 0.5) * 2
        el.style.setProperty('--px', x.toFixed(3))
        el.style.setProperty('--py', y.toFixed(3))
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame) }
  }, [reduced])

  return ref
}

/**
 * Counts a numeric value up on mount, keeping any prefix or suffix
 * (currency symbol, "/6", "d") and the en-IN grouping intact.
 */
export function useCountUp(value, { duration = 900 } = {}) {
  const reduced = usePrefersReducedMotion()
  const raw = String(value ?? '')
  const match = raw.match(/^(\D*?)([\d][\d,]*)(.*)$/s)
  const target = match ? Number(match[2].replace(/,/g, '')) : null
  const [n, setN] = useState(() => (target === null || reduced ? target : 0))

  useEffect(() => {
    if (target === null || reduced) { setN(target); return }
    let frame = 0
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setN(Math.round(target * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, reduced])

  if (target === null) return raw
  const grouped = (n ?? 0).toLocaleString('en-IN')
  return match[1] + grouped + match[3]
}

/** Adds a class once the element scrolls into view, for reveal-on-scroll. */
export function useReveal() {
  const ref = useRef(null)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) { el.classList.add('is-in'); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('is-in'); io.disconnect() }
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])
  return ref
}

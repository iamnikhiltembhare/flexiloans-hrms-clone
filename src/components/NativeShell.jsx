import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { startNative } from '../lib/native.js'

// Wires the Android back button to the router. Renders nothing.
export default function NativeShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const path = useRef(location.pathname)
  useEffect(() => { path.current = location.pathname }, [location.pathname])

  useEffect(() => startNative({
    goBack: () => {
      if (path.current === '/' || path.current === '/login') return false
      // React Router records its position in history.state.idx.
      if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
      else navigate('/', { replace: true })
      return true
    },
  }), [navigate])

  return null
}

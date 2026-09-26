import { useEffect, useState } from 'react'
import { dayKey } from '../lib/date'

/**
 * The current local calendar day, kept fresh when the app is left open past
 * midnight or resumed from the background (a PWA can sit suspended for days).
 */
export function useCurrentDay(): string {
  const [today, setToday] = useState(() => dayKey(new Date()))

  useEffect(() => {
    const refresh = () => setToday(dayKey(new Date()))
    const interval = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}

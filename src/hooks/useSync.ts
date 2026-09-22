import { useEffect, useState } from 'react'
import { onSyncStatusChange, requestSync, setActiveUser, type SyncStatus } from '../lib/sync'

const POLL_INTERVAL_MS = 30_000

export function useSync(userId: string | null) {
  const [status, setStatus] = useState<SyncStatus>('idle')

  useEffect(() => {
    setActiveUser(userId)
    return () => setActiveUser(null)
  }, [userId])

  useEffect(() => {
    const unsubscribe = onSyncStatusChange(setStatus)
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!userId) return
    const interval = setInterval(() => requestSync(0), POLL_INTERVAL_MS)
    const onOnline = () => requestSync(0)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', onOnline)
    }
  }, [userId])

  return status
}

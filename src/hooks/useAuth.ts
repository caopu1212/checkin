import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { clearLocalData } from '../lib/db'
import { supabase } from '../lib/supabase'
import { countUnsyncedRecords } from '../lib/sync'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase 未配置')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    if (!supabase) throw new Error('Supabase 未配置')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    if (!supabase) return
    // Signing out wipes this device's local data, so anything not yet pushed
    // (e.g. check-ins made offline) would be lost for good.
    const unsynced = await countUnsyncedRecords()
    if (
      unsynced > 0 &&
      !window.confirm(`还有 ${unsynced} 条记录没同步到云端，现在退出这些记录会丢失。确定要退出吗？`)
    ) {
      return
    }
    await supabase.auth.signOut()
    await clearLocalData()
  }

  return { session, user: session?.user ?? null, loading, signIn, signUp, signOut }
}

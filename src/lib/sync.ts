import { db, getMeta, setMeta } from './db'
import { isSupabaseConfigured, supabase } from './supabase'
import type { CheckIn } from './types'

interface RemoteRow {
  id: string
  user_id: string
  checked_at: string
  note: string | null
  created_at: string
  updated_at: string
  deleted: boolean
}

const LAST_SYNCED_KEY = 'lastSyncedAt'

function toRemote(row: CheckIn, userId: string) {
  return {
    id: row.id,
    user_id: userId,
    checked_at: row.checkedAt,
    note: row.note,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted: row.deleted,
  }
}

function fromRemote(row: RemoteRow): CheckIn {
  return {
    id: row.id,
    checkedAt: row.checked_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted,
    dirty: false,
  }
}

async function pushLocalChanges(userId: string): Promise<void> {
  if (!supabase) return
  const dirtyRows = (await db.checkins.toArray()).filter((row) => row.dirty)
  if (dirtyRows.length === 0) return

  const { error } = await supabase
    .from('checkins')
    .upsert(dirtyRows.map((row) => toRemote(row, userId)), { onConflict: 'id' })

  if (error) throw error

  await db.transaction('rw', db.checkins, async () => {
    for (const row of dirtyRows) {
      await db.checkins.update(row.id, { dirty: false })
    }
  })
}

async function pullRemoteChanges(userId: string): Promise<void> {
  if (!supabase) return
  const since = (await getMeta(LAST_SYNCED_KEY)) ?? new Date(0).toISOString()
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', since)

  if (error) throw error

  const remoteRows = (data ?? []) as RemoteRow[]

  await db.transaction('rw', db.checkins, async () => {
    for (const remote of remoteRows) {
      const local = await db.checkins.get(remote.id)
      // Local unsynced edit is newer than what the server had when we last pulled:
      // keep the local version, it will win the next push.
      if (local?.dirty && local.updatedAt > remote.updated_at) continue
      await db.checkins.put(fromRemote(remote))
    }
  })

  await setMeta(LAST_SYNCED_KEY, nowIso)
}

export async function syncNow(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return
  await pushLocalChanges(userId)
  await pullRemoteChanges(userId)
}

// --- lightweight global trigger so any part of the app (e.g. after a local
// write) can ask for a sync soon, without threading callbacks everywhere. ---

let activeUserId: string | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let listeners: Array<(status: SyncStatus) => void> = []

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

function notify(status: SyncStatus) {
  for (const listener of listeners) listener(status)
}

export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export function setActiveUser(userId: string | null): void {
  activeUserId = userId
  if (userId) requestSync(0)
}

export function requestSync(delayMs = 800): void {
  if (!activeUserId || !isSupabaseConfigured) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void runSync()
  }, delayMs)
}

async function runSync(): Promise<void> {
  if (!activeUserId) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notify('offline')
    return
  }
  notify('syncing')
  try {
    await syncNow(activeUserId)
    notify('idle')
  } catch (err) {
    console.error('sync failed', err)
    notify('error')
  }
}

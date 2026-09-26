import { db, getMeta, LAST_SYNCED_KEY, LEGACY_CATEGORY_META_KEY, setMeta } from './db'
import { isSupabaseConfigured, supabase } from './supabase'
import type { Category, CheckIn } from './types'

// Supabase/PostgREST caps a single response at 1000 rows by default.
const PAGE_SIZE = 1000
// Re-pull a little before the last sync point to tolerate clock skew between
// devices and rows committed while our previous pull was in flight. Re-applying
// a row is harmless (it's an idempotent put).
const PULL_OVERLAP_MS = 5 * 60 * 1000

interface RemoteCheckIn {
  id: string
  user_id: string
  category_id: string | null
  checked_at: string
  note: string | null
  created_at: string
  updated_at: string
  deleted: boolean
}

interface RemoteCategory {
  id: string
  user_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted: boolean
}

function checkInToRemote(row: CheckIn, userId: string, updatedAt: string): RemoteCheckIn {
  return {
    id: row.id,
    user_id: userId,
    category_id: row.categoryId,
    checked_at: row.checkedAt,
    note: row.note,
    created_at: row.createdAt,
    updated_at: updatedAt,
    deleted: row.deleted,
  }
}

function checkInFromRemote(row: RemoteCheckIn, fallbackCategoryId: string | undefined): CheckIn {
  return {
    id: row.id,
    categoryId: row.category_id ?? fallbackCategoryId ?? '',
    checkedAt: row.checked_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted,
    // A row with no category came from a pre-categories client; once we've
    // filled one in locally, push it back so the server copy gets fixed too.
    dirty: row.category_id == null && fallbackCategoryId != null,
  }
}

/**
 * A dirty local row is an edit this device hasn't pushed yet; only a strictly
 * newer server copy (someone else wrote later) should replace it - ties go to
 * the local edit, since it will be pushed next. Compared as instants, not
 * strings: Supabase returns "+00:00" offsets while the client writes "Z".
 */
function localEditWins(local: { dirty: boolean; updatedAt: string } | undefined, remoteUpdatedAt: string): boolean {
  return !!local?.dirty && Date.parse(local.updatedAt) >= Date.parse(remoteUpdatedAt)
}

/**
 * Clears the dirty flag only on rows that weren't edited again while the push
 * was in flight - otherwise that newer edit would be silently marked as synced.
 */
async function markPushed<T extends { id: string; updatedAt: string }>(
  table: typeof db.checkins | typeof db.categories,
  pushed: T[],
  stampedAt: string | null,
): Promise<void> {
  await db.transaction('rw', table, async () => {
    for (const row of pushed) {
      const current = await table.get(row.id)
      if (!current || current.updatedAt !== row.updatedAt) continue
      await table.update(row.id, stampedAt ? { dirty: false, updatedAt: stampedAt } : { dirty: false })
    }
  })
}

function categoryToRemote(row: Category, userId: string): RemoteCategory {
  return {
    id: row.id,
    user_id: userId,
    name: row.name,
    sort_order: row.order,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted: row.deleted,
  }
}

function categoryFromRemote(row: RemoteCategory): Category {
  return {
    id: row.id,
    name: row.name,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted,
    dirty: false,
  }
}

async function pushDirtyCategories(userId: string): Promise<void> {
  if (!supabase) return
  const dirtyRows = (await db.categories.toArray()).filter((row) => row.dirty)
  if (dirtyRows.length === 0) return

  const { error } = await supabase
    .from('categories')
    .upsert(dirtyRows.map((row) => categoryToRemote(row, userId)), { onConflict: 'id' })
  if (error) throw error

  // Categories are always pulled in full, so no need to re-stamp updated_at.
  await markPushed(db.categories, dirtyRows, null)
}

/** Used by the first-run category migration to check whether another device already created categories before we pull them down. */
export async function hasAnyRemoteCategories(userId: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.from('categories').select('id').eq('user_id', userId).limit(1)
  if (error) return false // e.g. table doesn't exist yet (pre-migration) - nothing to worry about
  return (data?.length ?? 0) > 0
}

export async function pullAllCategories(userId: string): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.from('categories').select('*').eq('user_id', userId)
  if (error) throw error

  const remoteRows = (data ?? []) as RemoteCategory[]
  await db.transaction('rw', db.categories, async () => {
    for (const remote of remoteRows) {
      const local = await db.categories.get(remote.id)
      if (localEditWins(local, remote.updated_at)) continue
      await db.categories.put(categoryFromRemote(remote))
    }
  })
}

async function pushLocalChanges(userId: string): Promise<void> {
  if (!supabase) return
  const dirtyRows = (await db.checkins.toArray()).filter((row) => row.dirty)
  if (dirtyRows.length === 0) return

  // Stamp updated_at with the push time rather than the edit time. Other
  // devices pull "updated_at > my last sync", so a row created offline days ago
  // and pushed now would otherwise carry an old timestamp and never be pulled.
  const stampedAt = new Date().toISOString()
  for (let i = 0; i < dirtyRows.length; i += PAGE_SIZE) {
    const chunk = dirtyRows.slice(i, i + PAGE_SIZE)
    const { error } = await supabase
      .from('checkins')
      .upsert(chunk.map((row) => checkInToRemote(row, userId, stampedAt)), { onConflict: 'id' })
    if (error) throw error
    await markPushed(db.checkins, chunk, stampedAt)
  }
}

async function pullRemoteChanges(userId: string): Promise<void> {
  if (!supabase) return
  const lastSynced = await getMeta(LAST_SYNCED_KEY)
  const since = lastSynced
    ? new Date(new Date(lastSynced).getTime() - PULL_OVERLAP_MS).toISOString()
    : new Date(0).toISOString()
  const nowIso = new Date().toISOString()
  const legacyCategoryId = await getMeta(LEGACY_CATEGORY_META_KEY)

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const remoteRows = (data ?? []) as RemoteCheckIn[]

    await db.transaction('rw', db.checkins, async () => {
      for (const remote of remoteRows) {
        const local = await db.checkins.get(remote.id)
        if (localEditWins(local, remote.updated_at)) continue
        await db.checkins.put(checkInFromRemote(remote, legacyCategoryId))
      }
    })

    if (remoteRows.length < PAGE_SIZE) break
  }

  await setMeta(LAST_SYNCED_KEY, nowIso)
}

export async function syncNow(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return
  await pushDirtyCategories(userId)
  await pullAllCategories(userId)
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

let syncInFlight = false
let resyncRequested = false

async function runSync(): Promise<void> {
  if (!activeUserId) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notify('offline')
    return
  }
  // Two overlapping runs could both push the same dirty rows and interleave
  // their pulls; instead, remember that another run was wanted and do it after.
  if (syncInFlight) {
    resyncRequested = true
    return
  }
  syncInFlight = true
  notify('syncing')
  try {
    await syncNow(activeUserId)
    notify('idle')
  } catch (err) {
    console.error('sync failed', err)
    notify('error')
  } finally {
    syncInFlight = false
    if (resyncRequested) {
      resyncRequested = false
      requestSync(0)
    }
  }
}

export async function countUnsyncedRecords(): Promise<number> {
  const [checkins, categories] = await Promise.all([
    db.checkins.filter((r) => r.dirty).count(),
    db.categories.filter((r) => r.dirty).count(),
  ])
  return checkins + categories
}

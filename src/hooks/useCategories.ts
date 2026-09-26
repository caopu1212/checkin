import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect } from 'react'
import { db, getMeta, LEGACY_CATEGORY_META_KEY, setMeta } from '../lib/db'
import { hasAnyRemoteCategories, pullAllCategories, requestSync } from '../lib/sync'
import type { Category } from '../lib/types'

const MIGRATION_FLAG_KEY = 'categoryMigrationDone'

function newId(): string {
  return crypto.randomUUID()
}

/** The first-created category (lowest `order`) is treated as the one legacy data belongs to. */
async function adoptLegacyCategoryFromLocal(): Promise<void> {
  if (await getMeta(LEGACY_CATEGORY_META_KEY)) return
  const local = await db.categories.filter((c) => !c.deleted).sortBy('order')
  if (local.length > 0) await setMeta(LEGACY_CATEGORY_META_KEY, local[0].id)
}

/**
 * Any check-in without a category would be invisible (every view filters by
 * category). These can appear from pre-categories data, or be pulled down
 * before this device learned which category is the legacy one.
 */
async function reassignOrphansToLegacy(): Promise<void> {
  const legacyId = await getMeta(LEGACY_CATEGORY_META_KEY)
  if (!legacyId) return
  const orphans = await db.checkins.filter((c) => !c.categoryId).toArray()
  if (orphans.length === 0) return
  const now = new Date().toISOString()
  await db.transaction('rw', db.checkins, async () => {
    for (const c of orphans) {
      await db.checkins.update(c.id, { categoryId: legacyId, dirty: true, updatedAt: now })
    }
  })
  requestSync(0)
}

/**
 * One-time, per-device migration: this app didn't always have categories.
 * The first time it runs after the update, it creates two starter categories
 * and folds every pre-existing check-in into the first one.
 */
async function ensureDefaultCategories(userId: string): Promise<void> {
  if ((await getMeta(MIGRATION_FLAG_KEY)) !== 'true') {
    await createOrAdoptCategories(userId)
    await setMeta(MIGRATION_FLAG_KEY, 'true')
  }
  await reassignOrphansToLegacy()
}

async function createOrAdoptCategories(userId: string): Promise<void> {
  const existingCategories = await db.categories.filter((c) => !c.deleted).toArray()
  if (existingCategories.length > 0) {
    // Already synced down from another device - nothing to create here.
    await adoptLegacyCategoryFromLocal()
    return
  }

  // Another device may have already run this migration and pushed its
  // categories up - check the server before creating a second, competing set.
  if (await hasAnyRemoteCategories(userId)) {
    await pullAllCategories(userId)
    await adoptLegacyCategoryFromLocal()
    return
  }

  const now = new Date().toISOString()
  const categoryA: Category = {
    id: newId(),
    name: '事情A',
    order: 0,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    dirty: true,
  }
  const categoryB: Category = {
    id: newId(),
    name: '事情B',
    order: 1,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    dirty: true,
  }
  await db.categories.bulkPut([categoryA, categoryB])
  await setMeta(LEGACY_CATEGORY_META_KEY, categoryA.id)
  requestSync(0)
}

// Module-level singleton so concurrent callers (React StrictMode's double-invoke,
// or just two components mounting at once) await the same run instead of racing
// each other and each seeing "0 categories yet". Keyed by user so signing out
// and into a different account in the same tab still runs it for them.
let migration: { userId: string; promise: Promise<void> } | null = null
function ensureDefaultCategoriesOnce(userId: string): Promise<void> {
  if (!migration || migration.userId !== userId) {
    migration = { userId, promise: ensureDefaultCategories(userId) }
  }
  return migration.promise
}

export function useCategories(userId: string) {
  useEffect(() => {
    void ensureDefaultCategoriesOnce(userId)
  }, [userId])

  const categories = useLiveQuery(
    () => db.categories.filter((c) => !c.deleted).sortBy('order'),
    [],
    [] as Category[],
  )

  const addCategory = useCallback(async (name: string) => {
    const now = new Date().toISOString()
    const existing = await db.categories.filter((c) => !c.deleted).toArray()
    const maxOrder = existing.reduce((m, c) => Math.max(m, c.order), -1)
    const row: Category = {
      id: newId(),
      name,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      dirty: true,
    }
    await db.categories.put(row)
    requestSync()
    return row
  }, [])

  const renameCategory = useCallback(async (id: string, name: string) => {
    await db.categories.update(id, { name, updatedAt: new Date().toISOString(), dirty: true })
    requestSync()
  }, [])

  const deleteCategory = useCallback(async (id: string) => {
    await db.categories.update(id, { deleted: true, updatedAt: new Date().toISOString(), dirty: true })
    requestSync()
  }, [])

  return { categories: categories ?? [], addCategory, renameCategory, deleteCategory }
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect } from 'react'
import { db, getMeta, setMeta } from '../lib/db'
import { hasAnyRemoteCategories, pullAllCategories, requestSync } from '../lib/sync'
import type { Category } from '../lib/types'

const MIGRATION_FLAG_KEY = 'categoryMigrationDone'
const LEGACY_CATEGORY_META_KEY = 'legacyCategoryId'

function newId(): string {
  return crypto.randomUUID()
}

/**
 * One-time, per-device migration: this app didn't always have categories.
 * The first time it runs after the update, it creates two starter categories
 * and folds every pre-existing check-in (which predates categories entirely)
 * into the first one, so nothing is silently dropped or unreachable.
 */
/** The first-created category (lowest `order`) is treated as the one legacy data belongs to. */
async function adoptLegacyCategoryFromLocal(): Promise<void> {
  const local = await db.categories.filter((c) => !c.deleted).sortBy('order')
  if (local.length > 0) await setMeta(LEGACY_CATEGORY_META_KEY, local[0].id)
}

async function ensureDefaultCategories(userId: string): Promise<void> {
  if ((await getMeta(MIGRATION_FLAG_KEY)) === 'true') return

  const existingCategories = await db.categories.filter((c) => !c.deleted).toArray()
  if (existingCategories.length > 0) {
    // Already synced down from another device - nothing to create here.
    await adoptLegacyCategoryFromLocal()
    await setMeta(MIGRATION_FLAG_KEY, 'true')
    return
  }

  // Another device may have already run this migration and pushed its
  // categories up - check the server before creating a second, competing set.
  if (await hasAnyRemoteCategories(userId)) {
    await pullAllCategories(userId)
    await adoptLegacyCategoryFromLocal()
    await setMeta(MIGRATION_FLAG_KEY, 'true')
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

  const orphanCheckIns = await db.checkins.filter((c) => !c.categoryId).toArray()
  if (orphanCheckIns.length > 0) {
    await db.transaction('rw', db.checkins, async () => {
      for (const c of orphanCheckIns) {
        await db.checkins.update(c.id, { categoryId: categoryA.id, dirty: true, updatedAt: now })
      }
    })
  }

  await setMeta(MIGRATION_FLAG_KEY, 'true')
  requestSync(0)
}

export async function getLegacyCategoryId(): Promise<string | undefined> {
  return getMeta(LEGACY_CATEGORY_META_KEY)
}

// Module-level singleton so concurrent callers (React StrictMode's double-invoke,
// or just two components mounting at once) await the same run instead of racing
// each other and each seeing "0 categories yet".
let migrationPromise: Promise<void> | null = null
function ensureDefaultCategoriesOnce(userId: string): Promise<void> {
  if (!migrationPromise) migrationPromise = ensureDefaultCategories(userId)
  return migrationPromise
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

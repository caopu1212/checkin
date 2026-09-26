import Dexie, { type Table } from 'dexie'
import type { CheckIn, Category } from './types'

interface MetaRow {
  key: string
  value: string
}

class AppDatabase extends Dexie {
  checkins!: Table<CheckIn, string>
  categories!: Table<Category, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('checkin-app')
    this.version(1).stores({
      checkins: 'id, checkedAt, updatedAt, dirty, deleted',
      meta: 'key',
    })
    this.version(2).stores({
      checkins: 'id, checkedAt, updatedAt, dirty, deleted, categoryId',
      categories: 'id, updatedAt, dirty, deleted',
      meta: 'key',
    })
  }
}

export const db = new AppDatabase()

export const LAST_SYNCED_KEY = 'lastSyncedAt'
export const LEGACY_CATEGORY_META_KEY = 'legacyCategoryId'

export async function getMeta(key: string): Promise<string | undefined> {
  const row = await db.meta.get(key)
  return row?.value
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}

/** Wipes all local data, used on sign-out so the next user doesn't see stale records. */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.checkins, db.categories, db.meta, async () => {
    await db.checkins.clear()
    await db.categories.clear()
    await db.meta.clear()
  })
}

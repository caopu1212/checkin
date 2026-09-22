import Dexie, { type Table } from 'dexie'
import type { CheckIn } from './types'

interface MetaRow {
  key: string
  value: string
}

class AppDatabase extends Dexie {
  checkins!: Table<CheckIn, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('checkin-app')
    this.version(1).stores({
      checkins: 'id, checkedAt, updatedAt, dirty, deleted',
      meta: 'key',
    })
  }
}

export const db = new AppDatabase()

export async function getMeta(key: string): Promise<string | undefined> {
  const row = await db.meta.get(key)
  return row?.value
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}

/** Wipes all local data, used on sign-out so the next user doesn't see stale records. */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.checkins, db.meta, async () => {
    await db.checkins.clear()
    await db.meta.clear()
  })
}

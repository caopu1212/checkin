import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback } from 'react'
import { db } from '../lib/db'
import { requestSync } from '../lib/sync'
import type { CheckIn } from '../lib/types'

function newId(): string {
  return crypto.randomUUID()
}

export function useCheckins(categoryId: string) {
  const checkins = useLiveQuery(
    () => db.checkins.where('categoryId').equals(categoryId).filter((c) => !c.deleted).sortBy('checkedAt'),
    [categoryId],
    [] as CheckIn[],
  )

  const addCheckIn = useCallback(
    async (checkedAt: Date, note: string | null = null) => {
      const now = new Date().toISOString()
      const row: CheckIn = {
        id: newId(),
        categoryId,
        checkedAt: checkedAt.toISOString(),
        note,
        createdAt: now,
        updatedAt: now,
        deleted: false,
        dirty: true,
      }
      await db.checkins.put(row)
      requestSync()
      return row
    },
    [categoryId],
  )

  const updateCheckIn = useCallback(
    async (id: string, changes: { checkedAt?: Date; note?: string | null }) => {
      const patch: Partial<CheckIn> = { updatedAt: new Date().toISOString(), dirty: true }
      if (changes.checkedAt) patch.checkedAt = changes.checkedAt.toISOString()
      if ('note' in changes) patch.note = changes.note ?? null
      await db.checkins.update(id, patch)
      requestSync()
    },
    [],
  )

  const deleteCheckIn = useCallback(async (id: string) => {
    await db.checkins.update(id, { deleted: true, dirty: true, updatedAt: new Date().toISOString() })
    requestSync()
  }, [])

  return { checkins: checkins ?? [], addCheckIn, updateCheckIn, deleteCheckIn }
}

import historicalData from '../data/historical-import.json'
import { dayKey } from './date'
import { db } from './db'
import { requestSync } from './sync'
import type { CheckIn } from './types'

const DAY_START_HOUR = 8
const DAY_END_HOUR = 22
export const IMPORT_NOTE = '历史导入'

function timesForCount(n: number): Array<{ hours: number; minutes: number }> {
  const windowHours = DAY_END_HOUR - DAY_START_HOUR
  const times: Array<{ hours: number; minutes: number }> = []
  for (let i = 0; i < n; i++) {
    const fraction = (i + 1) / (n + 1)
    const hourFloat = DAY_START_HOUR + fraction * windowHours
    const hours = Math.floor(hourFloat)
    const minutes = Math.round((hourFloat - hours) * 60)
    times.push({ hours, minutes })
  }
  return times
}

export interface ImportSummary {
  alreadyImported: boolean
  days: number
  total: number
  skipped: number
}

/**
 * `categoryCheckins` should include soft-deleted rows: if any imported row
 * exists in this category (on this device or synced from another one), the
 * import already happened and must not be offered again.
 */
export function summarizeImport(categoryCheckins: CheckIn[]): ImportSummary {
  const data = historicalData as [string, number][]
  const alreadyImported = categoryCheckins.some((c) => c.note === IMPORT_NOTE)
  // Compare by *local* calendar day: slicing the ISO string would give the UTC
  // date, which is the previous day for early-morning check-ins in UTC+9.
  const existingDays = new Set(
    categoryCheckins.filter((c) => !c.deleted).map((c) => dayKey(new Date(c.checkedAt))),
  )
  const toImport = data.filter(([dateStr]) => !existingDays.has(dateStr))
  return {
    alreadyImported,
    days: toImport.length,
    total: toImport.reduce((sum, [, count]) => sum + count, 0),
    skipped: data.length - toImport.length,
  }
}

export async function runHistoricalImport(categoryId: string): Promise<number> {
  const data = historicalData as [string, number][]
  const now = new Date().toISOString()

  // Re-check against the freshest local data at click time, not the summary
  // the card was rendered with.
  const categoryCheckins = await db.checkins.where('categoryId').equals(categoryId).toArray()
  const summary = summarizeImport(categoryCheckins)
  if (summary.alreadyImported) return 0
  const existingDays = new Set(
    categoryCheckins.filter((c) => !c.deleted).map((c) => dayKey(new Date(c.checkedAt))),
  )

  const rows: CheckIn[] = []
  for (const [dateStr, count] of data) {
    if (existingDays.has(dateStr)) continue
    for (const { hours, minutes } of timesForCount(count)) {
      const d = new Date(`${dateStr}T00:00:00`)
      d.setHours(hours, minutes, 0, 0)
      rows.push({
        id: crypto.randomUUID(),
        categoryId,
        checkedAt: d.toISOString(),
        note: IMPORT_NOTE,
        createdAt: now,
        updatedAt: now,
        deleted: false,
        dirty: true,
      })
    }
  }

  await db.checkins.bulkPut(rows)
  requestSync(0)
  return rows.length
}

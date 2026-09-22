import historicalData from '../data/historical-import.json'
import { db, getMeta, setMeta } from './db'
import { requestSync } from './sync'
import type { CheckIn } from './types'

const IMPORT_FLAG_KEY = 'historicalImportDone'
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

export async function isHistoricalImportDone(): Promise<boolean> {
  return (await getMeta(IMPORT_FLAG_KEY)) === 'true'
}

export async function getImportSummary(): Promise<{ days: number; total: number; skipped: number }> {
  const data = historicalData as [string, number][]
  const existing = await db.checkins.filter((c) => !c.deleted).toArray()
  const existingDays = new Set(existing.map((c) => c.checkedAt.slice(0, 10)))
  const toImport = data.filter(([dateStr]) => !existingDays.has(dateStr))
  return {
    days: toImport.length,
    total: toImport.reduce((sum, [, count]) => sum + count, 0),
    skipped: data.length - toImport.length,
  }
}

export async function runHistoricalImport(): Promise<number> {
  const data = historicalData as [string, number][]
  const now = new Date().toISOString()
  const rows: CheckIn[] = []

  // Skip any date that already has real check-ins (e.g. from using the app
  // before running the import), so we never double-count a day.
  const existing = await db.checkins.filter((c) => !c.deleted).toArray()
  const existingDays = new Set(existing.map((c) => c.checkedAt.slice(0, 10)))

  for (const [dateStr, count] of data) {
    if (existingDays.has(dateStr)) continue
    for (const { hours, minutes } of timesForCount(count)) {
      const d = new Date(`${dateStr}T00:00:00`)
      d.setHours(hours, minutes, 0, 0)
      rows.push({
        id: crypto.randomUUID(),
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
  await setMeta(IMPORT_FLAG_KEY, 'true')
  requestSync(0)
  return rows.length
}

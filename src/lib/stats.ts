import { addDays, isSameMonth, startOfDay, subDays } from 'date-fns'
import { dayKey } from './date'
import type { CheckIn } from './types'

export function groupByDay(checkins: CheckIn[]): Map<string, CheckIn[]> {
  const map = new Map<string, CheckIn[]>()
  for (const c of checkins) {
    const key = dayKey(new Date(c.checkedAt))
    const list = map.get(key)
    if (list) list.push(c)
    else map.set(key, [c])
  }
  return map
}

export function countInMonth(checkins: CheckIn[], monthAnchor: Date): number {
  return checkins.filter((c) => isSameMonth(new Date(c.checkedAt), monthAnchor)).length
}

export interface StreakStats {
  current: number
  longest: number
}

export function computeStreaks(byDay: Map<string, CheckIn[]>): StreakStats {
  const activeDays = new Set(byDay.keys())
  if (activeDays.size === 0) return { current: 0, longest: 0 }

  // current streak: walk backwards from today (or yesterday if today has no check-in yet)
  let current = 0
  let cursor = startOfDay(new Date())
  if (!activeDays.has(dayKey(cursor))) {
    cursor = subDays(cursor, 1)
  }
  while (activeDays.has(dayKey(cursor))) {
    current += 1
    cursor = subDays(cursor, 1)
  }

  // longest streak: scan all days chronologically
  const sortedKeys = [...activeDays].sort()
  let longest = 0
  let run = 0
  let prevDate: Date | null = null
  for (const key of sortedKeys) {
    const date = new Date(`${key}T00:00:00`)
    if (prevDate && dayKey(addDays(prevDate, 1)) === key) {
      run += 1
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    prevDate = date
  }

  return { current, longest }
}

export interface DayCount {
  date: Date
  count: number
}

export function lastNDaysCounts(byDay: Map<string, CheckIn[]>, n: number): DayCount[] {
  const today = startOfDay(new Date())
  const result: DayCount[] = []
  for (let i = n - 1; i >= 0; i--) {
    const date = subDays(today, i)
    result.push({ date, count: byDay.get(dayKey(date))?.length ?? 0 })
  }
  return result
}

import { differenceInCalendarDays, eachMonthOfInterval, format, startOfDay, startOfMonth } from 'date-fns'
import type { CheckIn } from './types'

const WEEKDAY_ORDER = ['一', '二', '三', '四', '五', '六', '日']

export interface WeekdayBucket {
  label: string
  count: number
}

/** Monday-first to match the calendar view's week layout. */
export function weekdayDistribution(checkins: CheckIn[]): WeekdayBucket[] {
  const counts = new Array(7).fill(0)
  for (const c of checkins) {
    const jsDay = new Date(c.checkedAt).getDay() // 0 = Sunday
    const mondayFirst = (jsDay + 6) % 7
    counts[mondayFirst] += 1
  }
  return WEEKDAY_ORDER.map((label, i) => ({ label, count: counts[i] }))
}

export interface MonthBucket {
  key: string // yyyy-MM
  label: string
  count: number
}

export function monthlyTotals(checkins: CheckIn[]): MonthBucket[] {
  if (checkins.length === 0) return []
  const firstMs = Math.min(...checkins.map((c) => new Date(c.checkedAt).getTime()))
  const months = eachMonthOfInterval({ start: startOfMonth(firstMs), end: startOfMonth(new Date()) })
  const counts = new Map<string, number>()
  for (const c of checkins) {
    const key = format(new Date(c.checkedAt), 'yyyy-MM')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return months.map((m) => {
    const key = format(m, 'yyyy-MM')
    return { key, label: format(m, 'yy/MM'), count: counts.get(key) ?? 0 }
  })
}

export interface TrendResult {
  slopePerMonth: number
  direction: 'up' | 'down' | 'flat'
}

/** Ordinary least-squares fit of monthly totals against month index, so the slope reads as "checkins/month change per month". */
export function linearTrend(monthly: MonthBucket[]): TrendResult {
  const n = monthly.length
  if (n < 2) return { slopePerMonth: 0, direction: 'flat' }

  const xs = monthly.map((_, i) => i)
  const ys = monthly.map((m) => m.count)
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = ys.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den

  const direction = slope > 0.15 ? 'up' : slope < -0.15 ? 'down' : 'flat'
  return { slopePerMonth: slope, direction }
}

export interface RegularityStats {
  totalDays: number
  activeDays: number
  activeRatio: number
  avgCycleDays: number
  longestGap: { days: number; startKey: string; endKey: string } | null
}

export function regularityStats(byDay: Map<string, CheckIn[]>, totalDays: number): RegularityStats {
  const activeDays = byDay.size
  const activeRatio = totalDays > 0 ? activeDays / totalDays : 0
  const sortedKeys = [...byDay.keys()].sort()

  if (sortedKeys.length < 2) {
    return { totalDays, activeDays, activeRatio, avgCycleDays: 0, longestGap: null }
  }

  const cycles: number[] = []
  let longestGap: RegularityStats['longestGap'] = null

  for (let i = 1; i < sortedKeys.length; i++) {
    const prev = startOfDay(new Date(`${sortedKeys[i - 1]}T00:00:00`))
    const curr = startOfDay(new Date(`${sortedKeys[i]}T00:00:00`))
    const diff = differenceInCalendarDays(curr, prev)
    cycles.push(diff)
    const gapDays = diff - 1
    if (gapDays > 0 && (!longestGap || gapDays > longestGap.days)) {
      longestGap = { days: gapDays, startKey: sortedKeys[i - 1], endKey: sortedKeys[i] }
    }
  }

  const avgCycleDays = cycles.reduce((a, b) => a + b, 0) / cycles.length
  return { totalDays, activeDays, activeRatio, avgCycleDays, longestGap }
}

const HOUR_BUCKET_LABELS = ['凌晨', '清晨', '上午', '下午', '傍晚', '夜间']

export interface HourBucket {
  label: string
  count: number
}

export function hourDistribution(checkins: CheckIn[]): HourBucket[] {
  const counts = new Array(6).fill(0)
  for (const c of checkins) {
    const hour = new Date(c.checkedAt).getHours()
    counts[Math.floor(hour / 4)] += 1
  }
  return HOUR_BUCKET_LABELS.map((label, i) => ({ label, count: counts[i] }))
}

import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { dayKey } from './date'
import { IMPORT_NOTE } from './historicalImport'
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
  intercept: number
  direction: 'up' | 'down' | 'flat'
  /** Linear extrapolation for the month right after the data ends; never negative. */
  predictedNextMonth: number
}

/** Ordinary least-squares fit of monthly totals against month index, so the slope reads as "checkins/month change per month". */
export function linearTrend(monthly: MonthBucket[]): TrendResult {
  const n = monthly.length
  if (n < 2) return { slopePerMonth: 0, intercept: monthly[0]?.count ?? 0, direction: 'flat', predictedNextMonth: monthly[0]?.count ?? 0 }

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
  const intercept = yMean - slope * xMean

  const direction = slope > 0.15 ? 'up' : slope < -0.15 ? 'down' : 'flat'
  const predictedNextMonth = Math.max(0, slope * n + intercept)
  return { slopePerMonth: slope, intercept, direction, predictedNextMonth }
}

export interface PeriodComparison {
  currentLabel: string
  previousLabel: string
  current: number
  previous: number
}

function countBetween(checkins: CheckIn[], start: Date, end: Date): number {
  return checkins.filter((c) => isWithinInterval(new Date(c.checkedAt), { start, end })).length
}

/** This calendar week (Monday-first) vs the same weekday range last week. */
export function weekOverWeek(checkins: CheckIn[]): PeriodComparison {
  const now = new Date()
  const thisStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisEnd = endOfWeek(now, { weekStartsOn: 1 })
  const lastStart = subWeeks(thisStart, 1)
  const lastEnd = subWeeks(thisEnd, 1)
  return {
    currentLabel: '本周',
    previousLabel: '上周',
    current: countBetween(checkins, thisStart, thisEnd),
    previous: countBetween(checkins, lastStart, lastEnd),
  }
}

/** This calendar month vs last calendar month. */
export function monthOverMonth(checkins: CheckIn[]): PeriodComparison {
  const now = new Date()
  const thisStart = startOfMonth(now)
  const thisEnd = endOfMonth(now)
  const lastMonthAnchor = subMonths(now, 1)
  const lastStart = startOfMonth(lastMonthAnchor)
  const lastEnd = endOfMonth(lastMonthAnchor)
  return {
    currentLabel: '本月',
    previousLabel: '上月',
    current: countBetween(checkins, thisStart, thisEnd),
    previous: countBetween(checkins, lastStart, lastEnd),
  }
}

export interface HeatmapDay {
  date: Date
  key: string
  count: number
  inRange: boolean
}

export interface HeatmapWeek {
  days: HeatmapDay[] // always Monday..Sunday
  monthLabel: string | null // set on the week containing the 1st of a month
}

/** Weekly grid (Monday-first rows of 7) from the first check-in's week through this week, GitHub-contributions style. */
export function buildHeatmap(byDay: Map<string, CheckIn[]>, firstDate: Date | null): HeatmapWeek[] {
  const today = startOfDay(new Date())
  const rangeStart = firstDate ?? today
  const gridStart = startOfWeek(rangeStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(today, { weekStartsOn: 1 })

  const weeks: HeatmapWeek[] = []
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addWeeks(cursor, 1)) {
    const days: HeatmapDay[] = []
    let monthLabel: string | null = null
    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i)
      const key = dayKey(date)
      days.push({
        date,
        key,
        count: byDay.get(key)?.length ?? 0,
        inRange: date >= rangeStart && date <= today,
      })
      if (date.getDate() === 1) monthLabel = format(date, 'M月')
    }
    weeks.push({ days, monthLabel })
  }
  return weeks
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

/**
 * Excludes historical-import rows: their times are synthesized (spread evenly
 * across a window), not real, so they'd distort a time-of-day analysis.
 */
export function hourDistribution(checkins: CheckIn[]): { buckets: HourBucket[]; sampleSize: number } {
  const real = checkins.filter((c) => c.note !== IMPORT_NOTE)
  const counts = new Array(6).fill(0)
  for (const c of real) {
    const hour = new Date(c.checkedAt).getHours()
    counts[Math.floor(hour / 4)] += 1
  }
  return { buckets: HOUR_BUCKET_LABELS.map((label, i) => ({ label, count: counts[i] })), sampleSize: real.length }
}

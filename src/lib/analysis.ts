import { differenceInCalendarDays, eachMonthOfInterval, format, startOfDay, startOfMonth } from 'date-fns'
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

/**
 * Simple deterministic 1D k-means: centers seed from evenly-spaced quantiles
 * of the sorted values (no randomness, so results are stable/reproducible).
 */
export function kMeans1D(values: number[], k: number, maxIterations = 25): { assignments: number[]; centers: number[] } {
  if (values.length === 0) return { assignments: [], centers: [] }
  const effectiveK = Math.min(k, new Set(values).size || 1)
  const sorted = [...values].sort((a, b) => a - b)
  let centers = Array.from({ length: effectiveK }, (_, i) => {
    const idx = Math.floor(((i + 0.5) / effectiveK) * sorted.length)
    return sorted[Math.min(idx, sorted.length - 1)]
  })

  let assignments = new Array(values.length).fill(0)
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false
    assignments = values.map((v) => {
      let best = 0
      let bestDist = Infinity
      for (let c = 0; c < centers.length; c++) {
        const dist = Math.abs(v - centers[c])
        if (dist < bestDist) {
          bestDist = dist
          best = c
        }
      }
      return best
    })

    const sums = new Array(centers.length).fill(0)
    const counts = new Array(centers.length).fill(0)
    values.forEach((v, i) => {
      sums[assignments[i]] += v
      counts[assignments[i]] += 1
    })
    const nextCenters = centers.map((c, i) => (counts[i] > 0 ? sums[i] / counts[i] : c))
    if (nextCenters.some((c, i) => c !== centers[i])) changed = true
    centers = nextCenters
    if (!changed) break
  }

  return { assignments, centers }
}

export type ActivityTier = '低' | '中' | '高'

export interface ActivityCluster {
  label: ActivityTier
  center: number
  months: MonthBucket[]
}

export interface TieredMonth {
  month: MonthBucket
  tier: ActivityTier
}

const TIER_LABELS: ActivityTier[] = ['低', '中', '高']

/** k=3 k-means on monthly totals, kept in chronological order (for a scatter/time-series view). */
export function monthlyActivityTiers(monthly: MonthBucket[]): TieredMonth[] {
  if (monthly.length === 0) return []
  const values = monthly.map((m) => m.count)
  const { assignments, centers } = kMeans1D(values, 3)
  const rankedClusterIndices = centers.map((_, i) => i).sort((a, b) => centers[a] - centers[b])
  const labelForCluster = new Map<number, ActivityTier>()
  rankedClusterIndices.forEach((clusterIdx, rank) => {
    labelForCluster.set(clusterIdx, TIER_LABELS[Math.min(rank, TIER_LABELS.length - 1)])
  })
  return monthly.map((month, i) => ({ month, tier: labelForCluster.get(assignments[i])! }))
}

/** Groups the same k-means assignment into low/mid/high buckets for a summary view. */
export function monthlyActivityClusters(monthly: MonthBucket[]): ActivityCluster[] {
  const tiered = monthlyActivityTiers(monthly)
  const groups = new Map<ActivityTier, MonthBucket[]>()
  for (const { month, tier } of tiered) {
    const list = groups.get(tier) ?? []
    list.push(month)
    groups.set(tier, list)
  }
  return TIER_LABELS.filter((label) => groups.has(label)).map((label) => {
    const months = groups.get(label)!
    const center = months.reduce((sum, m) => sum + m.count, 0) / months.length
    return { label, center, months }
  })
}

export interface SeasonalBucket {
  monthNum: number
  label: string
  avg: number
}

/** Average count per calendar month (Jan–Dec) across all years present, to surface seasonality independent of the chronological trend. */
export function seasonality(monthly: MonthBucket[]): SeasonalBucket[] {
  const byMonthNum = new Map<number, number[]>()
  for (const m of monthly) {
    const monthNum = Number(m.key.slice(5, 7))
    const list = byMonthNum.get(monthNum) ?? []
    list.push(m.count)
    byMonthNum.set(monthNum, list)
  }
  return Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1
    const list = byMonthNum.get(monthNum) ?? []
    const avg = list.length > 0 ? list.reduce((a, b) => a + b, 0) / list.length : 0
    return { monthNum, label: `${monthNum}月`, avg }
  })
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

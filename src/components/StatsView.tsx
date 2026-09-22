import { useMemo } from 'react'
import { dayKey } from '../lib/date'
import { computeStreaks, countInMonth, groupByDay, lastNDaysCounts } from '../lib/stats'
import type { CheckIn } from '../lib/types'
import { HistoricalImport } from './HistoricalImport'

interface Props {
  checkins: CheckIn[]
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  )
}

export function StatsView({ checkins }: Props) {
  const byDay = useMemo(() => groupByDay(checkins), [checkins])
  const streaks = useMemo(() => computeStreaks(byDay), [byDay])
  const monthCount = useMemo(() => countInMonth(checkins, new Date()), [checkins])
  const todayCount = byDay.get(dayKey(new Date()))?.length ?? 0
  const activeDays = byDay.size
  const average = activeDays > 0 ? (checkins.length / activeDays).toFixed(1) : '0'
  const last14 = useMemo(() => lastNDaysCounts(byDay, 14), [byDay])
  const maxLast14 = Math.max(1, ...last14.map((d) => d.count))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="今日打卡" value={todayCount} />
        <StatCard label="本月打卡" value={monthCount} />
        <StatCard label="总打卡次数" value={checkins.length} />
        <StatCard label="打卡天数" value={activeDays} />
        <StatCard label="连续打卡天数" value={streaks.current} />
        <StatCard label="最长连续天数" value={streaks.longest} />
      </div>

      <div>
        <p className="mb-2 text-xs text-neutral-500">最近 14 天 · 场均 {average} 次/天</p>
        <div className="flex h-28 items-end gap-1.5">
          {last14.map(({ date, count }) => (
            <div key={dayKey(date)} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-violet-500 dark:bg-violet-700"
                style={{ height: `${(count / maxLast14) * 100}%`, minHeight: count > 0 ? 4 : 1 }}
              />
              <span className="text-[9px] text-neutral-400">{date.getDate()}</span>
            </div>
          ))}
        </div>
      </div>

      <HistoricalImport />
    </div>
  )
}

import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  buildHeatmap,
  hourDistribution,
  linearTrend,
  monthOverMonth,
  monthlyTotals,
  regularityStats,
  weekOverWeek,
  weekdayDistribution,
  type PeriodComparison,
} from '../lib/analysis'
import { groupByDay, daysSinceFirst } from '../lib/stats'
import type { CheckIn } from '../lib/types'
import { ColumnChart } from './charts/ColumnChart'
import { HeatmapChart } from './charts/HeatmapChart'
import { LineChart } from './charts/LineChart'

interface Props {
  checkins: CheckIn[]
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</h3>
      <div className="mt-3">{children}</div>
      {note && <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">{note}</p>}
    </div>
  )
}

const TREND_TEXT = {
  up: '呈上升趋势',
  down: '呈下降趋势',
  flat: '基本持平',
}

function PeriodCard({ comparison }: { comparison: PeriodComparison }) {
  const { currentLabel, previousLabel, current, previous } = comparison
  const delta = current - previous
  const pct = previous > 0 ? Math.round((delta / previous) * 100) : null
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  const deltaColor =
    delta > 0
      ? 'text-green-600 dark:text-green-400'
      : delta < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-neutral-400'

  return (
    <div className="flex-1 rounded-lg border border-neutral-200 p-3 text-center dark:border-neutral-800">
      <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{current}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{currentLabel}打卡</p>
      <p className={`mt-2 text-xs font-medium ${deltaColor}`}>
        {arrow} {Math.abs(delta)}
        {pct !== null && ` (${pct > 0 ? '+' : ''}${pct}%)`}
      </p>
      <p className="mt-0.5 text-[10px] text-neutral-400">
        较{previousLabel} {previous} 次
      </p>
    </div>
  )
}

export function AnalysisView({ checkins }: Props) {
  const byDay = useMemo(() => groupByDay(checkins), [checkins])
  const { days: totalDays, firstDate } = useMemo(() => daysSinceFirst(checkins), [checkins])
  const regularity = useMemo(() => regularityStats(byDay, totalDays), [byDay, totalDays])
  const weekday = useMemo(() => weekdayDistribution(checkins), [checkins])
  const months = useMemo(() => monthlyTotals(checkins), [checkins])
  const trend = useMemo(() => linearTrend(months), [months])
  const trendSeries = useMemo(
    () => months.map((_, i) => trend.slopePerMonth * i + trend.intercept),
    [months, trend],
  )
  const heatmapWeeks = useMemo(() => buildHeatmap(byDay, firstDate), [byDay, firstDate])
  const weekCompare = useMemo(() => weekOverWeek(checkins), [checkins])
  const monthCompare = useMemo(() => monthOverMonth(checkins), [checkins])
  const { buckets: hours, sampleSize: hourSampleSize } = useMemo(() => hourDistribution(checkins), [checkins])

  if (checkins.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-400">还没有数据，打几次卡再来看分析吧</p>
  }

  const busiestWeekday = weekday.reduce((a, b) => (b.count > a.count ? b : a))
  const busiestHour = hours.reduce((a, b) => (b.count > a.count ? b : a))

  return (
    <div className="space-y-4">
      <Section title="规律性">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {(regularity.activeRatio * 100).toFixed(0)}%
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">活跃天数占比</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {regularity.avgCycleDays > 0 ? regularity.avgCycleDays.toFixed(1) : '-'}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">平均打卡周期(天)</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {regularity.longestGap ? regularity.longestGap.days : 0}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">最长间断(天)</p>
          </div>
        </div>
        {regularity.longestGap && (
          <p className="mt-3 text-xs text-neutral-500">
            最长一次没打卡是从 {regularity.longestGap.startKey} 到 {regularity.longestGap.endKey} 之间，
            间断了 {regularity.longestGap.days} 天。
          </p>
        )}
        {firstDate && (
          <p className="mt-1 text-xs text-neutral-500">
            自 {format(firstDate, 'yyyy-MM-dd')} 至今共 {totalDays} 天，其中 {regularity.activeDays} 天有打卡。
          </p>
        )}
      </Section>

      <Section title="同比 / 环比">
        <div className="flex gap-3">
          <PeriodCard comparison={weekCompare} />
          <PeriodCard comparison={monthCompare} />
        </div>
      </Section>

      <Section
        title="月度趋势（线性回归）"
        note={`最小二乘法拟合：每月约 ${trend.slopePerMonth >= 0 ? '+' : ''}${trend.slopePerMonth.toFixed(2)} 次，${TREND_TEXT[trend.direction]}。按此趋势外推，下个月预计约 ${trend.predictedNextMonth.toFixed(1)} 次。数据较少或波动大时，趋势仅供参考。点击图上的点可查看当月具体数值。`}
      >
        <LineChart data={months.map((m) => ({ label: m.label, value: m.count }))} trend={trendSeries} />
      </Section>

      <Section title="活跃度热力图" note="点击某一天可查看当天打卡次数，颜色越深次数越多。">
        <HeatmapChart weeks={heatmapWeeks} />
      </Section>

      <Section title="星期分布" note={`打卡最多的是周${busiestWeekday.label}`}>
        <ColumnChart data={weekday.map((w) => ({ label: w.label, value: w.count }))} valueSuffix=" 次" />
      </Section>

      <Section
        title="时段分布"
        note={
          hourSampleSize > 0
            ? `仅统计 ${hourSampleSize} 条真实打卡时间（已排除时间为估算生成的历史导入记录）。`
            : '还没有真实打卡时间记录（历史导入的记录不计入，因为它们的时间是估算生成的），正常打卡积累后这里会显示。'
        }
      >
        <ColumnChart data={hours.map((h) => ({ label: h.label, value: h.count }))} valueSuffix=" 次" />
        {hourSampleSize > 0 && (
          <p className="mt-2 text-xs text-neutral-500">最常打卡的时段：{busiestHour.label}</p>
        )}
      </Section>
    </div>
  )
}

import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  hourDistribution,
  linearTrend,
  monthlyActivityClusters,
  monthlyTotals,
  regularityStats,
  seasonality,
  weekdayDistribution,
} from '../lib/analysis'
import { groupByDay, daysSinceFirst } from '../lib/stats'
import type { CheckIn } from '../lib/types'

interface Props {
  checkins: CheckIn[]
}

function MiniBarChart({
  data,
  formatValue,
  scrollable,
}: {
  data: { label: string; count: number }[]
  formatValue?: (n: number) => string
  /** When there are too many columns to fit, scroll horizontally instead of squeezing each bar unreadably thin. */
  scrollable?: boolean
}) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const columns = data.map((d, i) => (
    <div
      key={i}
      className={scrollable ? 'flex w-8 flex-none flex-col items-center gap-1' : 'flex flex-1 flex-col items-center gap-1'}
    >
      <span className="text-[10px] text-neutral-400">
        {d.count > 0 ? (formatValue ? formatValue(d.count) : d.count) : ''}
      </span>
      <div
        className="w-full rounded-t bg-violet-500 dark:bg-violet-700"
        style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 1 }}
      />
      <span className="text-[10px] text-neutral-400">{d.label}</span>
    </div>
  ))

  if (scrollable) {
    return (
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex h-24 items-end gap-2">{columns}</div>
      </div>
    )
  }
  return <div className="flex h-24 items-end gap-2">{columns}</div>
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

const CLUSTER_COLOR: Record<'低' | '中' | '高', string> = {
  低: 'bg-neutral-300 dark:bg-neutral-700',
  中: 'bg-violet-400 dark:bg-violet-800',
  高: 'bg-violet-700 dark:bg-violet-500',
}

export function AnalysisView({ checkins }: Props) {
  const byDay = useMemo(() => groupByDay(checkins), [checkins])
  const { days: totalDays, firstDate } = useMemo(() => daysSinceFirst(checkins), [checkins])
  const regularity = useMemo(() => regularityStats(byDay, totalDays), [byDay, totalDays])
  const weekday = useMemo(() => weekdayDistribution(checkins), [checkins])
  const months = useMemo(() => monthlyTotals(checkins), [checkins])
  const trend = useMemo(() => linearTrend(months), [months])
  const clusters = useMemo(() => monthlyActivityClusters(months), [months])
  const season = useMemo(() => seasonality(months), [months])
  const { buckets: hours, sampleSize: hourSampleSize } = useMemo(() => hourDistribution(checkins), [checkins])

  if (checkins.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-400">还没有数据，打几次卡再来看分析吧</p>
  }

  const busiestWeekday = weekday.reduce((a, b) => (b.count > a.count ? b : a))
  const busiestHour = hours.reduce((a, b) => (b.count > a.count ? b : a))
  const busiestSeasonMonth = season.reduce((a, b) => (b.avg > a.avg ? b : a))
  const currentMonthCluster = clusters.find((c) => c.months.some((m) => m.key === months[months.length - 1]?.key))

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

      <Section
        title="月度趋势（线性回归）"
        note={`最小二乘法拟合：每月约 ${trend.slopePerMonth >= 0 ? '+' : ''}${trend.slopePerMonth.toFixed(2)} 次，${TREND_TEXT[trend.direction]}。按此趋势外推，下个月预计约 ${trend.predictedNextMonth.toFixed(1)} 次。数据较少或波动大时，趋势仅供参考。`}
      >
        <MiniBarChart data={months.map((m) => ({ label: m.label, count: m.count }))} scrollable />
      </Section>

      <Section
        title="活跃度聚类（K-Means, k=3）"
        note={`按每月打卡总次数做聚类，把 ${months.length} 个月分成低/中/高三档活跃度。最近一个月（${months[months.length - 1]?.label}）属于「${currentMonthCluster?.label ?? '-'}」档。`}
      >
        <div className="space-y-2">
          {clusters.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${CLUSTER_COLOR[c.label]}`} />
              <span className="w-10 text-xs text-neutral-600 dark:text-neutral-400">{c.label}活跃</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className={`h-full ${CLUSTER_COLOR[c.label]}`}
                  style={{ width: `${(c.months.length / months.length) * 100}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-neutral-500">
                {c.months.length} 个月 · 月均{c.center.toFixed(1)}次
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="季节性（按日历月份）"
        note={`跨年汇总每个日历月的月均打卡次数，用来看是否存在季节性规律，与上面按时间先后的月度趋势不同。${busiestSeasonMonth.label}历史平均最高（约 ${busiestSeasonMonth.avg.toFixed(1)} 次）。含首月/当月不完整数据，仅供参考。`}
      >
        <MiniBarChart
          data={season.map((s) => ({ label: s.label, count: Math.round(s.avg * 10) / 10 }))}
          formatValue={(n) => n.toFixed(1)}
        />
      </Section>

      <Section title="星期分布" note={`打卡最多的是周${busiestWeekday.label}`}>
        <MiniBarChart data={weekday} />
      </Section>

      <Section
        title="时段分布"
        note={
          hourSampleSize > 0
            ? `仅统计 ${hourSampleSize} 条真实打卡时间（已排除时间为估算生成的历史导入记录）。`
            : '还没有真实打卡时间记录（历史导入的记录不计入，因为它们的时间是估算生成的），正常打卡积累后这里会显示。'
        }
      >
        <MiniBarChart data={hours} />
        {hourSampleSize > 0 && (
          <p className="mt-2 text-xs text-neutral-500">最常打卡的时段：{busiestHour.label}</p>
        )}
      </Section>
    </div>
  )
}

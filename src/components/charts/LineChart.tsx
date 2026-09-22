import { useState } from 'react'
import { niceMax } from './scale'
import { YAxisTicks } from './YAxisTicks'
import { Legend } from './Legend'

export interface LinePoint {
  label: string
  value: number
}

interface Props {
  data: LinePoint[]
  trend?: number[] // same length as data, e.g. an OLS fit
  height?: number
  pointSpacing?: number
  seriesLabel?: string
  trendLabel?: string
}

const TOP_PAD = 16

export function LineChart({
  data,
  trend,
  height = 110,
  pointSpacing = 34,
  seriesLabel = '实际',
  trendLabel = '趋势拟合',
}: Props) {
  const [active, setActive] = useState<number | null>(null)
  const n = data.length
  const max = niceMax(Math.max(1, ...data.map((d) => d.value), ...(trend ?? [0])))
  const width = Math.max(1, (n - 1) * pointSpacing)
  const xAxisH = 16
  const baselineY = height + TOP_PAD

  const xAt = (i: number) => i * pointSpacing
  const yAt = (v: number) => baselineY - (max > 0 ? (v / max) * height : 0)

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d.value)}`).join(' ')
  const areaPath = `${linePath} L ${xAt(n - 1)} ${baselineY} L ${xAt(0)} ${baselineY} Z`
  const trendPath = trend ? trend.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`).join(' ') : null

  const labelEvery = Math.max(1, Math.ceil(n / 8))

  return (
    <div className="viz">
      {trend && (
        <Legend
          items={[
            { color: 'var(--viz-line)', label: seriesLabel },
            { color: 'var(--viz-trend)', label: trendLabel, dashed: true },
          ]}
        />
      )}
      <div className="flex gap-1">
        <YAxisTicks max={max} height={height} />
        <div className="flex-1 overflow-x-auto">
          <svg width={width + 16} height={baselineY + xAxisH} role="img" aria-label="line chart">
            <line x1={0} y1={baselineY} x2={width} y2={baselineY} stroke="var(--viz-baseline)" strokeWidth={1} />
            <line
              x1={0}
              y1={baselineY - height / 2}
              x2={width}
              y2={baselineY - height / 2}
              stroke="var(--viz-grid)"
              strokeWidth={1}
            />

            <path d={areaPath} fill="var(--viz-line)" opacity={0.1} stroke="none" />
            {trendPath && (
              <path d={trendPath} fill="none" stroke="var(--viz-trend)" strokeWidth={2} strokeDasharray="4 3" />
            )}
            <path d={linePath} fill="none" stroke="var(--viz-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {data.map((d, i) => (
              <g key={i} onClick={() => setActive(active === i ? null : i)} style={{ cursor: 'pointer' }}>
                <circle cx={xAt(i)} cy={yAt(d.value)} r={12} fill="transparent" />
                <circle
                  cx={xAt(i)}
                  cy={yAt(d.value)}
                  r={i === n - 1 || active === i ? 4 : 2.5}
                  fill="var(--viz-line)"
                  stroke="var(--viz-surface)"
                  strokeWidth={2}
                />
                <text x={xAt(i)} y={yAt(d.value) - 7} textAnchor="middle" fontSize={9} fill="var(--viz-text-muted)">
                  {d.value}
                </text>
                {i % labelEvery === 0 && (
                  <text x={xAt(i)} y={baselineY + 12} textAnchor="middle" fontSize={9} fill="var(--viz-text-muted)">
                    {d.label}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
      <p className="mt-1 h-4 text-xs text-neutral-500">
        {active !== null ? `${data[active].label}：${data[active].value}` : ''}
      </p>
    </div>
  )
}

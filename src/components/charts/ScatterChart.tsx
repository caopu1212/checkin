import { useState } from 'react'
import { niceMax } from './scale'
import { YAxisTicks } from './YAxisTicks'
import { Legend } from './Legend'

export type Tier = '低' | '中' | '高'

export interface ScatterPoint {
  label: string
  value: number
  tier: Tier
}

const TIER_VAR: Record<Tier, string> = {
  低: 'var(--viz-low)',
  中: 'var(--viz-mid)',
  高: 'var(--viz-high)',
}

interface Props {
  data: ScatterPoint[]
  height?: number
  pointSpacing?: number
}

const TOP_PAD = 16

export function ScatterChart({ data, height = 110, pointSpacing = 30 }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const n = data.length
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)))
  const width = Math.max(1, (n - 1) * pointSpacing)
  const xAxisH = 16
  const baselineY = height + TOP_PAD

  const xAt = (i: number) => i * pointSpacing
  const yAt = (v: number) => baselineY - (max > 0 ? (v / max) * height : 0)

  const labelEvery = Math.max(1, Math.ceil(n / 8))

  return (
    <div className="viz">
      <Legend
        items={(['低', '中', '高'] as Tier[]).map((t) => ({ color: TIER_VAR[t], label: `${t}活跃` }))}
      />
      <div className="flex gap-1">
        <YAxisTicks max={max} height={height} />
        <div className="flex-1 overflow-x-auto">
          <svg width={width + 16} height={baselineY + xAxisH} role="img" aria-label="scatter chart">
            <line x1={0} y1={baselineY} x2={width} y2={baselineY} stroke="var(--viz-baseline)" strokeWidth={1} />
            <line
              x1={0}
              y1={baselineY - height / 2}
              x2={width}
              y2={baselineY - height / 2}
              stroke="var(--viz-grid)"
              strokeWidth={1}
            />

            {data.map((d, i) => {
              const isActive = active === i
              return (
                <g key={i} onClick={() => setActive(isActive ? null : i)} style={{ cursor: 'pointer' }}>
                  <circle cx={xAt(i)} cy={yAt(d.value)} r={12} fill="transparent" />
                  <circle
                    cx={xAt(i)}
                    cy={yAt(d.value)}
                    r={isActive ? 6 : 5}
                    fill={TIER_VAR[d.tier]}
                    stroke="var(--viz-surface)"
                    strokeWidth={2}
                    opacity={active !== null && !isActive ? 0.5 : 1}
                  />
                  <text x={xAt(i)} y={yAt(d.value) - 9} textAnchor="middle" fontSize={9} fill="var(--viz-text-muted)">
                    {d.value}
                  </text>
                  {i % labelEvery === 0 && (
                    <text x={xAt(i)} y={baselineY + 12} textAnchor="middle" fontSize={9} fill="var(--viz-text-muted)">
                      {d.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>
      <p className="mt-1 h-4 text-xs text-neutral-500">
        {active !== null ? `${data[active].label}：${data[active].value} 次 · ${data[active].tier}活跃` : ''}
      </p>
    </div>
  )
}

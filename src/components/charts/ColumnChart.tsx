import { useState } from 'react'
import { niceMax } from './scale'
import { YAxisTicks } from './YAxisTicks'

export interface ColumnDatum {
  label: string
  value: number
}

interface Props {
  data: ColumnDatum[]
  height?: number
  colWidth?: number
  gap?: number
  valueSuffix?: string
}

const TOP_PAD = 16

export function ColumnChart({ data, height = 96, colWidth = 36, gap = 10, valueSuffix = '' }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)))
  const width = data.length * colWidth + Math.max(0, data.length - 1) * gap
  const xAxisH = 16
  const baselineY = height + TOP_PAD

  return (
    <div className="viz">
      <div className="flex gap-1">
        <YAxisTicks max={max} height={height} />
        <div className="flex-1 overflow-x-auto">
          <svg width={width} height={baselineY + xAxisH} role="img" aria-label="column chart">
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
              const x = i * (colWidth + gap)
              const barH = max > 0 ? (d.value / max) * height : 0
              const dimmed = active !== null && active !== i
              return (
                <g
                  key={i}
                  onClick={() => setActive(active === i ? null : i)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x={x} y={0} width={colWidth} height={baselineY} fill="transparent" />
                  <rect
                    x={x}
                    y={baselineY - barH}
                    width={colWidth}
                    height={Math.max(barH, d.value > 0 ? 2 : 0)}
                    rx={4}
                    fill="var(--viz-mid)"
                    opacity={dimmed ? 0.45 : 1}
                  />
                  {d.value > 0 && (
                    <text
                      x={x + colWidth / 2}
                      y={baselineY - barH - 5}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--viz-text-muted)"
                    >
                      {d.value}
                    </text>
                  )}
                  <text
                    x={x + colWidth / 2}
                    y={baselineY + 12}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--viz-text-muted)"
                  >
                    {d.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
      <p className="mt-1 h-4 text-xs text-neutral-500">
        {active !== null ? `${data[active].label}：${data[active].value}${valueSuffix}` : ''}
      </p>
    </div>
  )
}

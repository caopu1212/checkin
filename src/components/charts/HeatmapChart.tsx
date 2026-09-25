import { useState } from 'react'
import { format } from 'date-fns'
import type { HeatmapWeek } from '../../lib/analysis'

const CELL = 12
const GAP = 3
const ROW_LABELS = ['一', '', '三', '', '五', '', '']

function levelFor(count: number, max: number): number {
  if (count <= 0) return 0
  if (max <= 1) return 4
  const ratio = count / max
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

// SVG rects are colored via `fill`; the HTML legend swatches below reuse the
// same opacities via `background` since `fill` isn't a CSS property outside SVG.
const LEVEL_FILL = [
  { fill: 'var(--viz-grid)', opacity: 1 },
  { fill: 'var(--viz-mid)', opacity: 0.3 },
  { fill: 'var(--viz-mid)', opacity: 0.55 },
  { fill: 'var(--viz-mid)', opacity: 0.8 },
  { fill: 'var(--viz-mid)', opacity: 1 },
]
const LEVEL_BG = LEVEL_FILL.map(({ fill, opacity }) => ({ background: fill, opacity }))

interface Props {
  weeks: HeatmapWeek[]
}

export function HeatmapChart({ weeks }: Props) {
  const [active, setActive] = useState<{ dateLabel: string; count: number } | null>(null)
  const max = Math.max(1, ...weeks.flatMap((w) => w.days.map((d) => d.count)))
  const colWidth = CELL + GAP
  const width = weeks.length * colWidth

  return (
    <div className="viz">
      <div className="flex gap-1">
        <div className="flex flex-col gap-[3px] pt-4 text-[9px] leading-none text-[var(--viz-text-muted)]" style={{ width: 14 }}>
          {ROW_LABELS.map((label, i) => (
            <span key={i} style={{ height: CELL }}>
              {label}
            </span>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto">
          <svg width={width} height={16 + 7 * CELL + 6 * GAP} role="img" aria-label="activity heatmap">
            {weeks.map((week, wi) => (
              <g key={wi}>
                {week.monthLabel && (
                  <text x={wi * colWidth} y={10} fontSize={9} fill="var(--viz-text-muted)">
                    {week.monthLabel}
                  </text>
                )}
                {week.days.map((day, di) => (
                  <rect
                    key={day.key}
                    x={wi * colWidth}
                    y={16 + di * (CELL + GAP)}
                    width={CELL}
                    height={CELL}
                    rx={3}
                    style={{
                      ...LEVEL_FILL[levelFor(day.count, max)],
                      cursor: day.inRange ? 'pointer' : 'default',
                      visibility: day.inRange ? 'visible' : 'hidden',
                    }}
                    onClick={() =>
                      day.inRange &&
                      setActive({ dateLabel: format(day.date, 'yyyy-MM-dd'), count: day.count })
                    }
                  />
                ))}
              </g>
            ))}
          </svg>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-[var(--viz-text-muted)]">
        <span>少</span>
        {LEVEL_BG.map((style, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-sm" style={style} />
        ))}
        <span>多</span>
      </div>
      <p className="mt-1 h-4 text-xs text-neutral-500">
        {active ? `${active.dateLabel}：${active.count} 次` : ''}
      </p>
    </div>
  )
}

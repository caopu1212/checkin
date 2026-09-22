import { useMemo, useState } from 'react'
import {
  WEEKDAY_LABELS,
  addMonths,
  buildMonthGrid,
  dayKey,
  formatMonthLabel,
  isSameDay,
  isSameMonth,
  isToday,
  subMonths,
} from '../lib/date'
import type { CheckIn } from '../lib/types'
import { groupByDay } from '../lib/stats'
import { DayPanel } from './DayPanel'

interface Props {
  checkins: CheckIn[]
  addCheckIn: (checkedAt: Date, note?: string | null) => Promise<CheckIn>
  updateCheckIn: (id: string, changes: { checkedAt?: Date; note?: string | null }) => Promise<void>
  deleteCheckIn: (id: string) => Promise<void>
}

function intensityClass(count: number): string {
  if (count === 0) return ''
  if (count === 1) return 'bg-violet-200 dark:bg-violet-900'
  if (count === 2) return 'bg-violet-300 dark:bg-violet-800'
  if (count <= 4) return 'bg-violet-500 dark:bg-violet-700 text-white'
  return 'bg-violet-700 text-white'
}

export function CalendarView({ checkins, addCheckIn, updateCheckIn, deleteCheckIn }: Props) {
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())

  const byDay = useMemo(() => groupByDay(checkins), [checkins])
  const days = useMemo(() => buildMonthGrid(month), [month])
  const selectedCheckins = byDay.get(dayKey(selected)) ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="rounded-md px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="上个月"
        >
          ‹
        </button>
        <h2 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
          {formatMonthLabel(month)}
        </h2>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-md px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="下个月"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const count = byDay.get(dayKey(day))?.length ?? 0
          const inMonth = isSameMonth(day, month)
          const isSelected = isSameDay(day, selected)
          return (
            <button
              type="button"
              key={dayKey(day)}
              onClick={() => setSelected(day)}
              className={[
                'flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition',
                inMonth ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-300 dark:text-neutral-700',
                intensityClass(count),
                isSelected ? 'ring-2 ring-violet-600' : '',
                isToday(day) && !isSelected ? 'ring-1 ring-violet-400' : '',
              ].join(' ')}
            >
              <span>{day.getDate()}</span>
              {count > 0 && <span className="text-[10px] leading-none opacity-80">{count}</span>}
            </button>
          )
        })}
      </div>

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <DayPanel
          date={selected}
          checkins={selectedCheckins}
          addCheckIn={addCheckIn}
          updateCheckIn={updateCheckIn}
          deleteCheckIn={deleteCheckIn}
        />
      </div>
    </div>
  )
}

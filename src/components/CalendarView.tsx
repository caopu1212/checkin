import { useMemo, useRef, useState } from 'react'
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

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export function CalendarView({ checkins, addCheckIn, updateCheckIn, deleteCheckIn }: Props) {
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())

  const byDay = useMemo(() => groupByDay(checkins), [checkins])
  const days = useMemo(() => buildMonthGrid(month), [month])
  const selectedCheckins = byDay.get(dayKey(selected)) ?? []

  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || pickerOpen) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    setMonth((m) => (dx > 0 ? subMonths(m, 1) : addMonths(m, 1)))
  }

  return (
    <div className="space-y-5">
      <div
        className="touch-pan-y select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="rounded-md px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="上个月"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              setPickerYear(month.getFullYear())
              setPickerOpen((open) => !open)
            }}
            className="rounded-md px-2 py-1 text-base font-medium text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            {formatMonthLabel(month)}
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-md px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="下个月"
          >
            ›
          </button>
        </div>

        {pickerOpen ? (
          <div className="mt-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                className="rounded-md px-3 py-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label="上一年"
              >
                ‹
              </button>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {pickerYear}年
              </span>
              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className="rounded-md px-3 py-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label="下一年"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MONTH_LABELS.map((label, i) => {
                const isCurrent = pickerYear === month.getFullYear() && i === month.getMonth()
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setMonth(new Date(pickerYear, i, 1))
                      setPickerOpen(false)
                    }}
                    className={[
                      'rounded-md py-2 text-sm transition',
                      isCurrent
                        ? 'bg-violet-700 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs text-neutral-400">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
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
          </>
        )}
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

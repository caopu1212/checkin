import { useState } from 'react'
import { startOfDay } from 'date-fns'
import { combineDateAndTime, formatDateLong, isToday } from '../lib/date'
import type { CheckIn } from '../lib/types'
import { CheckInRow } from './CheckInRow'

interface Props {
  date: Date
  checkins: CheckIn[]
  addCheckIn: (checkedAt: Date, note?: string | null) => Promise<CheckIn>
  updateCheckIn: (id: string, changes: { checkedAt?: Date; note?: string | null }) => Promise<void>
  deleteCheckIn: (id: string) => Promise<void>
}

export function DayPanel({ date, checkins, addCheckIn, updateCheckIn, deleteCheckIn }: Props) {
  const [addingTime, setAddingTime] = useState(false)
  const [time, setTime] = useState('12:00')

  const today = isToday(date)
  const sorted = [...checkins].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt))
  // Future check-ins make no sense for a log of things that happened, and they
  // break "days since last check-in" and the time-series charts.
  const isFutureDay = startOfDay(date) > startOfDay(new Date())
  const backfillAt = combineDateAndTime(date, time)
  const backfillInFuture = backfillAt > new Date()

  async function checkInNow() {
    await addCheckIn(new Date())
  }

  async function addAtTime() {
    if (backfillInFuture) return
    await addCheckIn(backfillAt)
    setAddingTime(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          {formatDateLong(date)}
        </h2>
        <span className="text-sm text-neutral-500">{sorted.length} 次打卡</span>
      </div>

      {today && (
        <button
          type="button"
          onClick={checkInNow}
          className="w-full rounded-xl bg-violet-700 py-4 text-lg font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-violet-800"
        >
          打卡
        </button>
      )}

      {sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((c) => (
            <CheckInRow key={c.id} checkIn={c} onUpdate={updateCheckIn} onDelete={deleteCheckIn} />
          ))}
        </ul>
      )}

      {sorted.length === 0 && !today && (
        <p className="py-6 text-center text-sm text-neutral-400">
          {isFutureDay ? '未来的日期还不能打卡' : '这一天还没有打卡记录'}
        </p>
      )}

      {isFutureDay ? null : addingTime ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setAddingTime(false)}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={addAtTime}
              disabled={backfillInFuture}
              className="rounded-md bg-violet-700 px-3 py-1.5 text-sm text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              添加
            </button>
          </div>
          {backfillInFuture && <p className="w-full text-xs text-red-600">不能晚于当前时间</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingTime(true)}
          className="w-full rounded-lg border border-dashed border-neutral-300 py-2.5 text-sm text-neutral-500 hover:border-violet-400 hover:text-violet-700 dark:border-neutral-700"
        >
          + 补录指定时间的打卡
        </button>
      )}
    </div>
  )
}

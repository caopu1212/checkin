import { useState } from 'react'
import { combineDateAndTime, formatTime } from '../lib/date'
import type { CheckIn } from '../lib/types'

interface Props {
  checkIn: CheckIn
  onUpdate: (id: string, changes: { checkedAt?: Date; note?: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function CheckInRow({ checkIn, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState(formatTime(checkIn.checkedAt))
  const [note, setNote] = useState(checkIn.note ?? '')

  async function save() {
    await onUpdate(checkIn.id, {
      checkedAt: combineDateAndTime(new Date(checkIn.checkedAt), time),
      note: note.trim() ? note.trim() : null,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-violet-300 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950">
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            type="text"
            placeholder="备注（可选）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div className="flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => onDelete(checkIn.id)}
            className="rounded-md px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            删除
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-white hover:bg-violet-800"
          >
            保存
          </button>
        </div>
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left hover:border-violet-300 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <span className="font-mono text-base text-neutral-900 dark:text-neutral-100">
          {formatTime(checkIn.checkedAt)}
        </span>
        {checkIn.note && (
          <span className="truncate pl-3 text-sm text-neutral-500">{checkIn.note}</span>
        )}
      </button>
    </li>
  )
}

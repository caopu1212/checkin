import type { SyncStatus } from '../lib/sync'

const LABEL: Record<SyncStatus, string> = {
  idle: '已同步',
  syncing: '同步中…',
  offline: '离线',
  error: '同步失败',
}

const DOT: Record<SyncStatus, string> = {
  idle: 'bg-green-500',
  syncing: 'bg-amber-500 animate-pulse',
  offline: 'bg-neutral-400',
  error: 'bg-red-500',
}

export function SyncBadge({ status }: { status: SyncStatus }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </span>
  )
}

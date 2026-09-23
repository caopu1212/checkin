import { useEffect, useState } from 'react'
import { getLegacyCategoryId } from '../hooks/useCategories'
import { getImportSummary, isHistoricalImportDone, runHistoricalImport } from '../lib/historicalImport'

interface Props {
  categoryId: string
}

export function HistoricalImport({ categoryId }: Props) {
  const [visible, setVisible] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [summary, setSummary] = useState<{ days: number; total: number; skipped: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const legacyId = await getLegacyCategoryId()
      if (legacyId !== categoryId) return
      const done = await isHistoricalImportDone()
      if (done) return
      const s = await getImportSummary(categoryId)
      if (cancelled) return
      setSummary(s)
      setVisible(s.total > 0)
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [categoryId])

  async function handleImport() {
    setRunning(true)
    const count = await runHistoricalImport(categoryId)
    setRunning(false)
    setResult(count)
  }

  if (result !== null) {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
        已导入 {result} 条历史打卡记录，联网后会自动同步到云端。
      </div>
    )
  }

  if (!visible || !summary) return null

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        检测到可导入的历史数据：{summary.days} 天 · 共 {summary.total} 次打卡。
        {summary.skipped > 0 && `（另有 ${summary.skipped} 天已有记录，会自动跳过）`}
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        原始数据只有每天的次数，没有具体时间，导入时会在 8:00–22:00
        之间均匀生成时间点，并标注备注"历史导入"，方便区分。
      </p>
      {confirming ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={running}
            className="flex-1 rounded-md border border-neutral-300 py-2 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={running}
            className="flex-1 rounded-md bg-violet-700 py-2 text-sm text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {running ? '导入中…' : '确认导入'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 w-full rounded-md border border-dashed border-violet-400 py-2 text-sm text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950"
        >
          导入历史数据
        </button>
      )}
    </div>
  )
}

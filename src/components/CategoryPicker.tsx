import { useState } from 'react'
import type { Category } from '../lib/types'

interface Props {
  categories: Category[]
  onSelect: (categoryId: string) => void
  addCategory: (name: string) => Promise<Category>
  renameCategory: (id: string, name: string) => Promise<void>
}

export function CategoryPicker({ categories, onSelect, addCategory, renameCategory }: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function submitAdd() {
    const name = newName.trim()
    if (!name) {
      setAdding(false)
      return
    }
    await addCategory(name)
    setNewName('')
    setAdding(false)
  }

  async function submitRename(id: string) {
    const name = editingName.trim()
    if (name) await renameCategory(id, name)
    setEditingId(null)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-10 pt-8">
      <h1 className="mb-1 text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        选择事件
      </h1>
      <p className="mb-6 text-center text-sm text-neutral-500">每个事件的打卡数据互相独立</p>

      <div className="space-y-3">
        {categories.map((c) =>
          editingId === c.id ? (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950"
            >
              <input
                autoFocus
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitRename(c.id)}
                className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-base dark:border-neutral-700 dark:bg-neutral-900"
              />
              <button
                type="button"
                onClick={() => submitRename(c.id)}
                className="rounded-md bg-violet-700 px-3 py-1.5 text-sm text-white hover:bg-violet-800"
              >
                保存
              </button>
            </div>
          ) : (
            <div
              key={c.id}
              className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-800"
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex-1 rounded-l-xl px-4 py-4 text-center text-base font-medium text-neutral-900 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                {c.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(c.id)
                  setEditingName(c.name)
                }}
                className="px-4 py-4 text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                aria-label="重命名"
              >
                改名
              </button>
            </div>
          ),
        )}
      </div>

      {adding ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950">
          <input
            autoFocus
            type="text"
            placeholder="事件名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-base dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="button"
            onClick={submitAdd}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm text-white hover:bg-violet-800"
          >
            添加
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 w-full rounded-xl border border-dashed border-neutral-300 py-4 text-sm text-neutral-500 hover:border-violet-400 hover:text-violet-700 dark:border-neutral-700"
        >
          + 新建事件
        </button>
      )}
    </div>
  )
}

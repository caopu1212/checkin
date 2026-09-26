import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../lib/db'
import type { Category } from '../lib/types'

interface Props {
  categories: Category[]
  onSelect: (categoryId: string) => void
  addCategory: (name: string) => Promise<Category>
  renameCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
}

// With a Chinese/Japanese IME, Enter first confirms the candidate text; only a
// plain Enter (not mid-composition) should submit, or a half-typed name gets saved.
function isSubmitKey(e: React.KeyboardEvent<HTMLInputElement>): boolean {
  return e.key === 'Enter' && !e.nativeEvent.isComposing
}

function useCheckinCount(categoryId: string): number {
  return (
    useLiveQuery(
      () => db.checkins.where('categoryId').equals(categoryId).filter((c) => !c.deleted).count(),
      [categoryId],
      0,
    ) ?? 0
  )
}

function CategoryRow({
  category,
  onSelect,
  renameCategory,
  deleteCategory,
}: {
  category: Category
  onSelect: (id: string) => void
  renameCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'confirmDelete'>('view')
  const [editingName, setEditingName] = useState(category.name)
  const [confirmText, setConfirmText] = useState('')
  const count = useCheckinCount(category.id)

  async function submitRename() {
    const name = editingName.trim()
    if (name) await renameCategory(category.id, name)
    setMode('view')
  }

  if (mode === 'rename') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950">
        <input
          autoFocus
          type="text"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onKeyDown={(e) => isSubmitKey(e) && submitRename()}
          className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-base dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="button"
          onClick={submitRename}
          className="rounded-md bg-violet-700 px-3 py-1.5 text-sm text-white hover:bg-violet-800"
        >
          保存
        </button>
      </div>
    )
  }

  if (mode === 'confirmDelete') {
    const canDelete = confirmText.trim() === category.name
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <p className="text-sm text-red-800 dark:text-red-300">
          删除「{category.name}」？{count > 0 ? `包含 ${count} 条打卡记录，` : '这个事件是空的，'}
          删除后无法恢复。
        </p>
        <p className="mt-2 text-xs text-red-700 dark:text-red-400">
          请输入事件名称「{category.name}」确认：
        </p>
        <input
          autoFocus
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={category.name}
          className="mt-1 w-full rounded-md border border-red-300 px-2 py-1.5 text-sm dark:border-red-800 dark:bg-neutral-900"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('view')
              setConfirmText('')
            }}
            className="flex-1 rounded-md border border-neutral-300 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => deleteCategory(category.id)}
            disabled={!canDelete}
            className="flex-1 rounded-md bg-red-600 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            确认删除
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => onSelect(category.id)}
        className="flex-1 rounded-l-xl px-4 py-4 text-center hover:bg-neutral-50 dark:hover:bg-neutral-900"
      >
        <span className="block text-base font-medium text-neutral-900 dark:text-neutral-100">
          {category.name}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-400">{count} 条记录</span>
      </button>
      <button
        type="button"
        onClick={() => {
          setEditingName(category.name)
          setMode('rename')
        }}
        className="px-3 py-4 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        aria-label="重命名"
      >
        改名
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirmText('')
          setMode('confirmDelete')
        }}
        className="px-3 py-4 text-xs text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
        aria-label="删除"
      >
        删除
      </button>
    </div>
  )
}

export function CategoryPicker({ categories, onSelect, addCategory, renameCategory, deleteCategory }: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

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

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        选择事件
      </h1>
      <p className="mb-6 text-center text-sm text-neutral-500">每个事件的打卡数据互相独立</p>

      <div className="space-y-3">
        {categories.map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            onSelect={onSelect}
            renameCategory={renameCategory}
            deleteCategory={deleteCategory}
          />
        ))}
      </div>

      {adding ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950">
          <input
            autoFocus
            type="text"
            placeholder="事件名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => isSubmitKey(e) && submitAdd()}
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

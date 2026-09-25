import { useMemo, useState } from 'react'
import { Auth } from './components/Auth'
import { CalendarView } from './components/CalendarView'
import { CategoryPicker } from './components/CategoryPicker'
import { DayPanel } from './components/DayPanel'
import { StatsView } from './components/StatsView'
import { SyncBadge } from './components/SyncBadge'
import { useAuth } from './hooks/useAuth'
import { useCategories } from './hooks/useCategories'
import { useCheckins } from './hooks/useCheckins'
import { useSync } from './hooks/useSync'
import type { SyncStatus } from './lib/sync'
import { daysSinceLastCheckIn } from './lib/stats'

type Tab = 'today' | 'calendar' | 'stats'

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'calendar', label: '日历' },
  { key: 'stats', label: '统计' },
]

interface AppShellProps {
  categoryId: string
  categoryName: string
  onSwitchCategory: () => void
  syncStatus: SyncStatus
  signOut: () => Promise<void>
}

function AppShell({ categoryId, categoryName, onSwitchCategory, syncStatus, signOut }: AppShellProps) {
  const [tab, setTab] = useState<Tab>('today')
  const { checkins, addCheckIn, updateCheckIn, deleteCheckIn } = useCheckins(categoryId)
  const gapDays = useMemo(() => daysSinceLastCheckIn(checkins), [checkins])

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-5">
        <button type="button" onClick={onSwitchCategory} className="text-left">
          <p className="text-[11px] leading-none text-neutral-400">打卡 · 切换事件</p>
          <h1 className="mt-0.5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {categoryName}
          </h1>
        </button>
        <div className="flex items-center gap-3">
          <SyncBadge status={syncStatus} />
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            退出
          </button>
        </div>
      </header>

      <main className={`flex-1 px-4 pb-24 pt-2 ${tab === 'today' ? 'flex flex-col justify-center' : ''}`}>
        {tab === 'today' && (
          <>
            <DayPanel
              date={new Date()}
              checkins={checkins.filter(
                (c) => new Date(c.checkedAt).toDateString() === new Date().toDateString(),
              )}
              addCheckIn={addCheckIn}
              updateCheckIn={updateCheckIn}
              deleteCheckIn={deleteCheckIn}
            />
            {gapDays !== null && gapDays > 0 && (
              <p className="mt-6 text-center text-sm text-neutral-400">
                你已经 {gapDays} 天没打卡了
              </p>
            )}
          </>
        )}
        {tab === 'calendar' && (
          <CalendarView
            checkins={checkins}
            addCheckIn={addCheckIn}
            updateCheckIn={updateCheckIn}
            deleteCheckIn={deleteCheckIn}
          />
        )}
        {tab === 'stats' && <StatsView checkins={checkins} categoryId={categoryId} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="grid grid-cols-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                'py-3 text-sm font-medium transition',
                tab === t.key
                  ? 'text-violet-700 dark:text-violet-400'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

function Workspace({ userId, signOut }: { userId: string; signOut: () => Promise<void> }) {
  const syncStatus = useSync(userId)
  const { categories, addCategory, renameCategory, deleteCategory } = useCategories(userId)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  const activeCategory = categories.find((c) => c.id === activeCategoryId)

  if (!activeCategory) {
    return (
      <CategoryPicker
        categories={categories}
        onSelect={setActiveCategoryId}
        addCategory={addCategory}
        renameCategory={renameCategory}
        deleteCategory={deleteCategory}
      />
    )
  }

  return (
    <AppShell
      categoryId={activeCategory.id}
      categoryName={activeCategory.name}
      onSwitchCategory={() => setActiveCategoryId(null)}
      syncStatus={syncStatus}
      signOut={signOut}
    />
  )
}

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">加载中…</div>
  }

  if (!user) {
    return <Auth signIn={signIn} signUp={signUp} />
  }

  return <Workspace userId={user.id} signOut={signOut} />
}

export default App

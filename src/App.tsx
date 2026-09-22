import { useState } from 'react'
import { Auth } from './components/Auth'
import { CalendarView } from './components/CalendarView'
import { DayPanel } from './components/DayPanel'
import { StatsView } from './components/StatsView'
import { SyncBadge } from './components/SyncBadge'
import { useAuth } from './hooks/useAuth'
import { useCheckins } from './hooks/useCheckins'
import { useSync } from './hooks/useSync'

type Tab = 'today' | 'calendar' | 'stats'

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'calendar', label: '日历' },
  { key: 'stats', label: '统计' },
]

function AppShell({ userId, signOut }: { userId: string; signOut: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('today')
  const { checkins, addCheckIn, updateCheckIn, deleteCheckIn } = useCheckins()
  const syncStatus = useSync(userId)

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-5">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">打卡</h1>
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

      <main className="flex-1 px-4 pb-24 pt-2">
        {tab === 'today' && (
          <DayPanel
            date={new Date()}
            checkins={checkins.filter(
              (c) => new Date(c.checkedAt).toDateString() === new Date().toDateString(),
            )}
            addCheckIn={addCheckIn}
            updateCheckIn={updateCheckIn}
            deleteCheckIn={deleteCheckIn}
          />
        )}
        {tab === 'calendar' && (
          <CalendarView
            checkins={checkins}
            addCheckIn={addCheckIn}
            updateCheckIn={updateCheckIn}
            deleteCheckIn={deleteCheckIn}
          />
        )}
        {tab === 'stats' && <StatsView checkins={checkins} />}
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

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">加载中…</div>
  }

  if (!user) {
    return <Auth signIn={signIn} signUp={signUp} />
  }

  return <AppShell userId={user.id} signOut={signOut} />
}

export default App

import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'

interface Props {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
}

export function Auth({ signIn, signUp }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signedUpMessage, setSignedUpMessage] = useState<string | null>(null)

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">尚未配置 Supabase</p>
          <p className="mt-2">
            请在项目根目录创建 <code>.env.local</code>，填入 <code>VITE_SUPABASE_URL</code> 和{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>，详见 DEVELOPMENT.md。
          </p>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSignedUpMessage(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setSignedUpMessage('注册成功，请查收邮箱完成验证后登录。')
        setMode('signin')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '出错了，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          打卡
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-500">
          {mode === 'signin' ? '登录你的账号' : '创建一个新账号'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {signedUpMessage && <p className="text-sm text-green-600">{signedUpMessage}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-700 px-3 py-2.5 font-medium text-white transition hover:bg-violet-800 disabled:opacity-50"
          >
            {loading ? '请稍候…' : mode === 'signin' ? '登录' : '注册'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-4 w-full text-center text-sm text-violet-700 dark:text-violet-400"
        >
          {mode === 'signin' ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
      </div>
    </div>
  )
}

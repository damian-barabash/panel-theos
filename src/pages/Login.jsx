import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Logo'
import { PixelButton, Spinner } from '../components/ui'

const AUTH_ERRORS = {
  'Invalid login credentials': 'Неверный email или пароль',
  'Email not confirmed': 'Email не подтверждён',
}

export default function Login() {
  const { signIn, hasAccess, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!loading && hasAccess) return <Navigate to="/" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const err = await signIn(email, password)
    setBusy(false)
    if (err) setError(AUTH_ERRORS[err.message] || err.message)
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="absolute inset-x-5 top-5 flex items-center justify-between">
        <span className="label">Theos · Панель управления</span>
        <span className="label hidden xs:block">MMXXVI</span>
      </div>

      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo height={72} />
          <p className="label mt-5">Управление миром</p>
        </div>

        <form onSubmit={onSubmit} className="pixel-frame px-6 py-7 xs:px-8">
          <label className="label mb-2 block">Email</label>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@theos-rpg.app"
            className="field mb-5"
          />

          <label className="label mb-2 block">Пароль</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="field mb-6"
          />

          {error && (
            <div className="mb-5 border-2 border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <PixelButton type="submit" disabled={busy} className="w-full">
            {busy ? <Spinner className="border-bgDeep/40 border-t-bgDeep" /> : 'Войти'}
          </PixelButton>
        </form>
      </div>
    </div>
  )
}

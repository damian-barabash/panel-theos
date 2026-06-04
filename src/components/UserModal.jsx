import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { createUser, deleteUser, updateUserPassword } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { PixelFrame, PixelButton, Spinner, useToast } from './ui'

export function UserModal({ onClose }) {
  const toast = useToast()
  const { user } = useAuth()
  const [users, setUsers] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('panel_admins')
      .select('id, email, created_at')
      .order('created_at', { ascending: true })
    setUsers(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  async function onCreate(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await createUser({ email: email.trim(), password })
      toast.ok('Пользователь создан')
      setEmail(''); setPassword('')
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(u) {
    if (!confirm(`Удалить пользователя ${u.email}?`)) return
    try {
      await deleteUser(u.id)
      toast.ok('Удалён')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function onResetPassword(u) {
    const pwd = prompt(`Новый пароль для ${u.email}:`)
    if (!pwd) return
    try {
      await updateUserPassword(u.id, pwd)
      toast.ok('Пароль обновлён')
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bgDeep/70 px-4 py-8" onClick={onClose}>
      <PixelFrame className="w-full max-w-lg px-5 py-6" >
        <div onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="pixel-title text-xs xs:text-sm">ПОЛЬЗОВАТЕЛИ</h2>
            <button className="text-muted hover:text-ink text-lg" onClick={onClose}>✕</button>
          </div>

          <form onSubmit={onCreate} className="mb-5 flex flex-col gap-3 border-2 border-line bg-bgDeep/40 px-4 py-4">
            <span className="label">Создать нового</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@theos-rpg.app" className="field" autoComplete="off" />
            <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="пароль (мин. 6)" className="field" autoComplete="new-password" />
            <PixelButton type="submit" disabled={busy} className="self-end">
              {busy ? <Spinner className="border-bgDeep/40 border-t-bgDeep" /> : 'Создать'}
            </PixelButton>
          </form>

          <span className="label">Все ({users?.length ?? 0})</span>
          <div className="mt-2 flex flex-col gap-2">
            {users === null ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-line bg-surface2/40 px-3 py-2">
                  <span className="text-sm text-ink truncate">
                    {u.email}
                    {u.id === user?.id && <span className="label ml-2">· вы</span>}
                  </span>
                  <div className="flex gap-1.5">
                    <PixelButton variant="ghost" className="!px-2 !py-1.5 !text-[10px]" onClick={() => onResetPassword(u)}>
                      Пароль
                    </PixelButton>
                    {u.id !== user?.id && (
                      <PixelButton variant="danger" className="!px-2 !py-1.5 !text-[10px]" onClick={() => onDelete(u)}>
                        Удалить
                      </PixelButton>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PixelFrame>
    </div>
  )
}

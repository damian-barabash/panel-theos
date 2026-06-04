import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { PixelFrame, PixelButton, Spinner } from '../components/ui'

function fmt(ts) {
  try {
    const d = new Date(ts)
    return d.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ts
  }
}

const ACTION_COLOR = {
  'prompt.update': 'text-gold',
  'lore.create': 'text-crystal',
  'lore.update': 'text-crystal',
  'lore.delete': 'text-danger',
  'config.update': 'text-warn',
  'user.create': 'text-ok',
  'user.delete': 'text-danger',
  'user.password': 'text-warn',
}

export default function Logs() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setRows(null)
    const { data } = await supabase
      .from('panel_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  const shown = (rows ?? []).filter((r) => {
    if (!filter) return true
    const f = filter.toLowerCase()
    return (
      (r.action || '').toLowerCase().includes(f) ||
      (r.summary || '').toLowerCase().includes(f) ||
      (r.actor_email || '').toLowerCase().includes(f) ||
      (r.entity_key || '').toLowerCase().includes(f)
    )
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="pixel-title text-sm xs:text-base">ЛОГИ</h1>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Фильтр…"
            className="field !w-40 xs:!w-56 !py-2"
          />
          <PixelButton variant="ghost" className="!px-3 !py-2" onClick={load}>↻</PixelButton>
        </div>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
      ) : shown.length === 0 ? (
        <PixelFrame purple className="px-5 py-8 text-center text-muted text-sm">
          Пока нет записей.
        </PixelFrame>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((r) => (
            <PixelFrame key={r.id} purple className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className={`font-mono text-[11px] uppercase tracking-label ${ACTION_COLOR[r.action] || 'text-ink'}`}>
                  {r.action}
                </span>
                <span className="label">{fmt(r.created_at)}</span>
              </div>
              {r.summary && <p className="mt-1.5 text-sm text-ink">{r.summary}</p>}
              <div className="mt-1.5 flex flex-wrap gap-2">
                {r.actor_email && <span className="label">{r.actor_email}</span>}
                {r.entity_key && <span className="chip">{r.entity_key}</span>}
              </div>
            </PixelFrame>
          ))}
        </div>
      )}
    </div>
  )
}

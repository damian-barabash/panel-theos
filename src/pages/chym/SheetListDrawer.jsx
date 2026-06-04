import { useEffect, useState } from 'react'
import { SHEET_TYPES } from './constants'

const typeIcon = (t) => SHEET_TYPES.find((x) => x.type === t)?.icon ?? '•'

export function SheetListDrawer({ sheets, activeId, onClose, onPick }) {
  const [q, setQ] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = sheets.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-bgDeep/60" />
      <div
        className="absolute left-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col border-r-2 border-gold bg-bg px-3 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="pixel-title text-[11px]">ЛИСТЫ ({sheets.length})</span>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg">✕</button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск…"
          className="field mb-3 !py-2"
        />
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {shown.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className={`flex items-center gap-2 border-2 px-3 py-2 text-left text-sm ${
                s.id === activeId ? 'border-gold bg-surface2 text-ink' : 'border-line bg-bg/40 text-muted hover:text-ink'
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-bgDeep" style={{ background: s.color || '#4A3578' }} />
              <span className="text-faint">{typeIcon(s.type)}</span>
              <span className="truncate">{s.title}</span>
            </button>
          ))}
          {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Ничего не найдено</p>}
        </div>
      </div>
    </div>
  )
}

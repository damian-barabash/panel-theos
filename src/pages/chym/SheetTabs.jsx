import { useRef, useState } from 'react'
import { SHEET_TYPES } from './constants'
import { PASTELS } from './constants'

export function SheetTabs({
  sheets, activeId, onSelect, onCreate, onRename, onRecolor, onDelete, onDuplicate, onReorder,
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [menuId, setMenuId] = useState(null)
  const dragId = useRef(null)

  function handleDrop(targetId) {
    const from = dragId.current
    dragId.current = null
    if (!from || from === targetId) return
    const ids = sheets.map((s) => s.id)
    const fromIdx = ids.indexOf(from)
    const toIdx = ids.indexOf(targetId)
    ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0])
    onReorder(ids)
  }

  return (
    <div className="relative flex items-stretch gap-1 border-t-2 border-line bg-bgDeep/70 px-2 py-1.5">
      {/* add */}
      <div className="relative">
        <button
          onClick={() => setAddOpen((v) => !v)}
          title="Новый лист"
          className="flex h-8 w-8 items-center justify-center border-2 border-line2 bg-surface2 text-gold text-lg leading-none hover:bg-surface2/70"
        >
          +
        </button>
        {addOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
            <div className="absolute bottom-10 left-0 z-20 w-52 border-2 border-gold bg-surface p-1.5 shadow-xl">
              {SHEET_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => { setAddOpen(false); onCreate(t.type) }}
                  className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-surface2"
                >
                  <span className="text-base">{t.icon}</span>
                  <span>
                    <span className="block text-sm text-ink">{t.label}</span>
                    <span className="block text-[10px] text-faint">{t.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* tabs (scrollable) */}
      <div className="flex flex-1 items-stretch gap-1 overflow-x-auto">
        {sheets.map((s) => {
          const active = s.id === activeId
          return (
            <div
              key={s.id}
              draggable
              onDragStart={() => { dragId.current = s.id }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(s.id)}
              className="relative shrink-0"
            >
              <button
                onClick={() => onSelect(s.id)}
                onDoubleClick={() => setMenuId(s.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-2 px-3 py-1.5 font-sans text-[12px] ${
                  active
                    ? 'border-gold bg-surface2 text-ink'
                    : 'border-line bg-bg/40 text-muted hover:text-ink'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-bgDeep"
                  style={{ background: s.color || '#4A3578' }}
                />
                {s.title}
                <span
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === s.id ? null : s.id) }}
                  className="ml-1 text-faint hover:text-ink"
                >
                  ⋯
                </span>
              </button>

              {menuId === s.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                  <div className="absolute bottom-10 left-0 z-20 w-56 border-2 border-line2 bg-surface p-2 shadow-xl">
                    <button
                      onClick={() => {
                        const t = prompt('Название листа:', s.title)
                        setMenuId(null)
                        if (t && t.trim()) onRename(s, t.trim())
                      }}
                      className="block w-full px-2 py-1.5 text-left text-sm text-ink hover:bg-surface2"
                    >
                      Переименовать
                    </button>
                    <button
                      onClick={() => { setMenuId(null); onDuplicate(s) }}
                      className="block w-full px-2 py-1.5 text-left text-sm text-ink hover:bg-surface2"
                    >
                      Дублировать
                    </button>
                    <button
                      onClick={() => { setMenuId(null); onDelete(s) }}
                      className="block w-full px-2 py-1.5 text-left text-sm text-danger hover:bg-surface2"
                    >
                      Удалить
                    </button>
                    <div className="mt-1.5 border-t border-line pt-1.5">
                      <span className="label mb-1.5 block">Цвет вкладки</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => onRecolor(s, null)}
                          className="h-5 w-5 border-2 border-line bg-bgDeep text-[10px] text-faint leading-none"
                        >✕</button>
                        {PASTELS.map((p) => (
                          <button
                            key={p.hex}
                            onClick={() => onRecolor(s, p.hex)}
                            title={p.name}
                            style={{ background: p.hex }}
                            className={`h-5 w-5 border-2 ${s.color === p.hex ? 'border-gold' : 'border-bgDeep'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

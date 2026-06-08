import { useRef, useState } from 'react'
import { SHEET_TYPES, PASTELS } from './constants'

export function SheetTabs({
  sheets, activeId, onSelect, onCreate, onRename, onRecolor, onDelete, onDuplicate, onReorder,
}) {
  const [addOpen, setAddOpen] = useState(false)
  // menu = { id, left, bottom } — fixed-positioned so it's never clipped by the
  // horizontally-scrolling tab strip (overflow clips both axes).
  const [menu, setMenu] = useState(null)
  // drag = { id, before } while a pointer-reorder gesture is active.
  // `before` is the id of the tab the dragged tab will land in front of (null = end).
  const [drag, setDrag] = useState(null)
  const tabRefs = useRef({})

  const menuSheet = menu ? sheets.find((s) => s.id === menu.id) : null

  function openMenu(e, id) {
    e.stopPropagation()
    if (menu?.id === id) { setMenu(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ id, left: r.left, bottom: window.innerHeight - r.top + 8 })
  }

  // Which tab should the dragged tab land before, given a pointer x? (null = drop at end)
  function markerBeforeId(dragId, x) {
    for (const s of sheets) {
      if (s.id === dragId) continue
      const el = tabRefs.current[s.id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x < r.left + r.width / 2) return s.id
    }
    return null
  }

  function buildOrder(dragId, before) {
    const orig = sheets.map((s) => s.id)
    const rest = orig.filter((id) => id !== dragId)
    const idx = before == null ? rest.length : rest.indexOf(before)
    rest.splice(idx, 0, dragId)
    if (rest.every((id, i) => id === orig[i])) return null
    return rest
  }

  // Pointer-based reorder: distinguishes a plain click (select) from a drag (reorder)
  // by a small movement threshold — smooth, like dragging Google Sheets tabs.
  function onTabPointerDown(e, id) {
    if (e.button !== 0) return
    if (e.target.closest('[data-no-drag]')) return // ⋯ menu trigger
    const startX = e.clientX
    let moved = false
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - startX) < 5) return
      moved = true
      setDrag({ id, before: markerBeforeId(id, ev.clientX) })
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!moved) {
        onSelect(id)
      } else {
        const order = buildOrder(id, markerBeforeId(id, ev.clientX))
        if (order) onReorder(order)
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="flex items-stretch gap-1 border-t-2 border-line bg-bgDeep/70 px-2 py-1.5">
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
            <div className="fixed inset-0 z-30" onClick={() => setAddOpen(false)} />
            <div className="absolute bottom-10 left-0 z-40 w-52 border-2 border-gold bg-surface p-1.5 shadow-xl">
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

      {/* tabs (scrollable, pointer-reorderable) */}
      <div className="flex flex-1 items-stretch gap-1 overflow-x-auto">
        {sheets.map((s) => {
          const active = s.id === activeId
          const dragging = drag?.id === s.id
          return (
            <div key={s.id} className="flex shrink-0 items-stretch">
              {/* insertion marker before this tab */}
              {drag && drag.before === s.id && (
                <span className="mr-1 w-0.5 self-stretch rounded bg-gold" />
              )}
              <button
                ref={(el) => { tabRefs.current[s.id] = el }}
                onPointerDown={(e) => onTabPointerDown(e, s.id)}
                onDoubleClick={(e) => openMenu(e, s.id)}
                className={`flex touch-none select-none items-center gap-2 whitespace-nowrap border-2 px-3 py-1.5 font-sans text-[12px] ${
                  active
                    ? 'border-gold bg-surface2 text-ink'
                    : 'border-line bg-bg/40 text-muted hover:text-ink'
                } ${dragging ? 'cursor-grabbing opacity-50' : 'cursor-grab'}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-bgDeep"
                  style={{ background: s.color || '#4A3578' }}
                />
                {s.title}
                <span
                  data-no-drag
                  onClick={(e) => openMenu(e, s.id)}
                  className="ml-1 text-faint hover:text-ink"
                >
                  ⋯
                </span>
              </button>
            </div>
          )
        })}
        {/* insertion marker at the end */}
        {drag && drag.before === null && (
          <span className="w-0.5 self-stretch rounded bg-gold" />
        )}
      </div>

      {/* per-tab menu — fixed so it can't be clipped by the tab strip */}
      {menuSheet && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-56 border-2 border-line2 bg-surface p-2 shadow-xl"
            style={{ left: menu.left, bottom: menu.bottom }}
          >
            <button
              onClick={() => {
                const t = prompt('Название листа:', menuSheet.title)
                setMenu(null)
                if (t && t.trim()) onRename(menuSheet, t.trim())
              }}
              className="block w-full px-2 py-1.5 text-left text-sm text-ink hover:bg-surface2"
            >
              Переименовать
            </button>
            <button
              onClick={() => { setMenu(null); onDuplicate(menuSheet) }}
              className="block w-full px-2 py-1.5 text-left text-sm text-ink hover:bg-surface2"
            >
              Дублировать
            </button>
            <button
              onClick={() => { setMenu(null); onDelete(menuSheet) }}
              className="block w-full px-2 py-1.5 text-left text-sm text-danger hover:bg-surface2"
            >
              Удалить
            </button>
            <div className="mt-1.5 border-t border-line pt-1.5">
              <span className="label mb-1.5 block">Цвет вкладки</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onRecolor(menuSheet, null)}
                  className="h-5 w-5 border-2 border-line bg-bgDeep text-[10px] text-faint leading-none"
                >✕</button>
                {PASTELS.map((p) => (
                  <button
                    key={p.hex}
                    onClick={() => onRecolor(menuSheet, p.hex)}
                    title={p.name}
                    style={{ background: p.hex }}
                    className={`h-5 w-5 border-2 ${menuSheet.color === p.hex ? 'border-gold' : 'border-bgDeep'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

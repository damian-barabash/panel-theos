import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Spinner, useToast } from '../../components/ui'
import {
  listSheets, createSheet, duplicateSheet, patchSheet, deleteSheet,
  reorderSheets, saveContent,
} from './chymApi'
import { titleIndex } from './hashtags'
import { SheetTabs } from './SheetTabs'
import { SheetListDrawer } from './SheetListDrawer'
import { GraphView } from './GraphView'
import DocSheet from './DocSheet'
import TableSheet from './TableSheet'
import MindmapSheet from './MindmapSheet'

export default function ChymWriter() {
  const toast = useToast()
  const [sheets, setSheets] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  const saveTimers = useRef({})

  const load = useCallback(async (keepActive) => {
    const data = await listSheets()
    setSheets(data)
    setActiveId((cur) => {
      const next = keepActive ?? cur
      if (next && data.some((s) => s.id === next)) return next
      return data[0]?.id ?? null
    })
  }, [])

  useEffect(() => { load() }, [load])

  const active = sheets?.find((s) => s.id === activeId) ?? null
  const index = useMemo(() => titleIndex(sheets ?? []), [sheets])

  const goToSheet = useCallback((id) => {
    setActiveId(id)
    setDrawerOpen(false)
    setGraphOpen(false)
  }, [])

  // Local content edit + debounced autosave for the active sheet.
  const onContentChange = useCallback((content) => {
    if (!activeId) return
    setSheets((prev) =>
      (prev ?? []).map((s) => (s.id === activeId ? { ...s, content } : s)),
    )
    clearTimeout(saveTimers.current[activeId])
    saveTimers.current[activeId] = setTimeout(() => {
      saveContent(activeId, content).catch((e) => toast.error(e.message))
    }, 700)
  }, [activeId, toast])

  // ── Sheet operations ───────────────────────────────────────────────────────
  async function onCreate(type) {
    try {
      const row = await createSheet({ type })
      await load(row.id)
    } catch (e) { toast.error(e.message) }
  }
  async function onDuplicate(sheet) {
    try { const row = await duplicateSheet(sheet); await load(row.id) }
    catch (e) { toast.error(e.message) }
  }
  async function onRename(sheet, title) {
    try {
      await patchSheet(sheet.id, { title }, { log: { action: 'chym.rename', summary: `Лист переименован → «${title}»` } })
      await load(sheet.id)
    } catch (e) { toast.error(e.message) }
  }
  async function onRecolor(sheet, color) {
    setSheets((prev) => prev.map((s) => (s.id === sheet.id ? { ...s, color } : s)))
    try { await patchSheet(sheet.id, { color }) } catch (e) { toast.error(e.message) }
  }
  async function onDelete(sheet) {
    if (!confirm(`Удалить лист «${sheet.title}»?`)) return
    try { await deleteSheet(sheet); await load() } catch (e) { toast.error(e.message) }
  }
  async function onReorder(orderedIds) {
    setSheets((prev) => orderedIds.map((id) => prev.find((s) => s.id === id)))
    try { await reorderSheets(orderedIds) } catch (e) { toast.error(e.message) }
  }
  async function onFont(font) {
    if (!active) return
    setSheets((prev) => prev.map((s) => (s.id === active.id ? { ...s, font } : s)))
    try { await patchSheet(active.id, { font }) } catch (e) { toast.error(e.message) }
  }

  if (sheets === null) {
    return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
  }

  return (
    <div
      className="-mx-4 -my-6 flex flex-col sm:-mx-6 lg:-mx-8"
      style={{ height: 'calc(100dvh - 56px)' }}
    >
      {/* header */}
      <div className="flex items-center gap-2 border-b-2 border-line bg-bg/80 px-3 py-2">
        <span className="pixel-title text-[11px] xs:text-xs">CHYM WRITER</span>
        <span className="label truncate hidden sm:block">{active ? active.title : '—'}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <IconBtn title="Список листов" onClick={() => setDrawerOpen(true)}>☰</IconBtn>
          <IconBtn title="Граф связей" onClick={() => setGraphOpen(true)}>❖</IconBtn>
        </div>
      </div>

      {/* editor */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
            <p className="text-sm">Нет листов. Создай первый снизу →</p>
          </div>
        ) : active.type === 'doc' ? (
          <DocSheet key={active.id} sheet={active} index={index} onChange={onContentChange} onFont={onFont} goToSheet={goToSheet} />
        ) : active.type === 'table' ? (
          <TableSheet key={active.id} sheet={active} index={index} onChange={onContentChange} onFont={onFont} goToSheet={goToSheet} />
        ) : (
          <MindmapSheet key={active.id} sheet={active} index={index} onChange={onContentChange} goToSheet={goToSheet} />
        )}
      </div>

      {/* bottom tabs */}
      <SheetTabs
        sheets={sheets}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={onCreate}
        onRename={onRename}
        onRecolor={onRecolor}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onReorder={onReorder}
      />

      {drawerOpen && (
        <SheetListDrawer
          sheets={sheets}
          activeId={activeId}
          onClose={() => setDrawerOpen(false)}
          onPick={goToSheet}
        />
      )}
      {graphOpen && (
        <GraphView sheets={sheets} onClose={() => setGraphOpen(false)} onPick={goToSheet} />
      )}
    </div>
  )
}

function IconBtn({ children, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center border-2 border-line2 bg-surface2 text-gold text-base hover:bg-surface2/70"
    >
      {children}
    </button>
  )
}

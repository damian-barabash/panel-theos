import { useRef, useState, useCallback, useEffect } from 'react'
import { PastelPicker, FontPicker } from './Pickers'
import { splitWithTags } from './hashtags'
import { fontCss } from './constants'

const colLetter = (i) => {
  let s = ''
  i += 1
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26) }
  return s
}
const blankCell = () => ({ t: '', bg: null, bold: false, align: 'left', font: null })

export default function TableSheet({ sheet, index, onChange, onFont, goToSheet }) {
  const [data, setData] = useState(() => normalizeContent(sheet.content))
  const [sel, setSel] = useState({ r1: 0, c1: 0, r2: 0, c2: 0 })
  // editing = { r, c, seed? } — seed (a typed char) replaces cell content on entry.
  const [editing, setEditing] = useState(null)
  const resizing = useRef(null)
  const dragging = useRef(false)
  const cancelEdit = useRef(false)

  // End drag-selection wherever the mouse is released.
  useEffect(() => {
    const up = () => { dragging.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const commit = useCallback((next) => { setData(next); onChange(next) }, [onChange])

  // Type-to-edit (печатаешь на выделенной ячейке — сразу пишет) + Enter to edit.
  useEffect(() => {
    const onKey = (e) => {
      if (editing) return
      const t = e.target
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const { r1, c1 } = norm(sel)
      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing({ r: r1, c: c1 }); return }
      if (e.key.length === 1) { e.preventDefault(); setEditing({ r: r1, c: c1, seed: e.key }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, sel])

  // Paste a Google-Sheets / Excel block (TSV) starting at the selection anchor.
  useEffect(() => {
    const onPaste = (e) => {
      if (editing) return // let native paste fall into the open cell editor
      const t = e.target
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const text = e.clipboardData?.getData('text/plain')
      if (!text) return
      e.preventDefault()
      pasteAt(text)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, sel, data])

  function pasteAt(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
    const grid = lines.map((line) => line.split('\t'))
    const { r1, c1 } = norm(sel)
    const needRows = r1 + grid.length
    const needCols = c1 + Math.max(...grid.map((g) => g.length))
    const columns = data.columns.slice()
    while (columns.length < needCols) columns.push({ id: `c${Date.now()}_${columns.length}`, w: 130 })
    const rows = data.rows.map((row) => {
      const nr = row.slice()
      while (nr.length < columns.length) nr.push(blankCell())
      return nr
    })
    while (rows.length < needRows) rows.push(columns.map(blankCell))
    for (let i = 0; i < grid.length; i++)
      for (let j = 0; j < grid[i].length; j++)
        rows[r1 + i][c1 + j] = { ...rows[r1 + i][c1 + j], t: grid[i][j] }
    commit({ ...data, columns, rows, merges: [] })
    setSel({ r1, c1, r2: needRows - 1, c2: needCols - 1 })
  }

  const inSel = (r, c) => {
    const { r1, c1, r2, c2 } = norm(sel)
    return r >= r1 && r <= r2 && c >= c1 && c <= c2
  }
  const selCells = () => {
    const { r1, c1, r2, c2 } = norm(sel)
    const out = []
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push([r, c])
    return out
  }

  function applyToSel(fn) {
    const rows = data.rows.map((row) => row.slice())
    for (const [r, c] of selCells()) rows[r][c] = { ...rows[r][c], ...fn(rows[r][c]) }
    commit({ ...data, rows })
  }
  const setBg = (bg) => applyToSel(() => ({ bg }))
  const toggleBold = () => { const cur = data.rows[sel.r1][sel.c1].bold; applyToSel(() => ({ bold: !cur })) }
  const setAlign = (align) => applyToSel(() => ({ align }))
  const setCellFont = (font) => applyToSel(() => ({ font }))

  function setCellText(r, c, t) {
    const rows = data.rows.map((row) => row.slice())
    rows[r][c] = { ...rows[r][c], t }
    commit({ ...data, rows })
  }

  function addRow() {
    const rows = [...data.rows, data.columns.map(blankCell)]
    commit({ ...data, rows })
  }
  function addCol() {
    const columns = [...data.columns, { id: `c${Date.now()}`, w: 130 }]
    const rows = data.rows.map((row) => [...row, blankCell()])
    commit({ ...data, columns, rows })
  }
  function delRow() {
    if (data.rows.length <= 1) return
    const { r2 } = norm(sel)
    const rows = data.rows.filter((_, i) => i !== r2)
    commit({ ...data, rows, merges: [] })
    setSel((s) => ({ ...s, r1: 0, r2: 0 }))
  }
  function delCol() {
    if (data.columns.length <= 1) return
    const { c2 } = norm(sel)
    const columns = data.columns.filter((_, i) => i !== c2)
    const rows = data.rows.map((row) => row.filter((_, i) => i !== c2))
    commit({ ...data, columns, rows, merges: [] })
    setSel((s) => ({ ...s, c1: 0, c2: 0 }))
  }

  function mergeSel() {
    const { r1, c1, r2, c2 } = norm(sel)
    if (r1 === r2 && c1 === c2) return
    const merges = data.merges.filter((m) => !overlaps(m, { r1, c1, r2, c2}))
    merges.push({ r: r1, c: c1, rs: r2 - r1 + 1, cs: c2 - c1 + 1 })
    commit({ ...data, merges })
  }
  function unmergeSel() {
    const { r1, c1 } = norm(sel)
    const merges = data.merges.filter((m) => !(m.r === r1 && m.c === c1))
    commit({ ...data, merges })
  }

  // column resize
  function startResize(e, ci) {
    e.preventDefault()
    resizing.current = { ci, startX: e.clientX, startW: data.columns[ci].w }
    const move = (ev) => {
      const { ci, startX, startW } = resizing.current
      const w = Math.max(48, startW + (ev.clientX - startX))
      setData((d) => ({ ...d, columns: d.columns.map((c, i) => (i === ci ? { ...c, w } : c)) }))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setData((d) => { onChange(d); return d })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // merge lookup
  const covered = new Set()
  const spanAt = new Map()
  for (const m of data.merges) {
    spanAt.set(`${m.r}:${m.c}`, m)
    for (let r = m.r; r < m.r + m.rs; r++)
      for (let c = m.c; c < m.c + m.cs; c++)
        if (!(r === m.r && c === m.c)) covered.add(`${r}:${c}`)
  }

  const tbBtn = (active) => `px-2 py-1 border-2 text-xs ${active ? 'border-gold text-gold' : 'border-line text-muted hover:text-ink'}`

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b-2 border-line bg-bg/60 px-2 py-1.5">
        <button className={tbBtn(false)} onClick={addRow}>+ строка</button>
        <button className={tbBtn(false)} onClick={addCol}>+ колонка</button>
        <button className={tbBtn(false)} onClick={delRow}>− строка</button>
        <button className={tbBtn(false)} onClick={delCol}>− колонка</button>
        <span className="mx-1 w-px self-stretch bg-line" />
        <button className={tbBtn(data.rows[sel.r1]?.[sel.c1]?.bold)} onClick={toggleBold}><b>B</b></button>
        <button className={tbBtn(false)} onClick={() => setAlign('left')}>⫷</button>
        <button className={tbBtn(false)} onClick={() => setAlign('center')}>≡</button>
        <button className={tbBtn(false)} onClick={() => setAlign('right')}>⫸</button>
        <span className="mx-1 w-px self-stretch bg-line" />
        <button className={tbBtn(false)} onClick={mergeSel}>⛶ объединить</button>
        <button className={tbBtn(false)} onClick={unmergeSel}>разъединить</button>
        <span className="mx-1 w-px self-stretch bg-line" />
        <div className="flex items-center gap-1.5"><PastelPicker value={data.rows[sel.r1]?.[sel.c1]?.bg} onChange={setBg} /></div>
        <span className="ml-auto flex items-center gap-1.5">
          <FontPicker value={sheet.font} onChange={onFont} />
        </span>
      </div>

      {/* grid */}
      <div className="min-h-0 flex-1 overflow-auto bg-bgDeep/40 p-3">
        <table className="border-collapse select-none" style={{ fontFamily: fontCss(sheet.font) }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 h-7 w-10 border border-line bg-surface2" />
              {data.columns.map((col, ci) => (
                <th key={col.id} style={{ width: col.w, minWidth: col.w }}
                  className="relative h-7 border border-line bg-surface2 text-[10px] font-mono text-faint">
                  {colLetter(ci)}
                  <span
                    onMouseDown={(e) => startResize(e, ci)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-gold/60"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={r}>
                <td className="sticky left-0 z-10 h-7 w-10 border border-line bg-surface2 text-center text-[10px] font-mono text-faint">{r + 1}</td>
                {row.map((cell, c) => {
                  if (covered.has(`${r}:${c}`)) return null
                  const span = spanAt.get(`${r}:${c}`)
                  const isEditing = editing && editing.r === r && editing.c === c
                  return (
                    <td
                      key={c}
                      rowSpan={span?.rs}
                      colSpan={span?.cs}
                      onMouseDown={(e) => {
                        if (editing && editing.r === r && editing.c === c) return
                        if (e.shiftKey) {
                          setSel((s) => ({ ...s, r2: r, c2: c }))
                        } else {
                          setSel({ r1: r, c1: c, r2: r, c2: c })
                          dragging.current = true
                        }
                      }}
                      onMouseEnter={() => {
                        if (dragging.current) setSel((s) => ({ ...s, r2: r, c2: c }))
                      }}
                      onDoubleClick={() => setEditing({ r, c })}
                      style={{
                        background: cell.bg || 'transparent',
                        textAlign: cell.align || 'left',
                        fontWeight: cell.bold ? 700 : 400,
                        fontFamily: cell.font ? fontCss(cell.font) : undefined,
                        color: cell.bg ? '#1A1030' : '#F2EAD3',
                        // Full box outline on selection (border-collapse would
                        // otherwise only show on the bottom/right shared edges).
                        ...(inSel(r, c)
                          ? { outline: '2px solid #E8B547', outlineOffset: '-2px', position: 'relative', zIndex: 1 }
                          : {}),
                      }}
                      className="h-7 border border-line px-1.5 py-1 align-top text-[13px]"
                    >
                      {isEditing ? (
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          ref={(el) => {
                            if (!el || el.dataset.init) return
                            el.dataset.init = '1'
                            el.textContent = editing.seed != null ? editing.seed : cell.t
                            el.focus()
                            const range = document.createRange()
                            range.selectNodeContents(el)
                            range.collapse(false) // cursor at end
                            const s = window.getSelection()
                            s.removeAllRanges()
                            s.addRange(range)
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() }
                            else if (e.key === 'Escape') { e.preventDefault(); cancelEdit.current = true; setEditing(null) }
                          }}
                          onBlur={(e) => {
                            if (cancelEdit.current) { cancelEdit.current = false; setEditing(null); return }
                            setCellText(r, c, e.currentTarget.textContent)
                            setEditing(null)
                          }}
                          className="min-w-[40px] outline-none"
                        />
                      ) : (
                        <span className="whitespace-pre-wrap break-words">
                          {splitWithTags(cell.t, index).map((p, i) =>
                            p.tag != null ? (
                              <span
                                key={i}
                                onMouseDown={(e) => { if (p.sheetId) { e.stopPropagation(); goToSheet(p.sheetId) } }}
                                className={p.sheetId ? 'cursor-pointer font-semibold underline decoration-dotted' : ''}
                                style={p.sheetId ? { color: cell.bg ? '#5a2a9a' : '#8FD0FF' } : undefined}
                              >{p.raw}</span>
                            ) : (
                              <span key={i}>{p.text}</span>
                            ),
                          )}
                          {!cell.t && <span className="text-transparent">·</span>}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-faint">Двойной клик или Enter — редактировать · печатай на выделенной — пишет сразу · Shift+клик — диапазон · Ctrl/⌘+V — вставка из таблиц · #ИмяЛиста — ссылка.</p>
      </div>
    </div>
  )
}

function norm(s) {
  return {
    r1: Math.min(s.r1, s.r2), c1: Math.min(s.c1, s.c2),
    r2: Math.max(s.r1, s.r2), c2: Math.max(s.c1, s.c2),
  }
}
function overlaps(m, sel) {
  const mr2 = m.r + m.rs - 1, mc2 = m.c + m.cs - 1
  return !(mr2 < sel.r1 || m.r > sel.r2 || mc2 < sel.c1 || m.c > sel.c2)
}
function normalizeContent(content) {
  const columns = content?.columns?.length ? content.columns : Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, w: 140 }))
  const rows = content?.rows?.length
    ? content.rows.map((row) => columns.map((_, c) => ({ ...blankCell(), ...(row[c] || {}) })))
    : Array.from({ length: 6 }, () => columns.map(blankCell))
  return { columns, rows, merges: content?.merges || [] }
}

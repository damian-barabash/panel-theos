// Hashtag mechanic: `#SheetName` links sheets together. A tag resolves when its
// normalized form equals a sheet title's normalized form. Resolved tags are
// clickable (jump to sheet) and become edges in the Obsidian-style graph.

export const TAG_RE = /#([\p{L}\p{N}_]+)/gu

export const normalize = (s) =>
  (s || '').toString().toLowerCase().replace(/\s+/g, '').trim()

function htmlToText(html) {
  if (!html) return ''
  // Strip tags; good enough for tag extraction.
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
}

/** Raw tag tokens (without #) present in a sheet's content. */
export function extractTags(sheet) {
  const c = sheet?.content || {}
  let text = ''
  if (sheet.type === 'doc') text = htmlToText(c.html)
  else if (sheet.type === 'mindmap') text = (c.nodes || []).map((n) => n.text || '').join(' ')
  else if (sheet.type === 'table')
    text = (c.rows || []).flat().map((cell) => cell?.t || '').join(' ')
  const out = []
  for (const m of text.matchAll(TAG_RE)) out.push(m[1])
  return out
}

/** Map of normalized title -> sheet id (first by sort wins on collision). */
export function titleIndex(sheets) {
  const map = new Map()
  for (const s of sheets) {
    const k = normalize(s.title)
    if (k && !map.has(k)) map.set(k, s.id)
  }
  return map
}

/** Resolve a raw tag token to a sheet id, or null. */
export function resolveTag(tag, index) {
  return index.get(normalize(tag)) ?? null
}

/** Directed unique edges between sheets via resolved hashtags. */
export function graphLinks(sheets) {
  const index = titleIndex(sheets)
  const seen = new Set()
  const edges = []
  for (const s of sheets) {
    for (const tag of extractTags(s)) {
      const target = resolveTag(tag, index)
      if (target && target !== s.id) {
        const key = `${s.id}->${target}`
        if (!seen.has(key)) {
          seen.add(key)
          edges.push({ source: s.id, target })
        }
      }
    }
  }
  return edges
}

/**
 * Splits a plain-text string into parts for inline rendering, marking hashtag
 * tokens that resolve to a sheet. Used by table cells & mindmap nodes.
 * Returns [{ text }] | [{ tag, raw, sheetId }].
 */
export function splitWithTags(text, index) {
  const parts = []
  let last = 0
  const src = text || ''
  for (const m of src.matchAll(TAG_RE)) {
    const start = m.index
    if (start > last) parts.push({ text: src.slice(last, start) })
    const sheetId = resolveTag(m[1], index)
    parts.push({ tag: m[1], raw: m[0], sheetId })
    last = start + m[0].length
  }
  if (last < src.length) parts.push({ text: src.slice(last) })
  return parts
}

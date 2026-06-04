// Shared Chym Writer constants: pastel palette + selectable fonts.

export const PASTELS = [
  { name: 'Роза', hex: '#F7C6D9' },
  { name: 'Персик', hex: '#F8D2B0' },
  { name: 'Лимон', hex: '#F4ECB0' },
  { name: 'Мята', hex: '#Bfead0' },
  { name: 'Небо', hex: '#Bcdcf0' },
  { name: 'Лаванда', hex: '#D6C8F2' },
  { name: 'Сирень', hex: '#E6C6EE' },
  { name: 'Глина', hex: '#E3C9B8' },
  { name: 'Шалфей', hex: '#CFE0C3' },
  { name: 'Серый', hex: '#D8D8E0' },
]

export const FONTS = [
  { id: 'inter', label: 'Inter', css: "'Inter', system-ui, sans-serif" },
  { id: 'caveat', label: 'Caveat', css: "'Caveat', cursive" },
  { id: 'patrick', label: 'Patrick Hand', css: "'Patrick Hand', cursive" },
  { id: 'lora', label: 'Lora', css: "'Lora', serif" },
  { id: 'mono', label: 'JetBrains Mono', css: "'JetBrains Mono', monospace" },
]

export const fontCss = (id) =>
  (FONTS.find((f) => f.id === id) || FONTS[0]).css

export const SHEET_TYPES = [
  { type: 'doc', label: 'Документ', icon: '📄', hint: 'Текст как в Word (Markdown)' },
  { type: 'table', label: 'Таблица', icon: '▦', hint: 'Сетка ячеек и цветов' },
  { type: 'mindmap', label: 'Майндмап', icon: '◓', hint: 'Карточки и связи' },
]

// Starter content for a freshly created sheet of each type.
export function blankContent(type) {
  if (type === 'table') {
    const cols = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, w: 140 }))
    const rows = Array.from({ length: 6 }, () =>
      cols.map(() => ({ t: '', bg: null, bold: false, align: 'left', font: null })),
    )
    return { columns: cols, rows, merges: [] }
  }
  if (type === 'mindmap') {
    return {
      nodes: [
        { id: 'n1', x: 240, y: 160, text: 'Идея', color: '#D6C8F2' },
      ],
      edges: [],
    }
  }
  return { html: '' } // doc
}

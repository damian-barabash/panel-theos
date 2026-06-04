import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { normalize } from './hashtags'
import { fontCss } from './constants'
import { FontPicker } from './Pickers'

const TAG = /#([\p{L}\p{N}_]+)/gu

// ProseMirror plugin: highlight #hashtags; resolved ones are clickable.
const HashtagHighlight = Extension.create({
  name: 'hashtagHighlight',
  addOptions() {
    return { getIndex: () => new Map(), onTagClick: () => {} }
  },
  addProseMirrorPlugins() {
    const opts = this.options
    return [
      new Plugin({
        props: {
          decorations(state) {
            const idx = opts.getIndex()
            const decos = []
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              const text = node.text
              TAG.lastIndex = 0
              let m
              while ((m = TAG.exec(text))) {
                const from = pos + m.index
                const to = from + m[0].length
                const id = idx.get(normalize(m[1]))
                decos.push(
                  Decoration.inline(from, to, {
                    class: id ? 'chym-tag chym-tag-live' : 'chym-tag chym-tag-dead',
                    'data-sheet': id || '',
                  }),
                )
              }
            })
            return DecorationSet.create(state.doc, decos)
          },
          handleClick(view, pos, event) {
            const el = event.target.closest?.('.chym-tag-live')
            if (el) {
              const id = el.getAttribute('data-sheet')
              if (id) { opts.onTagClick(id); return true }
            }
            return false
          },
        },
      }),
    ]
  },
})

export default function DocSheet({ sheet, index, onChange, onFont, goToSheet }) {
  const idxRef = useRef(index)
  const goRef = useRef(goToSheet)
  idxRef.current = index
  goRef.current = goToSheet

  const editor = useEditor({
    extensions: [
      // StarterKit v3 already bundles Underline (and bold/italic/lists/…).
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Пиши… (Markdown работает: # заголовок, **жирный**, - список). #ИмяЛиста — ссылка на лист.' }),
      HashtagHighlight.configure({
        getIndex: () => idxRef.current,
        onTagClick: (id) => goRef.current(id),
      }),
    ],
    content: sheet.content?.html || '',
    onUpdate: ({ editor }) => onChange({ html: editor.getHTML() }),
  })

  // Re-render decorations when the sheet list (titles) changes.
  useEffect(() => {
    if (editor) editor.view.dispatch(editor.state.tr.setMeta('chymRefresh', true))
  }, [index, editor])

  if (!editor) return null
  const btn = (active) =>
    `px-2 py-1 border-2 text-xs ${active ? 'border-gold text-gold' : 'border-line text-muted hover:text-ink'}`

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b-2 border-line bg-bg/60 px-2 py-1.5">
        <button className={btn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button className={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <span className="mx-1 w-px self-stretch bg-line" />
        <button className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
        <button className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button className={btn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
        <span className="mx-1 w-px self-stretch bg-line" />
        <button className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Список</button>
        <button className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</button>
        <button className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</button>
        <span className="mx-1 w-px self-stretch bg-line" />
        <button className={btn(editor.isActive({ textAlign: 'left' }))} onClick={() => editor.chain().focus().setTextAlign('left').run()}>⫷</button>
        <button className={btn(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()}>≡</button>
        <button className={btn(editor.isActive({ textAlign: 'right' }))} onClick={() => editor.chain().focus().setTextAlign('right').run()}>⫸</button>
        <span className="ml-auto" />
        <FontPicker value={sheet.font} onChange={onFont} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" style={{ fontFamily: fontCss(sheet.font) }}>
        <EditorContent editor={editor} className="chym-doc mx-auto max-w-3xl" />
      </div>
    </div>
  )
}

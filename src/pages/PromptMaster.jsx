import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { logAction, aiChat } from '../lib/api'
import { PixelFrame, PixelButton, Spinner, useToast } from '../components/ui'

const CAT_LABEL = { persona: 'Персона', advisor: 'Советник', planner: 'Планер', general: 'Общее' }

export default function PromptMaster() {
  const [prompts, setPrompts] = useState(null)
  const [active, setActive] = useState(null) // prompt key | 'lore' | 'chat'

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('ai_prompts')
      .select('*')
      .order('sort', { ascending: true })
    setPrompts(data ?? [])
    setActive((cur) => cur ?? (data && data[0] ? data[0].key : 'chat'))
  }, [])

  useEffect(() => { load() }, [load])

  if (prompts === null) {
    return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
  }

  const activePrompt = prompts.find((p) => p.key === active)

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="pixel-title mb-4 text-sm xs:text-base">ПРОМТ-МАСТЕР</h1>

      {/* sub-tabs — horizontal scroll on small screens */}
      <div className="mb-5 -mx-1 flex gap-1.5 overflow-x-auto pb-1">
        {prompts.map((p) => (
          <SubTab key={p.key} active={active === p.key} onClick={() => setActive(p.key)}>
            {p.title}
          </SubTab>
        ))}
        <SubTab active={active === 'lore'} onClick={() => setActive('lore')} accent="crystal">
          История мира
        </SubTab>
        <SubTab active={active === 'chat'} onClick={() => setActive('chat')} accent="crystal">
          Чат
        </SubTab>
      </div>

      {active === 'lore' ? (
        <LoreManager />
      ) : active === 'chat' ? (
        <TestChat prompts={prompts} />
      ) : activePrompt ? (
        <PromptEditor key={activePrompt.key} prompt={activePrompt} onSaved={load} />
      ) : null}
    </div>
  )
}

function SubTab({ children, active, onClick, accent = 'gold' }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap border-2 px-3 py-2 font-mono text-[10px] uppercase tracking-label transition-colors ${
        active
          ? accent === 'crystal'
            ? 'border-crystal bg-crystal/15 text-crystal'
            : 'border-gold bg-gold/15 text-gold'
          : 'border-line bg-surface2/40 text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

// ── Prompt editor ────────────────────────────────────────────────────────────
function PromptEditor({ prompt, onSaved }) {
  const toast = useToast()
  const [content, setContent] = useState(prompt.content)
  const [temperature, setTemperature] = useState(Number(prompt.temperature))
  const [enabled, setEnabled] = useState(prompt.enabled)
  const [saving, setSaving] = useState(false)

  const dirty =
    content !== prompt.content ||
    Number(temperature) !== Number(prompt.temperature) ||
    enabled !== prompt.enabled

  const vars = Array.isArray(prompt.variables) ? prompt.variables : []

  function insertVar(name) {
    setContent((c) => `${c}{{${name}}}`)
  }

  async function save() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('ai_prompts')
        .update({
          content,
          temperature,
          enabled,
          version: (prompt.version || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prompt.id)
      if (error) throw error
      await logAction({
        action: 'prompt.update', entity: 'ai_prompts', entity_key: prompt.key,
        summary: `Промпт «${prompt.title}» обновлён (v${(prompt.version || 1) + 1})`,
      })
      toast.ok('Сохранено')
      onSaved()
    } catch (e) {
      toast.error(e.message || 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PixelFrame className="px-5 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm uppercase tracking-label text-gold">{prompt.title}</h2>
          <p className="mt-1 text-xs text-muted max-w-xl">{prompt.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip">{CAT_LABEL[prompt.category] || prompt.category}</span>
            <span className="chip">key: {prompt.key}</span>
            <span className="chip">v{prompt.version}</span>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 label">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {enabled ? 'Включён' : 'Выключен'}
        </label>
      </div>

      {vars.length > 0 && (
        <div className="mb-3">
          <span className="label">Плейсхолдеры (клик — вставить):</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {vars.map((v) => (
              <button
                key={v.name}
                onClick={() => insertVar(v.name)}
                title={v.desc}
                className="chip hover:bg-crystal/20"
              >
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={16}
        className="field mb-4"
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3">
          <span className="label">Температура</span>
          <input
            type="range" min={0} max={1.2} step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-32 accent-gold"
          />
          <span className="font-mono text-xs text-ink w-8">{temperature.toFixed(2)}</span>
        </label>
        <div className="flex items-center gap-2">
          {dirty && <span className="label text-warn">не сохранено</span>}
          <PixelButton onClick={save} disabled={saving || !dirty}>
            {saving ? <Spinner className="border-bgDeep/40 border-t-bgDeep" /> : 'Сохранить'}
          </PixelButton>
        </div>
      </div>
    </PixelFrame>
  )
}

// ── World lore manager ───────────────────────────────────────────────────────
function LoreManager() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null) // row | {new:true}

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('world_lore')
      .select('*')
      .order('sort', { ascending: true })
    setRows(data ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  async function remove(row) {
    if (!confirm(`Удалить запись «${row.title}»?`)) return
    const { error } = await supabase.from('world_lore').delete().eq('id', row.id)
    if (error) return toast.error(error.message)
    await logAction({ action: 'lore.delete', entity: 'world_lore', entity_key: row.title, summary: `Лор «${row.title}» удалён` })
    toast.ok('Удалено')
    load()
  }

  if (editing) {
    return <LoreEditor row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
  }

  return (
    <PixelFrame purple className="px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-mono text-sm uppercase tracking-label text-crystal">История мира</h2>
          <p className="mt-1 text-xs text-muted max-w-xl">
            Записи лора подмешиваются в контекст Теоса — он может рассказывать про мир.
            Включённые записи приложение читает автоматически.
          </p>
        </div>
        <PixelButton variant="crystal" onClick={() => setEditing({ new: true })}>+ Запись</PixelButton>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Пока пусто.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border-2 border-line bg-bgDeep/40 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink">{r.title}</span>
                  {!r.enabled && <span className="label text-faint">выкл</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{r.body}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <PixelButton variant="ghost" className="!px-2 !py-1.5 !text-[10px]" onClick={() => setEditing(r)}>Изм.</PixelButton>
                <PixelButton variant="danger" className="!px-2 !py-1.5 !text-[10px]" onClick={() => remove(r)}>✕</PixelButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </PixelFrame>
  )
}

function LoreEditor({ row, onClose, onSaved }) {
  const toast = useToast()
  const isNew = !!row.new
  const [title, setTitle] = useState(row.title || '')
  const [body, setBody] = useState(row.body || '')
  const [category, setCategory] = useState(row.category || 'lore')
  const [sort, setSort] = useState(row.sort ?? 100)
  const [enabled, setEnabled] = useState(row.enabled ?? true)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return toast.error('Нужен заголовок')
    setSaving(true)
    try {
      const payload = { title: title.trim(), body, category, sort: Number(sort) || 0, enabled, updated_at: new Date().toISOString() }
      if (isNew) {
        const { error } = await supabase.from('world_lore').insert(payload)
        if (error) throw error
        await logAction({ action: 'lore.create', entity: 'world_lore', entity_key: title, summary: `Лор «${title}» создан` })
      } else {
        const { error } = await supabase.from('world_lore').update(payload).eq('id', row.id)
        if (error) throw error
        await logAction({ action: 'lore.update', entity: 'world_lore', entity_key: title, summary: `Лор «${title}» изменён` })
      }
      toast.ok('Сохранено')
      onSaved()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PixelFrame purple className="px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-mono text-sm uppercase tracking-label text-crystal">
          {isNew ? 'Новая запись' : 'Запись лора'}
        </h2>
        <button className="text-muted hover:text-ink text-lg" onClick={onClose}>✕</button>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <label className="label mb-2 block">Заголовок</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
        </div>
        <div>
          <label className="label mb-2 block">Текст</label>
          <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} className="field" />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label mb-2 block">Категория</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="field !w-36" />
          </div>
          <div>
            <label className="label mb-2 block">Порядок</label>
            <input type="number" value={sort} onChange={(e) => setSort(e.target.value)} className="field !w-24" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 label pb-2.5">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Включена
          </label>
          <div className="ml-auto pb-1">
            <PixelButton onClick={save} disabled={saving}>
              {saving ? <Spinner className="border-bgDeep/40 border-t-bgDeep" /> : 'Сохранить'}
            </PixelButton>
          </div>
        </div>
      </div>
    </PixelFrame>
  )
}

// ── Live test chat (via ai-proxy) ────────────────────────────────────────────
function TestChat({ prompts }) {
  const toast = useToast()
  const persona = useMemo(() => prompts.find((p) => p.key === 'theos_persona'), [prompts])
  const [lore, setLore] = useState('')
  const [messages, setMessages] = useState([]) // {role, content}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  // load enabled lore to inject (mirrors what the app will do)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('world_lore')
        .select('title, body, enabled, sort')
        .eq('enabled', true)
        .order('sort', { ascending: true })
      if (data && data.length) {
        const block = data.map((r) => `- ${r.title}: ${r.body}`).join('\n')
        setLore(`\n\nЗнание о мире (фон, не зачитывай дословно):\n${block}`)
      } else {
        setLore('')
      }
    })()
  }, [])

  const system = useMemo(() => {
    const base = persona?.content || ''
    return `${base}${lore}\n\nОтвечай живой репликой в роли Теоса — без JSON, без markdown. Это тестовый чат для проверки стиля.`
  }, [persona, lore])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const payload = [{ role: 'system', content: system }, ...next]
      const { content } = await aiChat({ messages: payload, temperature: Number(persona?.temperature) || 0.85 })
      setMessages((m) => [...m, { role: 'assistant', content: content || '(пусто)' }])
    } catch (e) {
      toast.error(e.message)
      setMessages((m) => [...m, { role: 'assistant', content: `⚠ ${e.message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <PixelFrame className="flex flex-col px-4 py-5 sm:px-5" >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-sm uppercase tracking-label text-gold">Тест-чат · Теос</h2>
        <div className="flex items-center gap-2">
          {lore && <span className="chip">лор подключён</span>}
          <PixelButton variant="ghost" className="!px-2.5 !py-1.5 !text-[10px]" onClick={() => setMessages([])}>
            Очистить
          </PixelButton>
        </div>
      </div>
      <p className="mb-3 text-xs text-faint">
        Системный промпт = «Персона Теоса» + включённый лор. Меняй персону/лор во вкладках и проверяй стиль здесь.
      </p>

      <div className="mb-3 flex max-h-[46vh] min-h-[180px] flex-col gap-2.5 overflow-y-auto border-2 border-line bg-bgDeep/40 px-3 py-3">
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-muted">Напиши что-нибудь Теосу…</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'self-end border-2 border-line2 bg-surface2 text-ink'
                : 'self-start border-2 border-gold/50 bg-gold/10 text-ink'
            }`}>
              <span className="label mb-1 block">{m.role === 'user' ? 'Носитель' : 'Теос'}</span>
              <span className="whitespace-pre-wrap">{m.content}</span>
            </div>
          ))
        )}
        {busy && <div className="self-start"><Spinner /></div>}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          rows={2}
          placeholder="Сообщение Теосу (Enter — отправить)…"
          className="field flex-1 !text-sm"
        />
        <PixelButton onClick={send} disabled={busy || !input.trim()}>→</PixelButton>
      </div>
    </PixelFrame>
  )
}

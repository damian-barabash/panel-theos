import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logAction, aiChat, listPlayers, playerContext } from '../lib/api'
import {
  buildContext, buildLoreBlock, buildAdvisorPrompt, jsonGeneratorSystem,
  extractJsonObject, ADVISOR_TURN_SCHEMA, classTitle,
} from '../lib/advisorPrompt'
import { PixelFrame, PixelButton, Spinner, useToast } from '../components/ui'

const CAT_LABEL = { persona: 'Персона', advisor: 'Советник', planner: 'Планер', general: 'Общее' }

export default function PromptMaster() {
  const [prompts, setPrompts] = useState(null)
  const [active, setActive] = useState(null) // prompt key | 'lore'

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('ai_prompts')
      .select('*')
      .order('sort', { ascending: true })
    setPrompts(data ?? [])
    setActive((cur) => cur ?? (data && data[0] ? data[0].key : 'lore'))
  }, [])

  useEffect(() => { load() }, [load])

  if (prompts === null) {
    return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
  }

  const activePrompt = prompts.find((p) => p.key === active)

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <h1 className="pixel-title mb-4 text-sm xs:text-base">ПРОМТ-МАСТЕР</h1>

      {/* sub-tabs — prompt keys (scroll) + lore as a separate button apart */}
      <div className="mb-5 flex items-stretch gap-2">
        <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1">
          {prompts.map((p) => (
            <SubTab key={p.key} active={active === p.key} onClick={() => setActive(p.key)}>
              {p.title}
            </SubTab>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-l-2 border-line pl-2">
          <SubTab active={active === 'lore'} onClick={() => setActive('lore')} accent="crystal">
            История мира
          </SubTab>
        </div>
      </div>

      {active === 'lore' ? (
        <LoreManager />
      ) : activePrompt ? (
        <PromptEditor key={activePrompt.key} prompt={activePrompt} onSaved={load} />
      ) : null}

      {/* Test-chat — always docked at the bottom of the page, below the editor.
          Lets you tweak a prompt above and immediately test the result here,
          for any player, reproducing the exact in-game advisor request. */}
      <div className="mt-7 border-t-2 border-line pt-6">
        <TestChat prompts={prompts} />
      </div>
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
// Two modes:
//  • no player  → free-form style probe (persona + lore as the system prompt).
//  • a player   → reproduces the EXACT in-game advisor request: it pulls that
//    player's class/stats/tasks/history (panel-player) and assembles the same
//    `advisor_instructions` prompt + JSON schema the app sends, so Theos sounds
//    identical here and in the game. Switch players to compare classes.
function TestChat({ prompts }) {
  const toast = useToast()
  const byKey = useMemo(
    () => Object.fromEntries(prompts.map((p) => [p.key, p])),
    [prompts])
  const get = useCallback((key) => byKey[key]?.content ?? '', [byKey])

  const [loreBlock, setLoreBlock] = useState('')
  const [players, setPlayers] = useState(null)
  const [playerId, setPlayerId] = useState('') // '' = no player (pure persona)
  const [ctx, setCtx] = useState(null) // { profile, tasks }
  const [ctxLoading, setCtxLoading] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [messages, setMessages] = useState([]) // { role: 'user'|'theos', content, note? }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  // Lore — same enabled rows, same block format the game reads.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('world_lore')
        .select('title, body, enabled, sort')
        .order('sort', { ascending: true })
      setLoreBlock(buildLoreBlock(data ?? []))
    })()
  }, [])

  // Player roster for the picker.
  useEffect(() => {
    (async () => {
      try {
        const { players } = await listPlayers()
        setPlayers(players ?? [])
      } catch (e) {
        setPlayers([])
        toast.error(e.message)
      }
    })()
  }, []) // eslint-disable-line

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, busy])

  async function selectPlayer(id) {
    setPlayerId(id)
    setMessages([])
    setCtx(null)
    if (!id) return
    setCtxLoading(true)
    try {
      const { profile, tasks, history } = await playerContext(id)
      setCtx({ profile, tasks })
      // Seed the visible chat with the player's real advisor history so the
      // tone snowballs from the same place it does in the game.
      setMessages((history ?? []).map((h) => ({
        role: h.role === 'user' ? 'user' : 'theos',
        content: h.text,
      })))
    } catch (e) {
      toast.error(e.message)
      setPlayerId('')
    } finally {
      setCtxLoading(false)
    }
  }

  const pureMode = !playerId
  const contextText = ctx ? buildContext(ctx.profile, ctx.tasks) : ''

  async function send() {
    const text = input.trim()
    if (!text || busy || ctxLoading) return
    setInput('')
    setBusy(true)

    // History (for the model) is everything said so far, BEFORE this message —
    // exactly how the game captures it.
    const history = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))
    setMessages((m) => [...m, { role: 'user', content: text }])

    try {
      if (pureMode) {
        const system = `${get('theos_persona')}${loreBlock}\n\nОтвечай живой репликой в роли Теоса — без JSON, без markdown. Это тестовый чат для проверки стиля.`
        const payload = [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: text },
        ]
        const temp = Number(byKey['theos_persona']?.temperature) || 0.85
        const { content } = await aiChat({ messages: payload, temperature: temp })
        setMessages((m) => [...m, { role: 'theos', content: content || '(пусто)' }])
      } else {
        const userPrompt = buildAdvisorPrompt({
          get,
          loreBlock,
          context: buildContext(ctx.profile, ctx.tasks),
          history,
          mode: 'reply',
          userMessage: text,
        })
        const system = jsonGeneratorSystem(ADVISOR_TURN_SCHEMA)
        const temp = Number(byKey['advisor_instructions']?.temperature) || 0.85
        const { content } = await aiChat({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt },
          ],
          temperature: temp,
        })
        let msg, note
        try {
          const obj = extractJsonObject(content)
          msg = (obj.message || '').trim() || 'Я слушаю тебя, носитель.'
          const t = obj.task || {}
          const hasTask = String(t.title || '').trim() || String(t.plain_text || '').trim()
          if (obj.create_task === true && hasTask) {
            note = `предложил задание: «${String(t.title || t.plain_text).trim()}»${t.is_negative ? ' · порок' : ''}`
          }
        } catch (_) {
          msg = `⚠ JSON не распарсился. Сырой ответ модели:\n${content}`
        }
        setMessages((m) => [...m, { role: 'theos', content: msg, note }])
      }
    } catch (e) {
      toast.error(e.message)
      setMessages((m) => [...m, { role: 'theos', content: `⚠ ${e.message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <PixelFrame className="flex flex-col px-4 py-5 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-sm uppercase tracking-label text-gold">Тест-чат · Теос</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${pureMode ? '' : 'border-crystal/60 text-crystal'}`}>
            {pureMode ? 'чистая персона' : 'режим игры'}
          </span>
          {loreBlock && <span className="chip">лор подключён</span>}
          <PixelButton
            variant="ghost"
            className="!px-2.5 !py-1.5 !text-[10px]"
            onClick={() => (playerId ? selectPlayer(playerId) : setMessages([]))}
          >
            {playerId ? 'Сброс' : 'Очистить'}
          </PixelButton>
        </div>
      </div>

      {/* Player picker */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="label">Тестировать за:</span>
        <select
          value={playerId}
          onChange={(e) => selectPlayer(e.target.value)}
          className="field !w-auto !py-1.5 !text-xs"
          disabled={players === null || ctxLoading}
        >
          <option value="">— без игрока (чистая персона) —</option>
          {(players ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {classTitle(p.character_class)} · ур.{p.level}
            </option>
          ))}
        </select>
        {ctxLoading && <Spinner />}
        {ctx && (
          <button
            className="label text-crystal hover:text-ink"
            onClick={() => setShowContext((v) => !v)}
          >
            контекст {showContext ? '▴' : '▾'}
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-faint">
        {pureMode
          ? 'Без игрока: системный промпт = «Персона» + включённый лор, свободный ответ — для быстрой проверки стиля.'
          : 'С игроком: собирается точно тот же запрос, что шлёт игра (персона + лор + контекст игрока + история + правила + JSON-схема). Так Теос звучит как в приложении.'}
      </p>

      {showContext && ctx && (
        <pre className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap border-2 border-crystal/40 bg-bgDeep/40 px-3 py-2 font-mono text-[11px] text-muted">
          {contextText}
        </pre>
      )}

      <div
        ref={scrollRef}
        className="mb-3 flex max-h-[46vh] min-h-[180px] flex-col gap-2.5 overflow-y-auto border-2 border-line bg-bgDeep/40 px-3 py-3"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-muted">
            {pureMode ? 'Напиши что-нибудь Теосу…' : 'История игрока подтянута. Продолжи диалог за него.'}
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'self-end border-2 border-line2 bg-surface2 text-ink'
                : 'self-start border-2 border-gold/50 bg-gold/10 text-ink'
            }`}>
              <span className="label mb-1 block">{m.role === 'user' ? 'Носитель' : 'Теос'}</span>
              <span className="whitespace-pre-wrap">{m.content}</span>
              {m.note && (
                <span className="mt-1.5 block border-t border-gold/20 pt-1.5 text-[11px] text-crystal">
                  ⚑ {m.note}
                </span>
              )}
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
          disabled={ctxLoading}
        />
        <PixelButton onClick={send} disabled={busy || ctxLoading || !input.trim()}>→</PixelButton>
      </div>
    </PixelFrame>
  )
}

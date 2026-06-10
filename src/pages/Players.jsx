import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  adminDashboard, adminListPlayers, adminPlayerDetail,
  adminUpdateProfile, adminGiveItem, adminRemoveItem, adminSetStack,
  adminSetPassword, adminDeletePlayer,
} from '../lib/api'
import { PixelFrame, PixelButton, Spinner, useToast } from '../components/ui'
import { ITEMS, FISTS, itemByKey, rarityOf, CLASS_LABEL } from '../lib/itemCatalog'

// ── helpers ──────────────────────────────────────────────────────────────────
function relTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} дн назад`
  return new Date(iso).toLocaleDateString('ru-RU')
}
const classLabel = (c) => CLASS_LABEL[c] ?? c

// ─────────────────────────────────────────────────────────────────────────────
export default function Players() {
  const toast = useToast()
  const [dash, setDash] = useState(null)
  const [players, setPlayers] = useState(null)
  const [selected, setSelected] = useState(null) // user_id
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('updated_at')
  // reference data for resolving stack/pet names (anon-readable game tables)
  const [petFood, setPetFood] = useState([])
  const [petSpecies, setPetSpecies] = useState([])

  const loadAll = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([adminDashboard(), adminListPlayers()])
      setDash(d)
      setPlayers(l.players ?? [])
    } catch (e) { toast.error(e.message); setPlayers([]) }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: s }] = await Promise.all([
        supabase.from('pet_food').select('id, name, quality').order('created_at'),
        supabase.from('pet_species').select('id, name, rarity'),
      ])
      setPetFood(f ?? [])
      setPetSpecies(s ?? [])
    })()
  }, [])

  const shown = useMemo(() => {
    let list = players ?? []
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((p) => (p.name ?? '').toLowerCase().includes(q) || (p.login ?? '').toLowerCase().includes(q))
    const sorters = {
      updated_at: (a, b) => new Date(b.updated_at ?? 0) - new Date(a.updated_at ?? 0),
      gold: (a, b) => (b.gold ?? 0) - (a.gold ?? 0),
      gems: (a, b) => (b.gems ?? 0) - (a.gems ?? 0),
      level: (a, b) => (b.level ?? 0) - (a.level ?? 0),
      name: (a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ru'),
    }
    return [...list].sort(sorters[sortKey] ?? sorters.updated_at)
  }, [players, query, sortKey])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="pixel-title text-sm xs:text-base">ИГРОКИ</h1>
        <PixelButton variant="ghost" onClick={loadAll}>Обновить</PixelButton>
      </div>

      <Dashboard dash={dash} />

      {players === null ? (
        <div className="flex items-center gap-2 text-muted"><Spinner /> Загрузка игроков…</div>
      ) : players.length === 0 ? (
        <p className="text-muted">Игроков пока нет.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 xs:flex-row xs:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени или логину…"
              className="min-w-0 flex-1 rounded-none border-2 border-line bg-surface2 px-3 py-1.5 text-sm text-ink outline-none focus:border-gold"
            />
            <div className="flex items-center gap-2">
              <span className="label text-faint">сорт.</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="rounded-none border-2 border-line bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-gold"
              >
                <option value="updated_at">по активности</option>
                <option value="gold">по золоту</option>
                <option value="gems">по кристаллам</option>
                <option value="level">по уровню</option>
                <option value="name">по имени</option>
              </select>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="text-muted">Ничего не найдено.</p>
          ) : (
            <PlayerList players={shown} onPick={setSelected} />
          )}
        </>
      )}

      {selected && (
        <PlayerDetail
          userId={selected}
          petFood={petFood}
          petSpecies={petSpecies}
          onClose={() => setSelected(null)}
          onMutated={loadAll}
          onDeleted={() => { setSelected(null); loadAll() }}
        />
      )}
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ dash }) {
  const cards = [
    { label: 'Игроков', value: dash?.totalPlayers, accent: 'text-ink' },
    { label: 'Активных · 7дн', value: dash?.active7d, accent: 'text-ok' },
    { label: 'Новых · 7дн', value: dash?.new7d, accent: 'text-crystal' },
    { label: 'В работе', value: dash?.pendingTasks, accent: 'text-warn' },
    { label: 'Готово сегодня', value: dash?.doneToday, accent: 'text-ok' },
    { label: 'Всего золота', value: dash?.totalGold, accent: 'text-gold' },
    { label: 'Всего кристаллов', value: dash?.totalGems, accent: 'text-crystal' },
    { label: 'Питомцев', value: dash?.totalPets, accent: 'text-ink' },
  ]
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cards.map((c) => (
        <PixelFrame key={c.label} className="px-3 py-2.5">
          <div className="label text-faint">{c.label}</div>
          <div className={`mt-1 font-pixel text-base ${c.accent}`}>
            {dash == null ? '·' : (c.value ?? 0).toLocaleString('ru-RU')}
          </div>
        </PixelFrame>
      ))}
    </div>
  )
}

// ── Player list ──────────────────────────────────────────────────────────────
function PlayerList({ players, onPick }) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className="pixel-frame flex items-center gap-3 px-3 py-2.5 text-left transition hover:border-gold"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-pixel text-xs text-ink">{p.name}</span>
              <span className="label text-faint">{classLabel(p.character_class)}</span>
            </div>
            <div className="mt-0.5 text-xs text-muted">
              Lv {p.level} · {p._pending} в работе · {p._done} готово · {p._items} вещей · {p._pets} пит.
            </div>
          </div>
          <div className="shrink-0 text-right text-xs">
            <div className="text-gold">{(p.gold ?? 0).toLocaleString('ru-RU')} <span className="text-faint">зол</span></div>
            <div className="text-crystal">{(p.gems ?? 0).toLocaleString('ru-RU')} <span className="text-faint">крист</span></div>
          </div>
          <div className="hidden shrink-0 text-right text-[11px] text-faint sm:block w-24">{relTime(p.updated_at)}</div>
        </button>
      ))}
    </div>
  )
}

// ── Player detail (modal) ────────────────────────────────────────────────────
const STAT_FIELDS = [
  { key: 'gold', label: 'Золото', accent: 'text-gold' },
  { key: 'gems', label: 'Кристаллы', accent: 'text-crystal' },
  { key: 'level', label: 'Уровень', accent: 'text-ink' },
  { key: 'xp_current', label: 'Опыт (тек.)', accent: 'text-ink' },
  { key: 'strength', label: 'Сила', accent: 'text-danger' },
  { key: 'intellect', label: 'Интеллект', accent: 'text-crystalDeep' },
  { key: 'agility', label: 'Ловкость', accent: 'text-ok' },
  { key: 'stamina', label: 'Выносливость', accent: 'text-warn' },
]

function PlayerDetail({ userId, petFood, petSpecies, onClose, onMutated, onDeleted }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [logs, setLogs] = useState(null)
  const [pwd, setPwd] = useState('')
  const [delConfirm, setDelConfirm] = useState('')

  const foodById = useMemo(() => Object.fromEntries(petFood.map((f) => [f.id, f])), [petFood])
  const speciesById = useMemo(() => Object.fromEntries(petSpecies.map((s) => [s.id, s])), [petSpecies])

  const loadLogs = useCallback(async () => {
    // panel_logs is admin-readable directly (no edge function needed)
    const { data: rows } = await supabase
      .from('panel_logs')
      .select('action, summary, created_at, actor_email')
      .eq('entity', 'player')
      .eq('entity_key', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs(rows ?? [])
  }, [userId])

  const load = useCallback(async () => {
    try {
      const d = await adminPlayerDetail(userId)
      setData(d)
      const f = {}
      for (const s of STAT_FIELDS) f[s.key] = d.profile[s.key] ?? 0
      setForm(f)
    } catch (e) { toast.error(e.message) }
  }, [userId, toast])
  useEffect(() => { load(); loadLogs() }, [load, loadLogs])

  const dirty = data && STAT_FIELDS.some((s) => Number(form[s.key]) !== (data.profile[s.key] ?? 0))

  async function saveStats() {
    setBusy(true)
    try {
      const patch = {}
      for (const s of STAT_FIELDS) patch[s.key] = Number(form[s.key])
      const r = await adminUpdateProfile(userId, patch)
      setData((d) => ({ ...d, profile: r.profile }))
      toast.ok('Сохранено')
      onMutated?.()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function giveItem(key) {
    if (!key) return
    setBusy(true)
    try { const r = await adminGiveItem(userId, key); toast[r.already ? 'info' : 'ok'](r.already ? 'Уже есть' : 'Выдано'); await load(); onMutated?.() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function removeItem(key) {
    setBusy(true)
    try { await adminRemoveItem(userId, key); toast.ok('Забрано'); await load(); onMutated?.() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function setStack(item_type, item_ref, quantity) {
    setBusy(true)
    try { await adminSetStack(userId, item_type, item_ref, Math.max(0, quantity)); await load() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  // delta = number to add (negative ok); null = reset to 0
  async function bumpCurrency(field, delta) {
    setBusy(true)
    try {
      const cur = data.profile[field] ?? 0
      const next = delta == null ? 0 : Math.max(0, cur + delta)
      const r = await adminUpdateProfile(userId, { [field]: next })
      setData((d) => ({ ...d, profile: r.profile }))
      setForm((f) => ({ ...f, [field]: r.profile[field] }))
      await loadLogs(); onMutated?.()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function changePassword() {
    if (pwd.trim().length < 6) { toast.error('Пароль ≥ 6 символов'); return }
    setBusy(true)
    try { await adminSetPassword(userId, pwd.trim()); setPwd(''); toast.ok('Пароль изменён'); await loadLogs() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function deletePlayer() {
    setBusy(true)
    try { await adminDeletePlayer(userId); toast.ok('Игрок удалён'); onDeleted?.() }
    catch (e) { toast.error(e.message); setBusy(false) }
  }

  const p = data?.profile
  const delMatch = data && delConfirm.trim() === (p?.name ?? '')

  return (
    <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-bgDeep/80 p-3 sm:p-6" onClick={onClose}>
      <div className="my-auto w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <PixelFrame purple className="relative px-4 py-4 sm:px-6 sm:py-5">
          <button onClick={onClose} className="absolute right-3 top-3 text-muted hover:text-ink">✕</button>

          {!data ? (
            <div className="flex items-center gap-2 py-8 text-muted"><Spinner /> Загрузка…</div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* header */}
              <div>
                <h2 className="pixel-title text-sm">{p.name}</h2>
                <div className="mt-1 text-xs text-muted">
                  {classLabel(p.character_class)} · Lv {p.level} · логин: {p.login ?? '—'} · сообщений Теосу: {data.msgCount}
                </div>
                <div className="mt-0.5 text-[11px] text-faint">
                  создан {relTime(p.created_at)} · активность {relTime(p.updated_at)} · серия {p.streak_day ?? 0} дн
                </div>
              </div>

              {/* editable stats / currency */}
              <section>
                <div className="label mb-2 text-faint">Статы и валюта</div>
                <div className="grid grid-cols-2 gap-2 xs:grid-cols-4">
                  {STAT_FIELDS.map((s) => (
                    <label key={s.key} className="flex flex-col gap-1">
                      <span className={`label ${s.accent}`}>{s.label}</span>
                      <input
                        type="number"
                        value={form[s.key] ?? 0}
                        onChange={(e) => setForm((f) => ({ ...f, [s.key]: e.target.value }))}
                        className="w-full rounded-none border-2 border-line bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-gold"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="label text-gold">золото</span>
                  <button disabled={busy} onClick={() => bumpCurrency('gold', 1000)} className="border-2 border-line px-2 py-1 text-xs text-gold hover:border-gold disabled:opacity-40">+1000</button>
                  <button disabled={busy} onClick={() => bumpCurrency('gold', 100)} className="border-2 border-line px-2 py-1 text-xs text-gold hover:border-gold disabled:opacity-40">+100</button>
                  <button disabled={busy} onClick={() => bumpCurrency('gold', null)} className="border-2 border-line px-2 py-1 text-xs text-muted hover:border-gold disabled:opacity-40">0</button>
                  <span className="label ml-2 text-crystal">кристаллы</span>
                  <button disabled={busy} onClick={() => bumpCurrency('gems', 100)} className="border-2 border-line px-2 py-1 text-xs text-crystal hover:border-gold disabled:opacity-40">+100</button>
                  <button disabled={busy} onClick={() => bumpCurrency('gems', 10)} className="border-2 border-line px-2 py-1 text-xs text-crystal hover:border-gold disabled:opacity-40">+10</button>
                  <button disabled={busy} onClick={() => bumpCurrency('gems', null)} className="border-2 border-line px-2 py-1 text-xs text-muted hover:border-gold disabled:opacity-40">0</button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <PixelButton onClick={saveStats} disabled={!dirty || busy}>
                    {busy ? <Spinner /> : 'Сохранить'}
                  </PixelButton>
                  {dirty && <span className="text-xs text-warn">есть несохранённые изменения</span>}
                </div>
              </section>

              {/* inventory (weapons/potions) */}
              <section>
                <div className="label mb-2 text-faint">Инвентарь · оружие и зелья</div>
                <GiveItemBar onGive={giveItem} disabled={busy} owned={new Set(data.inventory.map((i) => i.item_key))} />
                {data.inventory.length === 0 ? (
                  <p className="mt-2 text-xs text-faint">Пусто.</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {data.inventory.map((row) => {
                      const it = itemByKey(row.item_key)
                      const r = rarityOf(it.rarity)
                      const equipped = p.equipped_weapon === row.item_key || p.equipped_potion === row.item_key
                      return (
                        <div key={row.id} className="flex items-center gap-2 border-2 border-line bg-surface px-2.5 py-1.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{it.name}</span>
                          {equipped && <span className="label text-ok">надето</span>}
                          <span className="label text-faint">{it.kind === 'potion' ? 'зелье' : 'оружие'}</span>
                          <button onClick={() => removeItem(row.item_key)} disabled={busy}
                            className="text-xs text-danger hover:underline">Забрать</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* stacks: eggs + food */}
              <section>
                <div className="label mb-2 text-faint">Расходники · яйца и еда</div>
                <StacksEditor
                  stacks={data.stacks} petFood={petFood} foodById={foodById}
                  onSet={setStack} disabled={busy}
                />
              </section>

              {/* pets */}
              {data.pets.length > 0 && (
                <section>
                  <div className="label mb-2 text-faint">Питомцы</div>
                  <div className="flex flex-col gap-1.5">
                    {data.pets.map((pet) => {
                      const sp = pet.species ?? speciesById[pet.species_id]
                      const active = p.active_pet_id === pet.id
                      return (
                        <div key={pet.id} className="flex items-center gap-2 border-2 border-line bg-surface px-2.5 py-1.5 text-sm">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: rarityOf(sp?.rarity).color }} />
                          <span className="flex-1 truncate text-ink">{sp?.name ?? '—'}</span>
                          {active && <span className="label text-ok">активный</span>}
                          <span className="text-faint">Lv {pet.level} · {pet.xp} xp</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* recent tasks */}
              <section>
                <div className="label mb-2 text-faint">Последние задания ({data.tasks.length})</div>
                {data.tasks.length === 0 ? (
                  <p className="text-xs text-faint">Нет заданий.</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto flex flex-col gap-1">
                    {data.tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <span className={`label w-16 shrink-0 ${
                          t.status === 'done' ? 'text-ok' : t.status === 'pending' ? 'text-warn' : 'text-faint'
                        }`}>{t.status}</span>
                        <span className="min-w-0 flex-1 truncate text-muted">{t.title}</span>
                        <span className="shrink-0 text-faint">{t.source}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* audit: panel_logs for this player */}
              <section>
                <div className="label mb-2 text-faint">История изменений ({logs?.length ?? 0})</div>
                {logs == null ? (
                  <div className="flex items-center gap-2 text-xs text-faint"><Spinner /> …</div>
                ) : logs.length === 0 ? (
                  <p className="text-xs text-faint">Изменений из панели не было.</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto flex flex-col gap-1">
                    {logs.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-28 shrink-0 text-faint">{relTime(l.created_at)}</span>
                        <span className="min-w-0 flex-1 truncate text-muted">{l.summary ?? l.action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* account: password + delete (danger) */}
              <section className="border-t-2 border-line pt-4">
                <div className="label mb-2 text-danger">Аккаунт</div>
                <div className="flex flex-col gap-2 xs:flex-row xs:items-center">
                  <input
                    type="text"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="Новый пароль (≥ 6)"
                    className="min-w-0 flex-1 rounded-none border-2 border-line bg-surface2 px-3 py-1.5 text-sm text-ink outline-none focus:border-gold"
                  />
                  <PixelButton variant="ghost" disabled={busy || pwd.trim().length < 6} onClick={changePassword}>
                    Сменить пароль
                  </PixelButton>
                </div>
                <div className="mt-3 border-2 border-danger/60 bg-danger/5 px-3 py-2.5">
                  <div className="text-xs text-muted">
                    Удаление безвозвратно сотрёт аккаунт и все данные игрока (профиль, задания,
                    инвентарь, питомцы, чат). Впиши имя <span className="text-ink">«{p.name}»</span> для подтверждения.
                  </div>
                  <div className="mt-2 flex flex-col gap-2 xs:flex-row xs:items-center">
                    <input
                      value={delConfirm}
                      onChange={(e) => setDelConfirm(e.target.value)}
                      placeholder="Имя игрока"
                      className="min-w-0 flex-1 rounded-none border-2 border-line bg-surface2 px-3 py-1.5 text-sm text-ink outline-none focus:border-danger"
                    />
                    <PixelButton variant="danger" disabled={busy || !delMatch} onClick={deletePlayer}>
                      {busy ? <Spinner /> : 'Удалить игрока'}
                    </PixelButton>
                  </div>
                </div>
              </section>
            </div>
          )}
        </PixelFrame>
      </div>
    </div>
  )
}

// ── Give item selector ───────────────────────────────────────────────────────
function GiveItemBar({ onGive, disabled, owned }) {
  const [key, setKey] = useState('')
  const weapons = ITEMS.filter((i) => i.kind === 'weapon')
  const potions = ITEMS.filter((i) => i.kind === 'potion')
  return (
    <div className="flex gap-2">
      <select
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="min-w-0 flex-1 rounded-none border-2 border-line bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-gold"
      >
        <option value="">Выдать предмет…</option>
        <optgroup label="Оружие">
          {weapons.map((i) => (
            <option key={i.key} value={i.key} disabled={owned.has(i.key)}>
              {i.name} · {rarityOf(i.rarity).label}{owned.has(i.key) ? ' (есть)' : ''}
            </option>
          ))}
        </optgroup>
        <optgroup label="Зелья">
          {potions.map((i) => (
            <option key={i.key} value={i.key} disabled={owned.has(i.key)}>
              {i.name} · {rarityOf(i.rarity).label}{owned.has(i.key) ? ' (есть)' : ''}
            </option>
          ))}
        </optgroup>
      </select>
      <PixelButton variant="crystal" disabled={!key || disabled} onClick={() => { onGive(key); setKey('') }}>
        Выдать
      </PixelButton>
    </div>
  )
}

// ── Stacks editor (eggs + food) ──────────────────────────────────────────────
function StacksEditor({ stacks, petFood, foodById, onSet, disabled }) {
  const eggStack = stacks.find((s) => s.item_type === 'egg' && s.item_ref === 'egg')
  const eggQty = eggStack?.quantity ?? 0
  const foodStacks = stacks.filter((s) => s.item_type === 'food')
  const [addFood, setAddFood] = useState('')

  const StackRow = ({ label, color, qty, onChange }) => (
    <div className="flex items-center gap-2 border-2 border-line bg-surface px-2.5 py-1.5 text-sm">
      {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="min-w-0 flex-1 truncate text-ink">{label}</span>
      <button disabled={disabled || qty <= 0} onClick={() => onChange(qty - 1)} className="px-2 text-gold disabled:opacity-30">−</button>
      <span className="w-8 text-center text-ink">{qty}</span>
      <button disabled={disabled} onClick={() => onChange(qty + 1)} className="px-2 text-gold">+</button>
    </div>
  )

  const qualityColor = (q) => q === 'legendary' ? '#E8B547' : q === 'normal' ? '#5AB8D6' : '#B8C2C0'
  const ownedFoodIds = new Set(foodStacks.map((s) => s.item_ref))
  const addable = petFood.filter((f) => !ownedFoodIds.has(f.id))

  return (
    <div className="flex flex-col gap-1.5">
      <StackRow label="Яйцо" color="#9B6BFF" qty={eggQty} onChange={(q) => onSet('egg', 'egg', q)} />
      {foodStacks.map((s) => {
        const f = foodById[s.item_ref]
        return (
          <StackRow key={s.id} label={`Еда · ${f?.name ?? s.item_ref}`} color={qualityColor(f?.quality)}
            qty={s.quantity} onChange={(q) => onSet('food', s.item_ref, q)} />
        )
      })}
      {addable.length > 0 && (
        <div className="flex gap-2">
          <select value={addFood} onChange={(e) => setAddFood(e.target.value)}
            className="min-w-0 flex-1 rounded-none border-2 border-line bg-surface2 px-2 py-1.5 text-sm text-ink outline-none focus:border-gold">
            <option value="">Добавить еду…</option>
            {addable.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <PixelButton variant="crystal" disabled={!addFood || disabled}
            onClick={() => { onSet('food', addFood, 1); setAddFood('') }}>+1</PixelButton>
        </div>
      )}
    </div>
  )
}

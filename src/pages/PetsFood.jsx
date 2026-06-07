import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/api'
import { PixelFrame, PixelButton, Spinner, useToast } from '../components/ui'

// ── Shared constants ─────────────────────────────────────────────────────────
const QUALITIES = [
  { key: 'low', label: 'Некачественная', weight: 60, color: '#B8C2C0' },
  { key: 'normal', label: 'Качественная', weight: 30, color: '#5AB8D6' },
  { key: 'legendary', label: 'Легендарная', weight: 10, color: '#E8B547' },
]
const qualityOf = (k) => QUALITIES.find((q) => q.key === k) ?? QUALITIES[1]

const RARITIES = [
  { key: 'common', label: 'Обычный', weight: 100, color: '#B8C2C0' },
  { key: 'uncommon', label: 'Необычный', weight: 60, color: '#7BD389' },
  { key: 'rare', label: 'Редкий', weight: 30, color: '#5AB8D6' },
  { key: 'epic', label: 'Эпический', weight: 12, color: '#9B6BFF' },
  { key: 'legendary', label: 'Легендарный', weight: 4, color: '#E8B547' },
  { key: 'mythic', label: 'Мифический', weight: 1, color: '#E25C5C' },
]
const rarityOf = (k) => RARITIES.find((r) => r.key === k) ?? RARITIES[0]

const FOOD_IMG_HINT = '40 × 40 px, PNG'
const PET_IMG_HINT = '120 × 40 px (3 кадра по 40×40), PNG'

export default function PetsFood() {
  const [tab, setTab] = useState('food')
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="pixel-title mb-2 text-sm xs:text-base">ЖИВОТНЫЕ И ЕДА</h1>
      <p className="mb-4 text-sm text-muted">
        Добавляй питомцев и еду — игра докачает их сама (без пересборки). Новая
        еда автоматически попадает в золотой сундук.
      </p>
      <div className="mb-5 flex gap-2">
        <PixelButton
          variant={tab === 'food' ? 'gold' : 'ghost'}
          onClick={() => setTab('food')}
        >
          Еда
        </PixelButton>
        <PixelButton
          variant={tab === 'pets' ? 'gold' : 'ghost'}
          onClick={() => setTab('pets')}
        >
          Питомцы
        </PixelButton>
      </div>
      {tab === 'food' ? <FoodSection /> : <PetSection />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOD
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_FOOD = { id: null, name: '', quality: 'normal', xp_value: 10, image_url: '', enabled: true }

function FoodSection() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(EMPTY_FOOD)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pet_food')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) { toast.error(error.message); setRows([]); return }
    setRows(data ?? [])
  }, [toast])
  useEffect(() => { load() }, [load])

  // Chest drop% of one food = P(pick its quality) * (1 / foods in that quality).
  function dropPct(food) {
    const enabled = (rows ?? []).filter((r) => r.enabled)
    const presentQ = new Set(enabled.map((r) => r.quality))
    const totalW = [...presentQ].reduce((s, q) => s + qualityOf(q).weight, 0)
    if (totalW === 0 || !food.enabled) return 0
    const inQ = enabled.filter((r) => r.quality === food.quality).length || 1
    return (qualityOf(food.quality).weight / totalW) * (1 / inQ) * 100
  }

  async function onPickImage(file) {
    if (!file) return
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `food-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('pet-food')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('pet-food').getPublicUrl(path)
      setForm((f) => ({ ...f, image_url: data.publicUrl }))
      toast.ok('Картинка загружена')
    } catch (e) {
      toast.error(e.message || 'Не удалось загрузить')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Введи название'); return }
    setSaving(true)
    try {
      const row = {
        name: form.name.trim(),
        quality: form.quality,
        xp_value: parseInt(form.xp_value, 10) || 0,
        image_url: form.image_url || null,
        enabled: form.enabled,
        updated_at: new Date().toISOString(),
      }
      let err
      if (form.id) {
        ({ error: err } = await supabase.from('pet_food').update(row).eq('id', form.id))
      } else {
        ({ error: err } = await supabase.from('pet_food').insert(row))
      }
      if (err) throw err
      await logAction({ action: 'food.save', entity: 'pet_food', entity_key: form.id ?? 'new', summary: `Еда «${row.name}» (${row.quality}, +${row.xp_value} xp)` })
      toast.ok('Сохранено')
      setForm(EMPTY_FOOD)
      await load()
    } catch (e) {
      toast.error(e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!form.id || !window.confirm(`Удалить «${form.name}»?`)) return
    setSaving(true)
    try {
      const { error } = await supabase.from('pet_food').delete().eq('id', form.id)
      if (error) throw error
      await logAction({ action: 'food.delete', entity: 'pet_food', entity_key: form.id, summary: `Удалена еда «${form.name}»` })
      toast.ok('Удалено')
      setForm(EMPTY_FOOD)
      await load()
    } catch (e) {
      toast.error(e.message || 'Ошибка удаления')
    } finally {
      setSaving(false)
    }
  }

  if (!rows) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>

  return (
    <>
      <div className="mb-5 flex flex-col gap-2">
        {rows.length === 0 && <p className="text-sm text-faint">Пока нет еды.</p>}
        {rows.map((r) => (
          <button key={r.id} onClick={() => setForm({ ...EMPTY_FOOD, ...r })}
            className={`pixel-frame flex items-center gap-3 px-4 py-2.5 text-left ${form.id === r.id ? 'border-gold' : ''}`}>
            {r.image_url
              ? <img src={r.image_url} alt="" width={32} height={32} style={{ imageRendering: 'pixelated' }} />
              : <span className="h-8 w-8 rounded bg-bgDeep" />}
            <span className="flex-1 truncate text-sm text-ink">{r.name || '—'}</span>
            <span className="label" style={{ color: qualityOf(r.quality).color }}>{qualityOf(r.quality).label}</span>
            <span className="label text-gold">+{r.xp_value}xp</span>
            <span className="label text-faint">{dropPct(r).toFixed(1)}%</span>
            {!r.enabled && <span className="label text-faint">выкл</span>}
          </button>
        ))}
        <div><PixelButton variant="ghost" onClick={() => setForm(EMPTY_FOOD)}>+ Новая еда</PixelButton></div>
      </div>

      <PixelFrame className="flex flex-col gap-5 px-5 py-6">
        <div className="text-xs uppercase tracking-widest text-faint">
          {form.id ? 'Редактирование еды' : 'Новая еда'}
        </div>
        <div>
          <label className="label mb-2 block">Название</label>
          <input className="field" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Сочное мясо" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2 block">Качество</label>
            <select className="field" value={form.quality}
              onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))}>
              {QUALITIES.map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-faint">Чем выше качество — тем реже падает</p>
          </div>
          <div>
            <label className="label mb-2 block">Опыт питомцу</label>
            <input type="number" className="field" value={form.xp_value}
              onChange={(e) => setForm((f) => ({ ...f, xp_value: e.target.value }))} />
          </div>
        </div>
        <ImageField label="Картинка" hint={FOOD_IMG_HINT} url={form.image_url} uploading={uploading}
          fileRef={fileRef} onPick={onPickImage}
          onClear={() => setForm((f) => ({ ...f, image_url: '' }))} square />
        <EnabledToggle value={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
        <div className="flex justify-between">
          {form.id ? <PixelButton variant="danger" onClick={remove} disabled={saving}>Удалить</PixelButton> : <span />}
          <PixelButton onClick={save} disabled={saving || uploading}>
            {saving ? <Spinner className="border-bgDeep/40 border-t-bgDeep" /> : 'Сохранить'}
          </PixelButton>
        </div>
      </PixelFrame>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PETS
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_PET = {
  id: null, name: '', description: '', rarity: 'common', image_url: '',
  dmg_pct_l1: 0, dmg_pct_l20: 0, cd_pct_l1: 0, cd_pct_l20: 0,
  xp_pct_l1: 0, xp_pct_l20: 0, xp_per_level_l1: 50, xp_per_level_l20: 600,
  enabled: true, eats: [],
}
const lerp = (a, b, t) => a + (b - a) * t

function PetSection() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [foods, setFoods] = useState([])
  const [form, setForm] = useState(EMPTY_PET)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const [{ data: pets, error: e1 }, { data: f }, { data: links }] = await Promise.all([
      supabase.from('pet_species').select('*').order('created_at', { ascending: true }),
      supabase.from('pet_food').select('id, name, quality').order('created_at', { ascending: true }),
      supabase.from('pet_species_food').select('species_id, food_id'),
    ])
    if (e1) { toast.error(e1.message); setRows([]); return }
    const eatsBy = {}
    for (const l of links ?? []) (eatsBy[l.species_id] ??= []).push(l.food_id)
    setRows((pets ?? []).map((p) => ({ ...p, eats: eatsBy[p.id] ?? [] })))
    setFoods(f ?? [])
  }, [toast])
  useEffect(() => { load() }, [load])

  function dropPct(pet) {
    const enabled = (rows ?? []).filter((r) => r.enabled)
    const total = enabled.reduce((s, r) => s + rarityOf(r.rarity).weight, 0)
    if (total === 0 || !pet.enabled) return 0
    return (rarityOf(pet.rarity).weight / total) * 100
  }

  async function onPickImage(file) {
    if (!file) return
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `pet-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('pets')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('pets').getPublicUrl(path)
      setForm((f) => ({ ...f, image_url: data.publicUrl }))
      toast.ok('Картинка загружена')
    } catch (e) {
      toast.error(e.message || 'Не удалось загрузить')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function toggleEats(foodId) {
    setForm((f) => ({
      ...f,
      eats: f.eats.includes(foodId) ? f.eats.filter((x) => x !== foodId) : [...f.eats, foodId],
    }))
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Введи имя'); return }
    setSaving(true)
    try {
      const row = {
        name: form.name.trim(), description: form.description, rarity: form.rarity,
        image_url: form.image_url || null,
        dmg_pct_l1: +form.dmg_pct_l1 || 0, dmg_pct_l20: +form.dmg_pct_l20 || 0,
        cd_pct_l1: +form.cd_pct_l1 || 0, cd_pct_l20: +form.cd_pct_l20 || 0,
        xp_pct_l1: +form.xp_pct_l1 || 0, xp_pct_l20: +form.xp_pct_l20 || 0,
        xp_per_level_l1: parseInt(form.xp_per_level_l1, 10) || 50,
        xp_per_level_l20: parseInt(form.xp_per_level_l20, 10) || 600,
        enabled: form.enabled, updated_at: new Date().toISOString(),
      }
      let id = form.id
      if (id) {
        const { error } = await supabase.from('pet_species').update(row).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('pet_species').insert(row).select('id').single()
        if (error) throw error
        id = data.id
      }
      // Sync eaten-foods mapping.
      await supabase.from('pet_species_food').delete().eq('species_id', id)
      if (form.eats.length) {
        const { error } = await supabase.from('pet_species_food')
          .insert(form.eats.map((food_id) => ({ species_id: id, food_id })))
        if (error) throw error
      }
      await logAction({ action: 'pet.save', entity: 'pet_species', entity_key: id, summary: `Питомец «${row.name}» (${row.rarity})` })
      toast.ok('Сохранено')
      setForm(EMPTY_PET)
      await load()
    } catch (e) {
      toast.error(e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!form.id || !window.confirm(`Удалить «${form.name}»?`)) return
    setSaving(true)
    try {
      const { error } = await supabase.from('pet_species').delete().eq('id', form.id)
      if (error) throw error
      await logAction({ action: 'pet.delete', entity: 'pet_species', entity_key: form.id, summary: `Удалён питомец «${form.name}»` })
      toast.ok('Удалено')
      setForm(EMPTY_PET)
      await load()
    } catch (e) {
      toast.error(e.message || 'Ошибка удаления')
    } finally {
      setSaving(false)
    }
  }

  const previewLevels = [1, 10, 20]
  function statAt(l1, l20, lvl) {
    return lerp(+l1 || 0, +l20 || 0, (lvl - 1) / 19)
  }

  if (!rows) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>

  return (
    <>
      <div className="mb-5 flex flex-col gap-2">
        {rows.length === 0 && <p className="text-sm text-faint">Пока нет питомцев.</p>}
        {rows.map((r) => (
          <button key={r.id} onClick={() => setForm({ ...EMPTY_PET, ...r, eats: r.eats ?? [] })}
            className={`pixel-frame flex items-center gap-3 px-4 py-2.5 text-left ${form.id === r.id ? 'border-gold' : ''}`}>
            {r.image_url
              ? <img src={r.image_url} alt="" height={32} style={{ imageRendering: 'pixelated', objectFit: 'none', objectPosition: 'left', width: 32, overflow: 'hidden' }} />
              : <span className="h-8 w-8 rounded bg-bgDeep" />}
            <span className="flex-1 truncate text-sm text-ink">{r.name || '—'}</span>
            <span className="label" style={{ color: rarityOf(r.rarity).color }}>{rarityOf(r.rarity).label}</span>
            <span className="label text-faint">{dropPct(r).toFixed(1)}%</span>
            {!r.enabled && <span className="label text-faint">выкл</span>}
          </button>
        ))}
        <div><PixelButton variant="ghost" onClick={() => setForm(EMPTY_PET)}>+ Новый питомец</PixelButton></div>
      </div>

      <PixelFrame className="flex flex-col gap-5 px-5 py-6">
        <div className="text-xs uppercase tracking-widest text-faint">
          {form.id ? 'Редактирование питомца' : 'Новый питомец'}
        </div>
        <div>
          <label className="label mb-2 block">Имя</label>
          <input className="field" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Огненный дракончик" />
        </div>
        <div>
          <label className="label mb-2 block">Описание (RPG-флавор)</label>
          <textarea rows={2} className="field" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Древний спутник, чешуя которого хранит жар первого пламени." />
        </div>
        <div>
          <label className="label mb-2 block">Редкость</label>
          <select className="field" value={form.rarity}
            onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}>
            {RARITIES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-faint">Влияет на цвет подсветки при вылуплении и шанс выпадения</p>
        </div>
        <ImageField label="Анимация (лист 3 кадра)" hint={PET_IMG_HINT} url={form.image_url} uploading={uploading}
          fileRef={fileRef} onPick={onPickImage}
          onClear={() => setForm((f) => ({ ...f, image_url: '' }))} />

        <div>
          <label className="label mb-2 block">Бонусы — край ур.1 → ур.20 (%)</label>
          <div className="grid grid-cols-3 gap-3">
            <EdgePair label="+ урон" a={form.dmg_pct_l1} b={form.dmg_pct_l20}
              onA={(v) => setForm((f) => ({ ...f, dmg_pct_l1: v }))} onB={(v) => setForm((f) => ({ ...f, dmg_pct_l20: v }))} />
            <EdgePair label="+ перезар." a={form.cd_pct_l1} b={form.cd_pct_l20}
              onA={(v) => setForm((f) => ({ ...f, cd_pct_l1: v }))} onB={(v) => setForm((f) => ({ ...f, cd_pct_l20: v }))} />
            <EdgePair label="+ опыт" a={form.xp_pct_l1} b={form.xp_pct_l20}
              onA={(v) => setForm((f) => ({ ...f, xp_pct_l1: v }))} onB={(v) => setForm((f) => ({ ...f, xp_pct_l20: v }))} />
          </div>
        </div>
        <div>
          <label className="label mb-2 block">Опыт за уровень — край ур.1 → ур.20</label>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" className="field" value={form.xp_per_level_l1}
              onChange={(e) => setForm((f) => ({ ...f, xp_per_level_l1: e.target.value }))} placeholder="ур.1" />
            <input type="number" className="field" value={form.xp_per_level_l20}
              onChange={(e) => setForm((f) => ({ ...f, xp_per_level_l20: e.target.value }))} placeholder="ур.20" />
          </div>
        </div>

        {/* Interpolation preview */}
        <div className="rounded border border-line/60 px-3 py-2 text-xs text-faint">
          <div className="mb-1 text-ink">Превью по уровням:</div>
          {previewLevels.map((lvl) => (
            <div key={lvl}>
              ур.{lvl}: урон +{statAt(form.dmg_pct_l1, form.dmg_pct_l20, lvl).toFixed(1)}% ·
              перезар. +{statAt(form.cd_pct_l1, form.cd_pct_l20, lvl).toFixed(1)}% ·
              опыт +{statAt(form.xp_pct_l1, form.xp_pct_l20, lvl).toFixed(1)}% ·
              до след. {Math.round(statAt(form.xp_per_level_l1, form.xp_per_level_l20, lvl))}xp
            </div>
          ))}
        </div>

        <div>
          <label className="label mb-2 block">Какую еду ест</label>
          {foods.length === 0
            ? <p className="text-xs text-faint">Сначала добавь еду во вкладке «Еда».</p>
            : <div className="flex flex-col gap-1.5">
                {foods.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={form.eats.includes(f.id)} onChange={() => toggleEats(f.id)} />
                    {f.name} <span className="label text-faint">{qualityOf(f.quality).label}</span>
                  </label>
                ))}
              </div>}
        </div>

        <EnabledToggle value={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
        <div className="flex justify-between">
          {form.id ? <PixelButton variant="danger" onClick={remove} disabled={saving}>Удалить</PixelButton> : <span />}
          <PixelButton onClick={save} disabled={saving || uploading}>
            {saving ? <Spinner className="border-bgDeep/40 border-t-bgDeep" /> : 'Сохранить'}
          </PixelButton>
        </div>
      </PixelFrame>
    </>
  )
}

// ── Small shared bits ─────────────────────────────────────────────────────────
function EdgePair({ label, a, b, onA, onB }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-faint">{label}</div>
      <input type="number" className="field mb-1" value={a} onChange={(e) => onA(e.target.value)} placeholder="ур.1" />
      <input type="number" className="field" value={b} onChange={(e) => onB(e.target.value)} placeholder="ур.20" />
    </div>
  )
}

function EnabledToggle({ value, onChange }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-ink">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      Включено (видно игрокам)
    </label>
  )
}

function ImageField({ label, hint, url, uploading, fileRef, onPick, onClear, square }) {
  return (
    <div>
      <label className="label mb-2 block">{label}</label>
      {url && (
        <div className="mb-2 inline-block rounded border-2 border-line p-2" style={{ background: '#0F1A1C' }}>
          <img src={url} alt="" style={{ imageRendering: 'pixelated', height: square ? 64 : 48, width: 'auto' }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])} />
        <PixelButton variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Spinner /> : (url ? 'Заменить' : 'Загрузить')}
        </PixelButton>
        {url && <PixelButton variant="danger" onClick={onClear}>Убрать</PixelButton>}
      </div>
      <p className="mt-1.5 text-xs text-faint">Рекомендуемый размер — {hint}</p>
    </div>
  )
}

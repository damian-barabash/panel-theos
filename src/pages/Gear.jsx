import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/api'
import { PixelFrame, PixelButton, Spinner, useToast } from '../components/ui'
import {
  RARITIES, rarityOf, FRACTIONS, fractionLabel,
  ARMOR_SLOTS, ARMOR_ATTRS, ARMOR_EFFECTS,
  WEAPON_TYPES, WEAPON_ELEMENTS, WEAPON_ATTRS, STAT_KEYS,
} from '../lib/gearDefs'

// ─────────────────────────────────────────────────────────────────────────────
// «Броня и оружие»: динамические каталоги armor_sets/armor_pieces и
// weapon_items. Лист брони (160×120 = 4 направления × 3 слота по 40×40)
// режется автоматически: пустой ряд (нет шлема и т.п.) — слот не предлагается.
// Игра докачивает всё сама (ResourceStore), без пересборки APK.
// ─────────────────────────────────────────────────────────────────────────────

const ARMOR_IMG_HINT = '160 × 120 px (4 направления × 3 слота по 40×40), PNG'
const WEAPON_IMG_HINT = '40 × 40 px, PNG'

export default function Gear() {
  const [tab, setTab] = useState('armor')
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="pixel-title mb-2 text-sm xs:text-base">БРОНЯ И ОРУЖИЕ</h1>
      <p className="mb-4 text-sm text-muted">
        Закинь лист брони или иконку оружия — игра докачает сама (без
        пересборки). Отметь, где предмет продаётся: у торговца и/или в
        изумрудном сундуке.
      </p>
      <div className="mb-5 flex gap-2">
        <PixelButton variant={tab === 'armor' ? 'gold' : 'ghost'} onClick={() => setTab('armor')}>
          Броня
        </PixelButton>
        <PixelButton variant={tab === 'weapons' ? 'gold' : 'ghost'} onClick={() => setTab('weapons')}>
          Оружие
        </PixelButton>
      </div>
      {tab === 'armor' ? <ArmorSection /> : <WeaponSection />}
    </div>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────

/// Front-view (колонка 0) cell of an armor sheet as a CSS-cropped icon.
export function ArmorCellIcon({ url, slotRow, size = 32 }) {
  const k = size / 40
  if (!url) return <span className="rounded bg-bgDeep" style={{ width: size, height: size, display: 'inline-block' }} />
  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        imageRendering: 'pixelated',
        backgroundImage: `url(${url})`,
        backgroundSize: `${160 * k}px ${120 * k}px`,
        backgroundPosition: `0px ${-40 * k * slotRow}px`,
      }}
    />
  )
}

function NumField({ label, value, onChange, step = 1, hint }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-faint">{label}</div>
      <input type="number" step={step} className="field" value={value}
        onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-[10px] text-faint">{hint}</p>}
    </div>
  )
}

function StatGrid({ defs, values, onChange, cols = 3 }) {
  return (
    <div className={`grid gap-3 ${cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {defs.map((d) => (
        <NumField key={d.key} label={d.label} step={0.1}
          value={values?.[d.key] ?? ''}
          onChange={(v) => onChange(d.key, v)} />
      ))}
    </div>
  )
}

/// Collects only non-zero numeric values into a jsonb object.
function packNums(values) {
  const out = {}
  for (const [k, v] of Object.entries(values ?? {})) {
    const n = parseFloat(v)
    if (!Number.isNaN(n) && n !== 0) out[k] = n
  }
  return out
}

function ShopChestFields({ form, setForm }) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2.5 text-sm text-ink">
        <input type="checkbox" checked={form.in_shop}
          onChange={(e) => setForm((f) => ({ ...f, in_shop: e.target.checked }))} />
        Продаётся у торговца
      </label>
      {form.in_shop && (
        <div className="grid grid-cols-2 gap-3 pl-6">
          <NumField label="Цена золотом (пусто = нет)" value={form.price_gold ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, price_gold: v }))} />
          <NumField label="Цена кристаллами (пусто = нет)" value={form.price_gems ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, price_gems: v }))} />
        </div>
      )}
      <label className="flex items-center gap-2.5 text-sm text-ink">
        <input type="checkbox" checked={form.in_emerald_chest}
          onChange={(e) => setForm((f) => ({ ...f, in_emerald_chest: e.target.checked }))} />
        Падает из изумрудного сундука
      </label>
      <label className="flex items-center gap-2.5 text-sm text-ink">
        <input type="checkbox" checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
        Включено (видно игрокам)
      </label>
    </div>
  )
}

const intOrNull = (v) => {
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}

/// Пикселизация иконки оружия: исходники часто сглаженные (мыло в игре).
/// Обрезаем по альфе, ужимаем длинную сторону до 13 px и режем полупрозрачные
/// пиксели — игра растягивает nearest'ом и получает чёткий пиксель-арт.
async function pixelateWeapon(file, target = 13, alphaCut = 110) {
  const bmp = await createImageBitmap(file)
  try {
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d')
    ctx.drawImage(bmp, 0, 0)
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    let l = c.width, t = c.height, r = -1, b = -1
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (data[(y * c.width + x) * 4 + 3] > 8) {
          if (x < l) l = x
          if (x > r) r = x
          if (y < t) t = y
          if (y > b) b = y
        }
      }
    }
    if (r < 0) throw new Error('Картинка пустая')
    const w = r - l + 1, h = b - t + 1
    const s = target / Math.max(w, h)
    const ow = Math.max(1, Math.round(w * s))
    const oh = Math.max(1, Math.round(h * s))
    const out = document.createElement('canvas')
    out.width = ow
    out.height = oh
    const octx = out.getContext('2d')
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(bmp, l, t, w, h, 0, 0, ow, oh)
    const od = octx.getImageData(0, 0, ow, oh)
    for (let i = 3; i < od.data.length; i += 4) {
      od.data[i] = od.data[i] > alphaCut ? 255 : 0
    }
    octx.putImageData(od, 0, 0)
    return await new Promise((res) => out.toBlob(res, 'image/png'))
  } finally {
    bmp.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARMOR
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_PIECE = () => ({
  id: null, name: '', defense: 0, min_level: 1,
  stats: {}, attrs: {}, effects: {},
})
const EMPTY_SET = {
  id: null, name: '', rarity: 'common', fraction: '', set_bonus_pct: 0,
  image_url: '', min_level: 1, in_shop: false, price_gold: '', price_gems: '',
  in_emerald_chest: false, enabled: true,
  pieces: {}, // slot -> piece form (only slots present in the sheet)
}

/// Detects which slot rows of a 160×120 sheet contain pixels.
async function detectSlots(file) {
  const bmp = await createImageBitmap(file)
  try {
    if (bmp.width !== 160 || bmp.height !== 120) {
      throw new Error(`Ожидаю 160×120, а файл ${bmp.width}×${bmp.height}`)
    }
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 120
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bmp, 0, 0)
    const present = []
    for (let r = 0; r < 3; r++) {
      const data = ctx.getImageData(0, r * 40, 160, 40).data
      let found = false
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 8) { found = true; break }
      }
      if (found) present.push(ARMOR_SLOTS[r].key)
    }
    return present
  } finally {
    bmp.close()
  }
}

function ArmorSection() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(EMPTY_SET)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const [{ data: sets, error: e1 }, { data: pieces, error: e2 }] = await Promise.all([
      supabase.from('armor_sets').select('*').order('created_at', { ascending: true }),
      supabase.from('armor_pieces').select('*'),
    ])
    if (e1 || e2) { toast.error((e1 ?? e2).message); setRows([]); return }
    const bySet = {}
    for (const p of pieces ?? []) (bySet[p.set_id] ??= {})[p.slot] = p
    setRows((sets ?? []).map((s) => ({ ...s, piecesBySlot: bySet[s.id] ?? {} })))
  }, [toast])
  useEffect(() => { load() }, [load])

  function editSet(r) {
    const pieces = {}
    for (const [slot, p] of Object.entries(r.piecesBySlot)) {
      pieces[slot] = {
        id: p.id, name: p.name, defense: p.defense, min_level: p.min_level,
        stats: p.stats ?? {}, attrs: p.attrs ?? {}, effects: p.effects ?? {},
      }
    }
    setForm({
      ...EMPTY_SET, ...r,
      fraction: r.fraction ?? '',
      price_gold: r.price_gold ?? '',
      price_gems: r.price_gems ?? '',
      pieces,
    })
  }

  async function onPickImage(file) {
    if (!file) return
    setUploading(true)
    try {
      const present = await detectSlots(file)
      if (present.length === 0) throw new Error('Лист пустой')
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `armor-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('armor')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('armor').getPublicUrl(path)
      setForm((f) => {
        // Keep stats already typed for slots that are still present.
        const pieces = {}
        for (const slot of present) pieces[slot] = f.pieces[slot] ?? EMPTY_PIECE()
        return { ...f, image_url: data.publicUrl, pieces }
      })
      const missing = ARMOR_SLOTS.filter((s) => !present.includes(s.key))
      toast.ok(missing.length
        ? `Лист загружен. Нет: ${missing.map((s) => s.label.toLowerCase()).join(', ')} — слот не создаётся`
        : 'Лист загружен — все 3 части на месте')
    } catch (e) {
      toast.error(e.message || 'Не удалось загрузить')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function setPiece(slot, patch) {
    setForm((f) => ({ ...f, pieces: { ...f.pieces, [slot]: { ...f.pieces[slot], ...patch } } }))
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Введи название комплекта'); return }
    if (!form.image_url) { toast.error('Загрузи лист брони'); return }
    const slots = Object.keys(form.pieces)
    if (slots.length === 0) { toast.error('В листе не найдено ни одной части'); return }
    setSaving(true)
    try {
      const setRow = {
        name: form.name.trim(),
        rarity: form.rarity,
        fraction: form.fraction || null,
        set_bonus_pct: parseFloat(form.set_bonus_pct) || 0,
        image_url: form.image_url,
        min_level: intOrNull(form.min_level) ?? 1,
        in_shop: form.in_shop,
        price_gold: form.in_shop ? intOrNull(form.price_gold) : null,
        price_gems: form.in_shop ? intOrNull(form.price_gems) : null,
        in_emerald_chest: form.in_emerald_chest,
        enabled: form.enabled,
        updated_at: new Date().toISOString(),
      }
      let setId = form.id
      if (setId) {
        const { error } = await supabase.from('armor_sets').update(setRow).eq('id', setId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('armor_sets').insert(setRow).select('id').single()
        if (error) throw error
        setId = data.id
      }
      for (const slot of slots) {
        const p = form.pieces[slot]
        const row = {
          set_id: setId,
          slot,
          name: (p.name || '').trim() || `${form.name.trim()} — ${ARMOR_SLOTS.find((s) => s.key === slot).label}`,
          defense: parseFloat(p.defense) || 0,
          min_level: intOrNull(p.min_level) ?? 1,
          stats: packNums(p.stats),
          attrs: packNums(p.attrs),
          effects: packNums(p.effects),
          enabled: true,
          updated_at: new Date().toISOString(),
        }
        if (p.id) {
          const { error } = await supabase.from('armor_pieces').update(row).eq('id', p.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('armor_pieces').insert(row)
          if (error) throw error
        }
      }
      // Slots removed from the sheet (re-upload) — drop their pieces.
      const { error: delErr } = await supabase.from('armor_pieces')
        .delete().eq('set_id', setId).not('slot', 'in', `(${slots.join(',')})`)
      if (delErr) throw delErr
      await logAction({ action: 'gear.armor.save', entity: 'armor_sets', entity_key: setId, summary: `Броня «${setRow.name}» (${setRow.rarity}, ${slots.length} ч.)` })
      toast.ok('Сохранено')
      setForm(EMPTY_SET)
      await load()
    } catch (e) {
      toast.error(e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!form.id || !window.confirm(`Удалить комплект «${form.name}»? Куски у игроков перестанут отображаться.`)) return
    setSaving(true)
    try {
      const { error } = await supabase.from('armor_sets').delete().eq('id', form.id)
      if (error) throw error
      await logAction({ action: 'gear.armor.delete', entity: 'armor_sets', entity_key: form.id, summary: `Удалена броня «${form.name}»` })
      toast.ok('Удалено')
      setForm(EMPTY_SET)
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
        {rows.length === 0 && <p className="text-sm text-faint">Пока нет брони.</p>}
        {rows.map((r) => (
          <button key={r.id} onClick={() => editSet(r)}
            className={`pixel-frame flex items-center gap-3 px-4 py-2.5 text-left ${form.id === r.id ? 'border-gold' : ''}`}>
            <span className="flex gap-0.5">
              {ARMOR_SLOTS.map((s, i) => r.piecesBySlot[s.key]
                ? <ArmorCellIcon key={s.key} url={r.image_url} slotRow={i} size={28} />
                : null)}
            </span>
            <span className="flex-1 truncate text-sm text-ink">{r.name || '—'}</span>
            <span className="label" style={{ color: rarityOf(r.rarity).color }}>{rarityOf(r.rarity).label}</span>
            <span className="label text-faint">{fractionLabel(r.fraction)}</span>
            {r.in_shop && <span className="label text-gold">магазин</span>}
            {r.in_emerald_chest && <span className="label" style={{ color: '#7BD389' }}>сундук</span>}
            {!r.enabled && <span className="label text-faint">выкл</span>}
          </button>
        ))}
        <div><PixelButton variant="ghost" onClick={() => setForm(EMPTY_SET)}>+ Новый комплект</PixelButton></div>
      </div>

      <PixelFrame className="flex flex-col gap-5 px-5 py-6">
        <div className="text-xs uppercase tracking-widest text-faint">
          {form.id ? 'Редактирование комплекта' : 'Новый комплект'}
        </div>
        <div>
          <label className="label mb-2 block">Название комплекта</label>
          <input className="field" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Латы стража" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2 block">Редкость</label>
            <select className="field" value={form.rarity}
              onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}>
              {RARITIES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label mb-2 block">Фракция</label>
            <select className="field" value={form.fraction}
              onChange={(e) => setForm((f) => ({ ...f, fraction: e.target.value }))}>
              <option value="">Любая</option>
              {FRACTIONS.map((fr) => <option key={fr.key} value={fr.key}>{fr.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-faint">Воин не наденет мантию мага</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Бонус комплекта, % ко всем статам" step={0.5}
            value={form.set_bonus_pct}
            onChange={(v) => setForm((f) => ({ ...f, set_bonus_pct: v }))}
            hint="Даётся, когда надеты все части" />
          <NumField label="Мин. уровень (красная подсветка ниже)"
            value={form.min_level}
            onChange={(v) => setForm((f) => ({ ...f, min_level: v }))} />
        </div>

        {/* Sheet upload + auto slot detection */}
        <div>
          <label className="label mb-2 block">Лист брони</label>
          {form.image_url && (
            <div className="mb-2 inline-block rounded border-2 border-line p-2" style={{ background: '#0F1A1C' }}>
              <img src={form.image_url} alt="" style={{ imageRendering: 'pixelated', height: 90, width: 'auto' }} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/png" className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0])} />
            <PixelButton variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner /> : (form.image_url ? 'Заменить' : 'Загрузить')}
            </PixelButton>
          </div>
          <p className="mt-1.5 text-xs text-faint">
            {ARMOR_IMG_HINT}. Пустой ряд (например, нет шлема) — часть не создаётся.
          </p>
        </div>

        {/* Per-piece editors, only for slots present in the sheet */}
        {ARMOR_SLOTS.map((s, i) => {
          const p = form.pieces[s.key]
          if (!p) return null
          return (
            <details key={s.key} className="rounded border border-line/60 px-3 py-2" open={!form.id}>
              <summary className="cursor-pointer text-sm text-ink">
                <span className="mr-2 inline-block align-middle">
                  <ArmorCellIcon url={form.image_url} slotRow={i} size={24} />
                </span>
                {s.label} — статы
              </summary>
              <div className="mt-3 flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 sm:col-span-1">
                    <div className="mb-1 text-[11px] text-faint">Название части</div>
                    <input className="field" value={p.name}
                      placeholder={`${form.name || 'Комплект'} — ${s.label}`}
                      onChange={(e) => setPiece(s.key, { name: e.target.value })} />
                  </div>
                  <NumField label="Защита" step={0.1} value={p.defense}
                    onChange={(v) => setPiece(s.key, { defense: v })} />
                  <NumField label="Мин. уровень части" value={p.min_level}
                    onChange={(v) => setPiece(s.key, { min_level: v })} />
                </div>
                <div>
                  <div className="label mb-2">Базовые статы (+ к силе и т.д.)</div>
                  <StatGrid cols={4} defs={STAT_KEYS} values={p.stats}
                    onChange={(k, v) => setPiece(s.key, { stats: { ...p.stats, [k]: v } })} />
                </div>
                <div>
                  <div className="label mb-2">Характеристики</div>
                  <StatGrid defs={ARMOR_ATTRS} values={p.attrs}
                    onChange={(k, v) => setPiece(s.key, { attrs: { ...p.attrs, [k]: v } })} />
                </div>
                <div>
                  <div className="label mb-2">Особые эффекты</div>
                  <StatGrid defs={ARMOR_EFFECTS} values={p.effects}
                    onChange={(k, v) => setPiece(s.key, { effects: { ...p.effects, [k]: v } })} />
                </div>
              </div>
            </details>
          )
        })}

        <ShopChestFields form={form} setForm={setForm} />
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
// WEAPONS
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_WEAPON = {
  id: null, name: '', rarity: 'common', fraction: '', weapon_type: 'sword',
  element: 'physical', min_level: 1, image_url: '', damage: 0, attack_speed: 1,
  attrs: {}, stats: {}, flavor: '', in_shop: false, price_gold: '', price_gems: '',
  in_emerald_chest: false, enabled: true,
}

function WeaponSection() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(EMPTY_WEAPON)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('weapon_items').select('*').order('created_at', { ascending: true })
    if (error) { toast.error(error.message); setRows([]); return }
    setRows(data ?? [])
  }, [toast])
  useEffect(() => { load() }, [load])

  async function onPickImage(file) {
    if (!file) return
    setUploading(true)
    try {
      const crisp = await pixelateWeapon(file)
      const path = `weapon-${Date.now()}.png`
      const { error } = await supabase.storage.from('weapons')
        .upload(path, crisp, { upsert: true, contentType: 'image/png' })
      if (error) throw error
      const { data } = supabase.storage.from('weapons').getPublicUrl(path)
      setForm((f) => ({ ...f, image_url: data.publicUrl }))
      toast.ok('Картинка загружена (пикселизирована)')
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
        rarity: form.rarity,
        fraction: form.fraction || null,
        weapon_type: form.weapon_type,
        element: form.element,
        min_level: intOrNull(form.min_level) ?? 1,
        image_url: form.image_url || null,
        damage: parseFloat(form.damage) || 0,
        attack_speed: parseFloat(form.attack_speed) || 1,
        attrs: packNums(form.attrs),
        stats: packNums(form.stats),
        flavor: form.flavor?.trim() || null,
        in_shop: form.in_shop,
        price_gold: form.in_shop ? intOrNull(form.price_gold) : null,
        price_gems: form.in_shop ? intOrNull(form.price_gems) : null,
        in_emerald_chest: form.in_emerald_chest,
        enabled: form.enabled,
        updated_at: new Date().toISOString(),
      }
      let err
      if (form.id) {
        ({ error: err } = await supabase.from('weapon_items').update(row).eq('id', form.id))
      } else {
        ({ error: err } = await supabase.from('weapon_items').insert(row))
      }
      if (err) throw err
      await logAction({ action: 'gear.weapon.save', entity: 'weapon_items', entity_key: form.id ?? 'new', summary: `Оружие «${row.name}» (${row.rarity}, ${row.weapon_type})` })
      toast.ok('Сохранено')
      setForm(EMPTY_WEAPON)
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
      const { error } = await supabase.from('weapon_items').delete().eq('id', form.id)
      if (error) throw error
      await logAction({ action: 'gear.weapon.delete', entity: 'weapon_items', entity_key: form.id, summary: `Удалено оружие «${form.name}»` })
      toast.ok('Удалено')
      setForm(EMPTY_WEAPON)
      await load()
    } catch (e) {
      toast.error(e.message || 'Ошибка удаления')
    } finally {
      setSaving(false)
    }
  }

  const dps = (parseFloat(form.damage) || 0) * (parseFloat(form.attack_speed) || 0)
  const typeOf = (k) => WEAPON_TYPES.find((t) => t.key === k)
  const elemOf = (k) => WEAPON_ELEMENTS.find((e) => e.key === k) ?? WEAPON_ELEMENTS[0]

  if (!rows) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>

  return (
    <>
      <div className="mb-5 flex flex-col gap-2">
        {rows.length === 0 && <p className="text-sm text-faint">Пока нет оружия.</p>}
        {rows.map((r) => (
          <button key={r.id}
            onClick={() => setForm({ ...EMPTY_WEAPON, ...r, fraction: r.fraction ?? '', price_gold: r.price_gold ?? '', price_gems: r.price_gems ?? '', attrs: r.attrs ?? {}, stats: r.stats ?? {}, flavor: r.flavor ?? '' })}
            className={`pixel-frame flex items-center gap-3 px-4 py-2.5 text-left ${form.id === r.id ? 'border-gold' : ''}`}>
            {r.image_url
              ? <img src={r.image_url} alt="" width={28} height={28} style={{ imageRendering: 'pixelated' }} />
              : <span className="h-7 w-7 rounded bg-bgDeep" />}
            <span className="flex-1 truncate text-sm text-ink">{r.name || '—'}</span>
            <span className="label text-faint">{typeOf(r.weapon_type)?.label ?? r.weapon_type}</span>
            <span className="label" style={{ color: elemOf(r.element).color }}>{elemOf(r.element).label}</span>
            <span className="label" style={{ color: rarityOf(r.rarity).color }}>{rarityOf(r.rarity).label}</span>
            <span className="label text-faint">{fractionLabel(r.fraction)}</span>
            {r.in_shop && <span className="label text-gold">магазин</span>}
            {r.in_emerald_chest && <span className="label" style={{ color: '#7BD389' }}>сундук</span>}
            {!r.enabled && <span className="label text-faint">выкл</span>}
          </button>
        ))}
        <div><PixelButton variant="ghost" onClick={() => setForm(EMPTY_WEAPON)}>+ Новое оружие</PixelButton></div>
      </div>

      <PixelFrame className="flex flex-col gap-5 px-5 py-6">
        <div className="text-xs uppercase tracking-widest text-faint">
          {form.id ? 'Редактирование оружия' : 'Новое оружие'}
        </div>
        <div>
          <label className="label mb-2 block">Название</label>
          <input className="field" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Клинок рассвета" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2 block">Тип</label>
            <select className="field" value={form.weapon_type}
              onChange={(e) => setForm((f) => ({ ...f, weapon_type: e.target.value }))}>
              {WEAPON_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-faint">Лук стреляет стрелой, посох/жезл — магией, остальное — взмах</p>
          </div>
          <div>
            <label className="label mb-2 block">Стихия урона</label>
            <select className="field" value={form.element}
              onChange={(e) => setForm((f) => ({ ...f, element: e.target.value }))}>
              {WEAPON_ELEMENTS.map((el) => <option key={el.key} value={el.key}>{el.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-faint">Под неё считается сопротивление брони в бою</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2 block">Редкость</label>
            <select className="field" value={form.rarity}
              onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}>
              {RARITIES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label mb-2 block">Фракция</label>
            <select className="field" value={form.fraction}
              onChange={(e) => setForm((f) => ({ ...f, fraction: e.target.value }))}>
              <option value="">Любая</option>
              {FRACTIONS.map((fr) => <option key={fr.key} value={fr.key}>{fr.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Урон" step={0.1} value={form.damage}
            onChange={(v) => setForm((f) => ({ ...f, damage: v }))} />
          <NumField label="Скорость атаки (в сек)" step={0.05} value={form.attack_speed}
            onChange={(v) => setForm((f) => ({ ...f, attack_speed: v }))} />
          <div>
            <div className="mb-1 text-[11px] text-faint">УВС (DPS)</div>
            <div className="field flex items-center text-gold">{dps.toFixed(1)}</div>
          </div>
        </div>
        <NumField label="Мин. уровень (красная подсветка ниже)" value={form.min_level}
          onChange={(v) => setForm((f) => ({ ...f, min_level: v }))} />

        {/* Icon upload */}
        <div>
          <label className="label mb-2 block">Иконка</label>
          {form.image_url && (
            <div className="mb-2 inline-block rounded border-2 border-line p-2" style={{ background: '#0F1A1C' }}>
              <img src={form.image_url} alt="" style={{ imageRendering: 'pixelated', height: 64, width: 64 }} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/png" className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0])} />
            <PixelButton variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner /> : (form.image_url ? 'Заменить' : 'Загрузить')}
            </PixelButton>
          </div>
          <p className="mt-1.5 text-xs text-faint">Рекомендуемый размер — {WEAPON_IMG_HINT}</p>
        </div>

        <div>
          <div className="label mb-2">Базовые статы (+ к силе и т.д.)</div>
          <StatGrid cols={4} defs={STAT_KEYS} values={form.stats}
            onChange={(k, v) => setForm((f) => ({ ...f, stats: { ...f.stats, [k]: v } }))} />
        </div>
        <div>
          <div className="label mb-2">Характеристики</div>
          <StatGrid defs={WEAPON_ATTRS} values={form.attrs}
            onChange={(k, v) => setForm((f) => ({ ...f, attrs: { ...f.attrs, [k]: v } }))} />
        </div>
        <div>
          <label className="label mb-2 block">Флавор (описание, опц.)</label>
          <textarea rows={2} className="field" value={form.flavor}
            onChange={(e) => setForm((f) => ({ ...f, flavor: e.target.value }))}
            placeholder="Выкован в кузнях павшего бога." />
        </div>

        <ShopChestFields form={form} setForm={setForm} />
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

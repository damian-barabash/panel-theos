import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/api'
import { PixelFrame, PixelButton, Spinner, useToast } from '../components/ui'

// ── Version-gate (app_config) ────────────────────────────────────────────────
// app_config rows store JSON values; here we treat each as a primitive.
const FIELDS = [
  { key: 'min_build', label: 'Минимальный build', type: 'number',
    hint: 'Игроки с build НИЖЕ этого числа увидят экран «обновитесь». Текущий build игры — 5.' },
  { key: 'latest_version', label: 'Последняя версия', type: 'text',
    hint: 'Информационно — например 1.0.0' },
  { key: 'update_url', label: 'Ссылка на обновление', type: 'text',
    hint: 'Куда ведёт кнопка на экране обновления (APK / стор). Можно пусто.' },
  { key: 'update_message', label: 'Текст экрана обновления', type: 'textarea',
    hint: 'Что увидит игрок старой версии.' },
]

// ── "What's new" popup (app_changelog) ───────────────────────────────────────
// Recommended hero image for the in-game popup. The game shows it full-width at
// 16:9, so anything else gets center-cropped.
const IMG_HINT = '1280 × 720 px (16:9), PNG/JPG/WebP, до ~500 КБ'

const EMPTY = {
  build_number: '',
  version: '',
  title: 'Что нового',
  body: '',
  image_url: '',
  enabled: true,
}

export default function Settings() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <VersionGate />
      <WhatsNewSection />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function VersionGate() {
  const toast = useToast()
  const [values, setValues] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_config').select('key, value')
    const map = {}
    for (const r of data ?? []) {
      map[r.key] = typeof r.value === 'string' ? r.value : r.value
    }
    setValues({
      min_build: String(map.min_build ?? 1),
      latest_version: String(map.latest_version ?? ''),
      update_url: String(map.update_url ?? ''),
      update_message: String(map.update_message ?? ''),
    })
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const rows = [
        { key: 'min_build', value: parseInt(values.min_build, 10) || 1 },
        { key: 'latest_version', value: values.latest_version },
        { key: 'update_url', value: values.update_url },
        { key: 'update_message', value: values.update_message },
      ].map((r) => ({ key: r.key, value: r.value, updated_at: new Date().toISOString() }))

      const { error } = await supabase.from('app_config').upsert(rows, { onConflict: 'key' })
      if (error) throw error
      await logAction({
        action: 'config.update', entity: 'app_config', entity_key: 'version-gate',
        summary: `Version-gate обновлён: min_build=${rows[0].value}, версия=${values.latest_version}`,
      })
      toast.ok('Сохранено')
    } catch (e) {
      toast.error(e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (!values) {
    return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
  }

  return (
    <section>
      <h1 className="pixel-title mb-2 text-sm xs:text-base">ВЕРСИЯ ИГРЫ</h1>
      <p className="mb-5 text-sm text-muted">
        Гейт версий: если игрок заходит со старого билда (build &lt; минимального),
        приложение показывает экран обновления вместо игры.
      </p>

      <PixelFrame className="flex flex-col gap-5 px-5 py-6">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label mb-2 block">{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="field"
              />
            ) : (
              <input
                type={f.type}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="field"
              />
            )}
            <p className="mt-1.5 text-xs text-faint">{f.hint}</p>
          </div>
        ))}

        <div className="flex justify-end">
          <PixelButton onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-bgDeep/40 border-t-bgDeep" /> : 'Сохранить'}
          </PixelButton>
        </div>
      </PixelFrame>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function WhatsNewSection() {
  const toast = useToast()
  const [entries, setEntries] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editingBuild, setEditingBuild] = useState(null) // null = new
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_changelog')
      .select('build_number, version, title, body, image_url, enabled')
      .order('build_number', { ascending: false })
    if (error) {
      toast.error(error.message)
      setEntries([])
      return
    }
    setEntries(data ?? [])
  }, [toast])

  useEffect(() => { load() }, [load])

  function startNew() {
    setForm(EMPTY)
    setEditingBuild(null)
  }

  function edit(e) {
    setForm({
      build_number: String(e.build_number),
      version: e.version ?? '',
      title: e.title ?? 'Что нового',
      body: e.body ?? '',
      image_url: e.image_url ?? '',
      enabled: e.enabled ?? true,
    })
    setEditingBuild(e.build_number)
  }

  async function onPickImage(file) {
    if (!file) return
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const bn = parseInt(form.build_number, 10) || 'tmp'
      const path = `build-${bn}-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('changelog')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('changelog').getPublicUrl(path)
      setForm((f) => ({ ...f, image_url: data.publicUrl }))
      toast.ok('Картинка загружена')
    } catch (e) {
      toast.error(e.message || 'Не удалось загрузить картинку')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    const bn = parseInt(form.build_number, 10)
    if (!bn) { toast.error('Укажи номер build (число)'); return }
    if (!form.body.trim() && !form.title.trim()) {
      toast.error('Заполни хотя бы заголовок или текст')
      return
    }
    setSaving(true)
    try {
      const row = {
        build_number: bn,
        version: form.version.trim(),
        title: form.title.trim() || 'Что нового',
        body: form.body,
        image_url: form.image_url.trim() || null,
        enabled: form.enabled,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('app_changelog')
        .upsert(row, { onConflict: 'build_number' })
      if (error) throw error
      await logAction({
        action: 'changelog.save',
        entity: 'app_changelog',
        entity_key: String(bn),
        summary: `Что нового для build ${bn}${row.version ? ` (v${row.version})` : ''}`,
      })
      toast.ok('Сохранено')
      setEditingBuild(bn)
      await load()
    } catch (e) {
      toast.error(e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (editingBuild == null) return
    if (!window.confirm(`Удалить запись для build ${editingBuild}?`)) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('app_changelog')
        .delete()
        .eq('build_number', editingBuild)
      if (error) throw error
      await logAction({
        action: 'changelog.delete',
        entity: 'app_changelog',
        entity_key: String(editingBuild),
        summary: `Удалено «Что нового» для build ${editingBuild}`,
      })
      toast.ok('Удалено')
      startNew()
      await load()
    } catch (e) {
      toast.error(e.message || 'Ошибка удаления')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2 className="pixel-title mb-2 text-sm xs:text-base">ЧТО НОВОГО</h2>
      <p className="mb-5 text-sm text-muted">
        Попап с описанием версии, который игрок видит один раз после обновления.
        Запись привязывается к <b>номеру build</b> игры — он должен совпадать с
        тем, что в сборке (сейчас в игре build 5).
      </p>

      {!entries ? (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
      ) : (
        <>
          {/* Existing entries */}
          <div className="mb-5 flex flex-col gap-2">
            {entries.length === 0 && (
              <p className="text-sm text-faint">Пока нет ни одной записи.</p>
            )}
            {entries.map((e) => (
              <button
                key={e.build_number}
                onClick={() => edit(e)}
                className={`pixel-frame flex items-center gap-3 px-4 py-3 text-left transition ${
                  editingBuild === e.build_number ? 'border-gold' : ''
                }`}
              >
                <span className="label shrink-0 text-gold">build {e.build_number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {e.version ? `v${e.version} · ` : ''}{e.title || '—'}
                </span>
                {!e.enabled && <span className="label text-faint">выкл</span>}
                {e.image_url && <span className="text-gold text-xs">🖼</span>}
              </button>
            ))}
            <div>
              <PixelButton variant="ghost" onClick={startNew}>+ Новая версия</PixelButton>
            </div>
          </div>

          {/* Editor */}
          <PixelFrame className="flex flex-col gap-5 px-5 py-6">
            <div className="text-xs uppercase tracking-widest text-faint">
              {editingBuild == null ? 'Новая запись' : `Редактирование build ${editingBuild}`}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-2 block">Номер build *</label>
                <input
                  type="number"
                  value={form.build_number}
                  onChange={(e) => setForm((f) => ({ ...f, build_number: e.target.value }))}
                  className="field"
                  placeholder="6"
                />
                <p className="mt-1.5 text-xs text-faint">= appBuildNumber в сборке</p>
              </div>
              <div>
                <label className="label mb-2 block">Версия</label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  className="field"
                  placeholder="0.0.94"
                />
                <p className="mt-1.5 text-xs text-faint">Покажется как «v0.0.94»</p>
              </div>
            </div>

            <div>
              <label className="label mb-2 block">Заголовок</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="field"
                placeholder="Что нового"
              />
            </div>

            <div>
              <label className="label mb-2 block">Текст изменений</label>
              <textarea
                rows={6}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="field"
                placeholder={'Опиши, что добавлено.\nМожно списком:\n- Глазик у пароля\n- Фикс календаря на Xiaomi'}
              />
            </div>

            <div>
              <label className="label mb-2 block">Картинка</label>
              {form.image_url ? (
                <div className="mb-2 overflow-hidden rounded border-2 border-line">
                  <img src={form.image_url} alt="" className="block w-full" />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPickImage(e.target.files?.[0])}
                  className="hidden"
                />
                <PixelButton
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Spinner /> : (form.image_url ? 'Заменить картинку' : 'Загрузить картинку')}
                </PixelButton>
                {form.image_url && (
                  <PixelButton
                    variant="danger"
                    onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                  >
                    Убрать
                  </PixelButton>
                )}
              </div>
              <p className="mt-1.5 text-xs text-faint">Рекомендуемый размер — {IMG_HINT}</p>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Показывать игрокам (включено)
            </label>

            <div className="flex justify-between">
              {editingBuild != null ? (
                <PixelButton variant="danger" onClick={remove} disabled={saving}>
                  Удалить
                </PixelButton>
              ) : <span />}
              <PixelButton onClick={save} disabled={saving || uploading}>
                {saving ? <Spinner className="border-bgDeep/40 border-t-bgDeep" /> : 'Сохранить'}
              </PixelButton>
            </div>
          </PixelFrame>
        </>
      )}
    </section>
  )
}

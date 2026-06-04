import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/api'
import { PixelFrame, PixelButton, Spinner, useToast } from '../components/ui'

// app_config rows store JSON values; here we treat each as a primitive.
const FIELDS = [
  { key: 'min_build', label: 'Минимальный build', type: 'number',
    hint: 'Игроки с build НИЖЕ этого числа увидят экран «обновитесь». Текущий build игры — 1.' },
  { key: 'latest_version', label: 'Последняя версия', type: 'text',
    hint: 'Информационно — например 1.0.0' },
  { key: 'update_url', label: 'Ссылка на обновление', type: 'text',
    hint: 'Куда ведёт кнопка на экране обновления (APK / стор). Можно пусто.' },
  { key: 'update_message', label: 'Текст экрана обновления', type: 'textarea',
    hint: 'Что увидит игрок старой версии.' },
]

export default function Settings() {
  const toast = useToast()
  const [values, setValues] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_config').select('key, value')
    const map = {}
    for (const r of data ?? []) {
      // value is jsonb; primitives come back already parsed
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
    <div className="mx-auto max-w-2xl">
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
    </div>
  )
}

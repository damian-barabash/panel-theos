import { PASTELS, FONTS } from './constants'

export function PastelPicker({ value, onChange, allowNone = true }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone && (
        <button
          onClick={() => onChange(null)}
          title="Без цвета"
          className={`h-6 w-6 border-2 ${!value ? 'border-gold' : 'border-line'} bg-bgDeep text-faint text-[11px] leading-none`}
        >
          ✕
        </button>
      )}
      {PASTELS.map((p) => (
        <button
          key={p.hex}
          onClick={() => onChange(p.hex)}
          title={p.name}
          style={{ background: p.hex }}
          className={`h-6 w-6 border-2 ${value === p.hex ? 'border-gold' : 'border-bgDeep'}`}
        />
      ))}
    </div>
  )
}

export function FontPicker({ value, onChange }) {
  return (
    <select
      value={value || 'inter'}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface2 border-2 border-line text-ink text-xs px-2 py-1 outline-none focus:border-gold"
    >
      {FONTS.map((f) => (
        <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
          {f.label}
        </option>
      ))}
    </select>
  )
}

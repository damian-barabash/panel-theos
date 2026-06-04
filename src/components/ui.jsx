import { createContext, useContext, useState, useCallback } from 'react'

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold ${className}`}
    />
  )
}

// ── Pixel frame (card) ───────────────────────────────────────────────────────
export function PixelFrame({ children, className = '', purple = false }) {
  return (
    <div className={`pixel-frame ${purple ? 'pixel-frame-purple' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ── Pixel button ─────────────────────────────────────────────────────────────
export function PixelButton({ children, variant = 'gold', className = '', ...props }) {
  const v =
    variant === 'ghost'
      ? 'pixel-btn-ghost'
      : variant === 'danger'
        ? 'pixel-btn-danger'
        : variant === 'crystal'
          ? 'pixel-btn-crystal'
          : ''
  return (
    <button className={`pixel-btn ${v} ${className}`} {...props}>
      {children}
    </button>
  )
}

// ── Toast ────────────────────────────────────────────────────────────────────
const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, kind = 'info') => {
    const id = `${Date.now()}-${Math.round(performance.now())}`
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])
  const api = {
    info: (m) => push(m, 'info'),
    ok: (m) => push(m, 'ok'),
    error: (m) => push(m, 'error'),
  }
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pixel-frame px-4 py-2.5 text-sm ${
              t.kind === 'error'
                ? 'border-danger text-danger'
                : t.kind === 'ok'
                  ? 'border-ok text-ok'
                  : 'text-ink'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

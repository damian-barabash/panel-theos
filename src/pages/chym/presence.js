import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

// Stable per-user accent colors for collaboration cursors / avatars.
const COLORS = [
  '#E8B547', '#8FD0FF', '#7BD389', '#FF8FB1',
  '#C9A6FF', '#FFB36B', '#5AD6C0', '#FF7A7A',
]

export function colorFor(id) {
  let h = 0
  for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

export function displayName(email) {
  if (!email) return 'Админ'
  const local = String(email).split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export function initials(name) {
  const n = String(name || '?').trim()
  return (n[0] || '?').toUpperCase()
}

/**
 * Live collaboration for one sheet, over a per-sheet Supabase Realtime channel.
 * Presence carries each peer's selection + "editing" flag; broadcast carries
 * live cell typing (`edit` / `edit_end`) and committed values (`commit`) so
 * everyone sees changes instantly without a DB round-trip. All ephemeral — no
 * schema, no writes.
 *
 * Returns:
 *  - peers: other users' presence [{ uid, name, color, sel, editing }]
 *  - liveEdits: { [uid]: { r, c, text } } — what a peer is typing right now
 *  - track(patch): update my presence ({ sel } / { editing }), throttled
 *  - broadcast(event, payload): send a broadcast (uid auto-attached)
 *  - setOnCommit(fn): register a handler for peers' committed cell values
 */
export function useSheetCollab(sheetId, me) {
  const [peers, setPeers] = useState([])
  const [liveEdits, setLiveEdits] = useState({})
  const chanRef = useRef(null)
  const onCommitRef = useRef(null)
  const selRef = useRef(null)
  const editingRef = useRef(false)
  const throttle = useRef({ t: 0, timer: null })

  const uid = me?.uid
  const name = me?.name
  const color = me?.color

  useEffect(() => {
    if (!sheetId || !uid) return
    const channel = supabase.channel(`chym:${sheetId}`, {
      config: { presence: { key: uid }, broadcast: { self: false } },
    })

    const syncPeers = () => {
      const state = channel.presenceState()
      const out = []
      for (const key of Object.keys(state)) {
        if (key === uid) continue
        const meta = state[key]?.[0]
        if (meta) out.push(meta)
      }
      setPeers(out)
    }

    channel.on('presence', { event: 'sync' }, syncPeers)
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      setLiveEdits((m) => {
        const next = { ...m }
        for (const p of leftPresences || []) if (p?.uid) delete next[p.uid]
        return next
      })
    })
    channel.on('broadcast', { event: 'edit' }, ({ payload }) => {
      if (!payload?.uid) return
      setLiveEdits((m) => ({
        ...m,
        [payload.uid]: { r: payload.r, c: payload.c, text: payload.text },
      }))
    })
    channel.on('broadcast', { event: 'edit_end' }, ({ payload }) => {
      if (!payload?.uid) return
      setLiveEdits((m) => { const n = { ...m }; delete n[payload.uid]; return n })
    })
    channel.on('broadcast', { event: 'commit' }, ({ payload }) => {
      if (!payload?.uid) return
      onCommitRef.current?.(payload)
      setLiveEdits((m) => { const n = { ...m }; delete n[payload.uid]; return n })
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ uid, name, color, sel: selRef.current, editing: editingRef.current })
      }
    })
    chanRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      chanRef.current = null
      selRef.current = null
      editingRef.current = false
      setPeers([])
      setLiveEdits({})
    }
  }, [sheetId, uid, name, color])

  // Throttled presence update (selection moves can be high-frequency on drag).
  const pushPresence = useCallback(() => {
    const ch = chanRef.current
    if (!ch) return
    const now = Date.now()
    const since = now - throttle.current.t
    const send = () => {
      throttle.current.t = Date.now()
      ch.track({ uid, name, color, sel: selRef.current, editing: editingRef.current })
    }
    if (since >= 90) {
      clearTimeout(throttle.current.timer)
      throttle.current.timer = null
      send()
    } else if (!throttle.current.timer) {
      throttle.current.timer = setTimeout(() => {
        throttle.current.timer = null
        send()
      }, 90 - since)
    }
  }, [uid, name, color])

  const track = useCallback((patch) => {
    if (patch.sel !== undefined) selRef.current = patch.sel
    if (patch.editing !== undefined) editingRef.current = patch.editing
    pushPresence()
  }, [pushPresence])

  const broadcast = useCallback((event, payload) => {
    chanRef.current?.send({ type: 'broadcast', event, payload: { ...payload, uid } })
  }, [uid])

  const setOnCommit = useCallback((fn) => { onCommitRef.current = fn }, [])

  return { peers, liveEdits, track, broadcast, setOnCommit }
}

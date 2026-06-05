import { supabase, SUPABASE_URL, SUPABASE_KEY } from './supabase'

const FN_BASE = `${SUPABASE_URL}/functions/v1`

async function callFunction(name, payload) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token ?? SUPABASE_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Ошибка ${res.status}`)
  return body
}

// ── Audit log ──────────────────────────────────────────────────────────────
export async function logAction({ action, entity, entity_key, summary, diff }) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('panel_logs').insert({
    actor_id: user?.id ?? null,
    actor_email: user?.email ?? null,
    action,
    entity: entity ?? null,
    entity_key: entity_key ?? null,
    summary: summary ?? null,
    diff: diff ?? null,
  })
}

// ── AI test chat (via ai-proxy edge function) ────────────────────────────────
export function aiChat({ messages, temperature, model }) {
  return callFunction('ai-proxy', { messages, temperature, model })
}

// ── Player data for the test-chat (via panel-player edge function) ──────────
// Read-only, service-role behind the panel-admin gate. Lets the test-chat pull
// a real player's profile/tasks/history so it can reproduce the in-game prompt.
export function listPlayers() {
  return callFunction('panel-player', { action: 'list' })
}
export function playerContext(user_id) {
  return callFunction('panel-player', { action: 'context', user_id })
}

// ── Panel user management (via panel-user edge function) ─────────────────────
export function createUser({ email, password }) {
  return callFunction('panel-user', { action: 'create', email, password })
}
export function deleteUser(user_id) {
  return callFunction('panel-user', { action: 'delete', user_id })
}
export function updateUserPassword(user_id, password) {
  return callFunction('panel-user', { action: 'update_password', user_id, password })
}

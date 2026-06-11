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

// ── Players admin (via panel-admin edge function) ───────────────────────────
// Full read + mutations across ALL players. service-role behind the panel-admin
// gate (bypasses the game's per-row RLS). Mutations are logged server-side.
export function adminDashboard() {
  return callFunction('panel-admin', { action: 'dashboard' })
}
export function adminListPlayers() {
  return callFunction('panel-admin', { action: 'list' })
}
export function adminPlayerDetail(user_id) {
  return callFunction('panel-admin', { action: 'detail', user_id })
}
// patch: whitelisted numeric fields (gold, gems, level, xp_current, total_xp,
// strength, intellect, agility, stamina)
export function adminUpdateProfile(user_id, patch) {
  return callFunction('panel-admin', { action: 'update_profile', user_id, patch })
}
export function adminGiveItem(user_id, item_key) {
  return callFunction('panel-admin', { action: 'give_item', user_id, item_key })
}
export function adminRemoveItem(user_id, item_key) {
  return callFunction('panel-admin', { action: 'remove_item', user_id, item_key })
}
// dynamic gear (user_items): kind 'armor' (armor_pieces.id) | 'weapon' (weapon_items.id)
export function adminGiveGear(user_id, kind, ref_id) {
  return callFunction('panel-admin', { action: 'give_gear', user_id, kind, ref_id })
}
export function adminRemoveGear(user_id, kind, ref_id) {
  return callFunction('panel-admin', { action: 'remove_gear', user_id, kind, ref_id })
}
// item_type: 'egg' | 'food', item_ref: 'egg' or a pet_food.id, quantity: absolute >= 0
export function adminSetStack(user_id, item_type, item_ref, quantity) {
  return callFunction('panel-admin', { action: 'set_stack', user_id, item_type, item_ref, quantity })
}
export function adminSetPassword(user_id, password) {
  return callFunction('panel-admin', { action: 'set_password', user_id, password })
}
// Deletes the player account + all their game data (irreversible)
export function adminDeletePlayer(user_id) {
  return callFunction('panel-admin', { action: 'delete_player', user_id })
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

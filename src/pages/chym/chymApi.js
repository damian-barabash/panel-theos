import { supabase } from '../../lib/supabase'
import { logAction } from '../../lib/api'
import { blankContent } from './constants'

export async function listSheets() {
  const { data, error } = await supabase
    .from('chym_sheets')
    .select('*')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createSheet({ type, title }) {
  const { data: maxRow } = await supabase
    .from('chym_sheets')
    .select('sort')
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort = (maxRow?.sort ?? 0) + 1
  const row = {
    title: title || 'Новый лист',
    type,
    sort,
    font: 'inter',
    content: blankContent(type),
  }
  const { data, error } = await supabase.from('chym_sheets').insert(row).select().single()
  if (error) throw error
  await logAction({ action: 'chym.create', entity: 'chym_sheets', entity_key: data.title, summary: `Лист «${data.title}» (${type}) создан` })
  return data
}

export async function duplicateSheet(sheet) {
  const { data: maxRow } = await supabase
    .from('chym_sheets')
    .select('sort')
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = {
    title: `${sheet.title} (копия)`,
    type: sheet.type,
    color: sheet.color,
    font: sheet.font,
    sort: (maxRow?.sort ?? 0) + 1,
    content: sheet.content,
  }
  const { data, error } = await supabase.from('chym_sheets').insert(row).select().single()
  if (error) throw error
  await logAction({ action: 'chym.duplicate', entity: 'chym_sheets', entity_key: data.title, summary: `Лист «${sheet.title}» продублирован` })
  return data
}

export async function patchSheet(id, patch, { log } = {}) {
  const { data, error } = await supabase
    .from('chym_sheets')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  if (log) await logAction({ action: log.action, entity: 'chym_sheets', entity_key: data.title, summary: log.summary })
  return data
}

export async function deleteSheet(sheet) {
  const { error } = await supabase.from('chym_sheets').delete().eq('id', sheet.id)
  if (error) throw error
  await logAction({ action: 'chym.delete', entity: 'chym_sheets', entity_key: sheet.title, summary: `Лист «${sheet.title}» удалён` })
}

export async function reorderSheets(orderedIds) {
  // Persist new order; sequential to keep it simple (lists are small).
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('chym_sheets').update({ sort: i }).eq('id', orderedIds[i])
  }
}

// Content autosave (no log — fired on every debounced edit).
export async function saveContent(id, content) {
  const { error } = await supabase
    .from('chym_sheets')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

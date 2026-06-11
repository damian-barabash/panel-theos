// Faithful JS port of the in-game Theos advisor prompt assembly.
//
// The point: the panel test-chat must build the EXACT same request the game
// sends (`AiService.advisorTurn` + `AiClient.generateJson` in the Flutter app),
// so Theos sounds identical in the panel and in the app. The prompt *texts*
// (persona, advisor_instructions, turn instructions, negative rules, lore) come
// from the same Supabase tables the game reads (`ai_prompts` / `world_lore`);
// only the structural glue below is duplicated here — keep it byte-identical to:
//   APP_NO_NAME/lib/services/ai_service.dart        (advisorTurn, schemas)
//   APP_NO_NAME/lib/services/prompt_store.dart       (lore block format)
//   APP_NO_NAME/lib/data/ai_client.dart              (JSON system + extractor)
//   APP_NO_NAME/lib/providers/advisor_provider.dart  (_buildContext)
//   APP_NO_NAME/lib/data/models/character_class.dart  (titles, main stat)
//   APP_NO_NAME/lib/services/level_service.dart       (statSoftMax)
//   APP_NO_NAME/lib/services/template.dart            (renderTemplate)

// ── character_class.dart (2026-06 class update: 19 classes / 4 fractions) ────
export const CLASS_META = {
  knight: { title: 'Рыцарь', fraction: 'strength' },
  barbarian: { title: 'Варвар', fraction: 'strength' },
  berserk: { title: 'Берсерк', fraction: 'strength' },
  paladin: { title: 'Паладин', fraction: 'strength' },
  werewolf: { title: 'Оборотень', fraction: 'agility' },
  assassin: { title: 'Ассасин', fraction: 'agility' },
  bandit: { title: 'Разбойник', fraction: 'agility' },
  scoundrel: { title: 'Плут', fraction: 'agility' },
  shadow_blade: { title: 'Клинок тени', fraction: 'agility' },
  raider: { title: 'Рейдер', fraction: 'agility' },
  crusader: { title: 'Крестоносец', fraction: 'endurance' },
  war_priest: { title: 'Боевой жрец', fraction: 'endurance' },
  dark_knight: { title: 'Тёмный рыцарь', fraction: 'endurance' },
  monk: { title: 'Монах', fraction: 'endurance' },
  elementalist: { title: 'Элементалист', fraction: 'intellect' },
  necromancer: { title: 'Некромант', fraction: 'intellect' },
  shaman: { title: 'Шаман', fraction: 'intellect' },
  druid: { title: 'Друид', fraction: 'intellect' },
  healer: { title: 'Целитель', fraction: 'intellect' },
}

// Fraction → its stat key + Russian title (Fraction enum in Dart).
const FRACTION_STAT = { strength: 'strength', agility: 'agility', endurance: 'stamina', intellect: 'intellect' }
const FRACTION_RU = { strength: 'Сила', agility: 'Ловкость', endurance: 'Выносливость', intellect: 'Интеллект' }
const STAT_RU = { strength: 'Сила', intellect: 'Интеллект', agility: 'Ловкость', stamina: 'Выносливость' }

// CharacterClass.fromDb: legacy values map onto stand-ins; fallback = knight.
const LEGACY_MAP = { warrior: 'knight', mage: 'elementalist', archer: 'assassin', lancer: 'crusader' }
export function resolveClass(dbValue) {
  const key = LEGACY_MAP[dbValue] ?? dbValue
  return CLASS_META[key] ? key : 'knight'
}
export function classTitle(dbValue) { return CLASS_META[resolveClass(dbValue)].title }
export function classFraction(dbValue) { return CLASS_META[resolveClass(dbValue)].fraction }
export function classMainStat(dbValue) { return FRACTION_STAT[classFraction(dbValue)] }
export function fractionTitle(dbValue) { return FRACTION_RU[classFraction(dbValue)] }

// ── level_service.dart: statSoftMax(level) = 10 + level*0.8 (decimal scale) ──
export function statSoftMax(level) { return 10 + level * 0.8 }

// level_service.dart: fmtStat — one decimal, trailing '.0' trimmed.
export function fmtStat(v) {
  const s = Number(v).toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

// ── template.dart: replace every {{name}} for which a value is provided ──────
export function renderTemplate(template, vars) {
  return (template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole)
}

// Parse a task timestamp the way Dart's DateTime.parse does for our values:
// date-only ('YYYY-MM-DD') → LOCAL midnight; full ISO timestamptz → as given.
function parseDate(s) {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function sameLocalDate(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// ── advisor_provider.dart: _buildContext ─────────────────────────────────────
// `tasks` rows: { status, completed_at, created_at, due_date, plain_text, title }
export function buildContext(profile, tasks) {
  if (!profile) return 'Нет данных о носителе.'
  const list = tasks || []
  const today = new Date()
  const isToday = (d) => d != null && sameLocalDate(d, today)

  const doneToday = list.filter(
    (t) => t.status === 'done' && isToday(parseDate(t.completed_at))).length
  const pendingToday = list.filter(
    (t) => t.status === 'pending' && (t.due_date == null || isToday(parseDate(t.due_date)))).length
  const missedRecent = list.filter(
    (t) => t.status === 'missed' || t.status === 'skipped').length
  const recentDone = list
    .filter((t) => t.status === 'done')
    .sort((a, b) => {
      const da = parseDate(a.completed_at) || parseDate(a.created_at) || new Date(0)
      const db = parseDate(b.completed_at) || parseDate(b.created_at) || new Date(0)
      return db - da
    })
    .slice(0, 6)
    .map((t) => (t.plain_text && t.plain_text.length > 0) ? t.plain_text : t.title)

  const maxStat = statSoftMax(profile.level)
  const cls = profile.character_class
  // Gender.fromDb: только 'w' даёт женский, всё прочее (null) — мужской.
  const genderLine = profile.gender === 'w'
    ? 'женский (обращайся к носителю как к женщине)'
    : 'мужской'
  const lines = [
    `Имя: ${profile.name}`,
    `Пол: ${genderLine}`,
    `Класс: ${classTitle(cls)}, фракция ${fractionTitle(cls)} (главная стата — ${STAT_RU[classMainStat(cls)] ?? classMainStat(cls)})`,
    `Уровень: ${profile.level} (макс. стата сейчас ~${fmtStat(maxStat)})`,
    `Статы: Сила ${fmtStat(profile.strength)}, Интеллект ${fmtStat(profile.intellect)}, Ловкость ${fmtStat(profile.agility)}, Выносливость ${fmtStat(profile.stamina)}`,
    `Сегодня: выполнено ${doneToday}, осталось на сегодня ${pendingToday} задач`,
    `Невыполненных/пропущенных за всё время: ${missedRecent}`,
  ]
  if (recentDone.length === 0) {
    lines.push('Истории выполненных заданий пока нет (новичок).')
  } else {
    lines.push('Последние выполненные:')
    lines.push(recentDone.map((t) => `- ${t}`).join('\n'))
  }
  // StringBuffer.writeln leaves a trailing newline.
  return lines.join('\n') + '\n'
}

// ── ai_service.dart: advisorTurn history block ───────────────────────────────
// `history` items: { role: 'user' | 'assistant', content }
export function historyBlock(history) {
  if (!history || history.length === 0) return '(диалог только начинается)'
  return history
    .map((m) => `${m.role === 'user' ? 'Носитель' : 'Теос'}: ${m.content}`)
    .join('\n')
}

// ── prompt_store.dart: lore block ────────────────────────────────────────────
// `rows`: world_lore rows (enabled, ordered by sort asc). Empty → '' so
// `{{persona}}{{lore}}` stays byte-identical to persona alone.
export function buildLoreBlock(rows) {
  const parts = []
  for (const row of rows || []) {
    if (row.enabled === false) continue
    const title = (row.title ?? '').trim()
    const body = (row.body ?? '').trim()
    if (!title && !body) continue
    parts.push(`- ${title}: ${body}`)
  }
  if (parts.length === 0) return ''
  return '\n\nЗнание о мире (фон, не зачитывай дословно):\n' + parts.join('\n')
}

// ── ai_service.dart: schemas (key order matters for JSON parity) ─────────────
const TASK_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    plain_text: { type: 'string' },
    stat_targets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stat: { type: 'string', enum: ['strength', 'intellect', 'agility', 'stamina'] },
          amount: { type: 'integer' },
        },
        required: ['stat', 'amount'],
      },
    },
    xp_reward: { type: 'integer' },
    gold_reward: { type: 'integer' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'very_hard', 'extreme'] },
    is_negative: { type: 'boolean' },
    penalty: { type: 'integer' },
  },
  required: ['title', 'plain_text', 'stat_targets', 'xp_reward', 'gold_reward', 'difficulty'],
}

export const ADVISOR_TURN_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    create_task: { type: 'boolean' },
    task: TASK_SCHEMA,
  },
  required: ['message', 'create_task'],
}

// ── ai_client.dart: generateJson system message ──────────────────────────────
export function jsonGeneratorSystem(schema) {
  const schemaText = JSON.stringify(schema, null, 2)
  return 'Ты — строгий JSON-генератор. Верни ТОЛЬКО один валидный ' +
    'JSON-объект, точно соответствующий схеме ниже. Без markdown, без ' +
    'тройных кавычек, без пояснений и без любого текста до или после JSON. ' +
    'Не оборачивай ответ в ```. Все строки — на русском языке.\n\n' +
    'JSON-схема ответа (соблюдай типы и required-поля):\n' + schemaText
}

// ── ai_client.dart: _extractJsonObject ───────────────────────────────────────
export function extractJsonObject(raw) {
  let s = (raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[a-zA-Z]*/g, '')
    .replace(/```/g, '')

  const start = s.indexOf('{')
  if (start < 0) throw new Error('ИИ вернул ответ без JSON-объекта')

  let depth = 0, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
    } else {
      if (c === '"') inStr = true
      else if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) return JSON.parse(s.substring(start, i + 1))
      }
    }
  }
  throw new Error('ИИ вернул незакрытый JSON')
}

const TURN_KEY_BY_MODE = {
  firstMeeting: 'advisor_turn_first_meeting',
  insight: 'advisor_turn_insight',
  reply: 'advisor_turn_reply',
}

// Assembles the advisor user-prompt exactly like AiService.advisorTurn.
// `get(key)` returns the prompt body for an ai_prompts key.
export function buildAdvisorPrompt({ get, loreBlock, context, history, mode, userMessage = '' }) {
  const turnKey = TURN_KEY_BY_MODE[mode] || 'advisor_turn_reply'
  const turnInstruction = renderTemplate(get(turnKey), { user_message: userMessage })
  return renderTemplate(get('advisor_instructions'), {
    persona: get('theos_persona'),
    lore: loreBlock,
    context,
    history: historyBlock(history),
    turn_instruction: turnInstruction,
    negative_rules: get('negative_quest_rules'),
  })
}

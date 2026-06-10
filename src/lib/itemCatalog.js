// ─────────────────────────────────────────────────────────────────────────────
// Зеркало каталога предметов игры Theos (`lib/data/models/weapon.dart`).
//
// ⚠️ ПРАВИЛО: когда в игру добавляется новое оружие/зелье (в `WeaponCatalog`),
// продублируй его ЗДЕСЬ — тогда оно сразу доступно к выдаче в инвентарь игрока
// из вкладки «Игроки». Edge Function `panel-admin` принимает любой item_key,
// поэтому правится только этот файл (без передеплоя функции).
//
// Питомцы / еда / яйца — динамические (живут в БД: pet_species / pet_food /
// inventory_stacks), их сюда не вносим — панель тянет их из таблиц.
// ─────────────────────────────────────────────────────────────────────────────

export const RARITY = {
  common: { label: 'Обычное', color: '#B8C2C0', order: 0 },
  uncommon: { label: 'Необычное', color: '#7BD389', order: 1 },
  rare: { label: 'Редкое', color: '#5AB8D6', order: 2 },
  epic: { label: 'Эпическое', color: '#9B6BFF', order: 3 },
  legendary: { label: 'Легендарное', color: '#E8B547', order: 4 },
  mythic: { label: 'Мифическое', color: '#E25C5C', order: 5 },
}
export const rarityOf = (k) => RARITY[k] ?? RARITY.common

// kind: 'weapon' | 'potion'
export const ITEMS = [
  // ─── Оружие ───
  { key: 'sword_short', name: 'Меч странника', kind: 'weapon', rarity: 'common' },
  { key: 'dagger_iron', name: 'Железный кинжал', kind: 'weapon', rarity: 'common' },
  { key: 'hammer_field', name: 'Походный молот', kind: 'weapon', rarity: 'common' },
  { key: 'sword_long', name: 'Длинный клинок', kind: 'weapon', rarity: 'uncommon' },
  { key: 'axe_woodsman', name: 'Лесорубный топор', kind: 'weapon', rarity: 'uncommon' },
  { key: 'wand_novice', name: 'Жезл новика', kind: 'weapon', rarity: 'uncommon' },
  { key: 'sword_two_hand', name: 'Двуручный меч', kind: 'weapon', rarity: 'rare' },
  { key: 'hammer_heavy', name: 'Тяжёлый молот', kind: 'weapon', rarity: 'rare' },
  { key: 'wand_arcane', name: 'Жезл магистра', kind: 'weapon', rarity: 'rare' },
  { key: 'axe_battle', name: 'Боевой топор', kind: 'weapon', rarity: 'epic' },
  { key: 'mace_breaker', name: 'Сокрушитель', kind: 'weapon', rarity: 'epic' },
  { key: 'dagger_thief', name: 'Кинжал тени', kind: 'weapon', rarity: 'epic' },
  { key: 'sword_hero', name: 'Меч героя', kind: 'weapon', rarity: 'legendary' },
  { key: 'staff_archmage', name: 'Посох Архимага', kind: 'weapon', rarity: 'legendary' },
  { key: 'sword_dragon', name: 'Клинок Дракона', kind: 'weapon', rarity: 'mythic' },
  // ─── Зелья ───
  { key: 'potion_health_minor', name: 'Малое зелье жизни', kind: 'potion', rarity: 'common' },
  { key: 'potion_mana_minor', name: 'Малое зелье магии', kind: 'potion', rarity: 'common' },
  { key: 'potion_swift', name: 'Зелье ловкости', kind: 'potion', rarity: 'uncommon' },
  { key: 'potion_berserker', name: 'Зелье берсерка', kind: 'potion', rarity: 'rare' },
  { key: 'potion_sage', name: 'Зелье мудреца', kind: 'potion', rarity: 'epic' },
  { key: 'elixir_immortal', name: 'Эликсир бессмертия', kind: 'potion', rarity: 'legendary' },
]

// Стартовое оружие (выдаётся по умолчанию, не продаётся) — только для подписи.
export const FISTS = { key: 'fists', name: 'Голые кулаки', kind: 'weapon', rarity: 'common' }

const BY_KEY = Object.fromEntries([...ITEMS, FISTS].map((i) => [i.key, i]))
export const itemByKey = (key) => BY_KEY[key] ?? { key, name: key, kind: 'weapon', rarity: 'common' }

export const CLASS_LABEL = {
  warrior: 'Воин',
  mage: 'Маг',
  archer: 'Лучник',
  lancer: 'Копейщик',
}

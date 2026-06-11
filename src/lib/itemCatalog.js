// ─────────────────────────────────────────────────────────────────────────────
// Статический каталог предметов игры — после гир-апдейта 2026-06 здесь
// остались только особые расходники из кода игры (`special_items.dart`).
//
// Оружие и броня теперь ДИНАМИЧЕСКИЕ (таблицы weapon_items / armor_sets +
// armor_pieces) — добавляются во вкладке «Броня и оружие», выдаются игрокам
// из вкладки «Игроки» через panel-admin (give_gear/remove_gear, user_items).
// Старое правило «добавил предмет в weapon.dart → продублируй здесь» умерло
// вместе со статическим каталогом.
//
// Питомцы / еда / яйца — тоже динамика (pet_species / pet_food /
// inventory_stacks).
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

// kind: 'potion' (особые расходники в таблице `inventory`)
export const ITEMS = [
  // Зелье смены класса: продаётся в магазине за кристаллы
  // (app_config.class_potion_shop_gems), дроп золотого сундука ~0.02% и
  // изумрудного ~2%. Выпил → заново выбирает фракцию/класс/пол/причёску.
  // У игрока может быть максимум 1.
  { key: 'potion_class_change', name: 'Зелье смены класса', kind: 'potion', rarity: 'legendary' },
]

// Стартовое «оружие» (голые руки) — только для подписи в инвентаре.
export const FISTS = { key: 'fists', name: 'Голые кулаки', kind: 'weapon', rarity: 'common' }

const BY_KEY = Object.fromEntries([...ITEMS, FISTS].map((i) => [i.key, i]))
export const itemByKey = (key) => BY_KEY[key] ?? { key, name: key, kind: 'weapon', rarity: 'common' }

export const CLASS_LABEL = {
  // Legacy (до класс-апдейта 2026-06) — видны, пока игрок не перевыбрал класс.
  warrior: 'Воин (стар.)',
  mage: 'Маг (стар.)',
  archer: 'Лучник (стар.)',
  lancer: 'Копейщик (стар.)',
  // Сила
  knight: 'Рыцарь',
  barbarian: 'Варвар',
  berserk: 'Берсерк',
  paladin: 'Паладин',
  // Ловкость
  werewolf: 'Оборотень',
  assassin: 'Ассасин',
  bandit: 'Разбойник',
  scoundrel: 'Плут',
  shadow_blade: 'Клинок тени',
  raider: 'Рейдер',
  // Выносливость
  crusader: 'Крестоносец',
  war_priest: 'Боевой жрец',
  dark_knight: 'Тёмный рыцарь',
  monk: 'Монах',
  // Интеллект
  elementalist: 'Элементалист',
  necromancer: 'Некромант',
  shaman: 'Шаман',
  druid: 'Друид',
  healer: 'Целитель',
}

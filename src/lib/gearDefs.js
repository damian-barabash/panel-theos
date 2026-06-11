// ─────────────────────────────────────────────────────────────────────────────
// Зеркало справочников экипировки игры (`lib/data/models/gear.dart`).
// Ключи jsonb-полей (stats/attrs/effects) и подписи должны совпадать с игрой —
// иначе игра не покажет введённую панелью характеристику.
// ─────────────────────────────────────────────────────────────────────────────

export const RARITIES = [
  { key: 'common', label: 'Обычное', color: '#B8C2C0' },
  { key: 'uncommon', label: 'Необычное', color: '#7BD389' },
  { key: 'rare', label: 'Редкое', color: '#5AB8D6' },
  { key: 'epic', label: 'Эпическое', color: '#9B6BFF' },
  { key: 'legendary', label: 'Легендарное', color: '#E8B547' },
  { key: 'mythic', label: 'Мифическое', color: '#E25C5C' },
]
export const rarityOf = (k) => RARITIES.find((r) => r.key === k) ?? RARITIES[0]

export const FRACTIONS = [
  { key: 'strength', label: 'Сила (Воин)' },
  { key: 'agility', label: 'Ловкость (Вор)' },
  { key: 'endurance', label: 'Выносливость (Охотник)' },
  { key: 'intellect', label: 'Интеллект (Маг)' },
]
export const fractionLabel = (k) =>
  k ? (FRACTIONS.find((f) => f.key === k)?.label ?? k) : 'любая'

export const ARMOR_SLOTS = [
  { key: 'helmet', label: 'Шлем' }, // ряд 0 листа
  { key: 'chest', label: 'Нагрудник' }, // ряд 1
  { key: 'legs', label: 'Поножи' }, // ряд 2
]

export const STAT_KEYS = [
  { key: 'strength', label: '+ Сила' },
  { key: 'agility', label: '+ Ловкость' },
  { key: 'stamina', label: '+ Выносливость' },
  { key: 'intellect', label: '+ Интеллект' },
]

// Характеристики брони (attrs jsonb).
export const ARMOR_ATTRS = [
  { key: 'crit_chance', label: 'Шанс крита, %' },
  { key: 'crit_damage', label: 'Урон крита, %' },
  { key: 'dodge', label: 'Уклонение, %' },
  { key: 'block_chance', label: 'Шанс блока, %' },
  { key: 'block_power', label: 'Сила блока' },
  { key: 'attack_speed', label: 'Скорость атаки, %' },
  { key: 'cast_speed', label: 'Скорость каста, %' },
  { key: 'resist_fire', label: 'Сопр. огню, %' },
  { key: 'resist_ice', label: 'Сопр. льду, %' },
  { key: 'resist_lightning', label: 'Сопр. молнии, %' },
  { key: 'resist_poison', label: 'Сопр. яду, %' },
  { key: 'resist_dark', label: 'Сопр. тьме, %' },
  { key: 'resist_holy', label: 'Сопр. свету, %' },
]

// Особые эффекты брони (effects jsonb).
export const ARMOR_EFFECTS = [
  { key: 'hp_regen', label: 'Реген. здоровья / сек' },
  { key: 'mana_regen', label: 'Реген. маны / сек' },
  { key: 'life_steal', label: 'Вампиризм, %' },
  { key: 'thorns', label: 'Шипы' },
  { key: 'tenacity', label: 'Стойкость, %' },
  { key: 'threat', label: 'Агрессия, %' },
  { key: 'healing_bonus', label: 'Бонус лечения, %' },
  { key: 'shield_bonus', label: 'Бонус щитов, %' },
]

export const WEAPON_TYPES = [
  { key: 'sword', label: 'Меч' },
  { key: 'dagger', label: 'Кинжал' },
  { key: 'axe', label: 'Топор' },
  { key: 'mace', label: 'Булава' },
  { key: 'hammer', label: 'Молот' },
  { key: 'spear', label: 'Копьё' },
  { key: 'bow', label: 'Лук' },
  { key: 'staff', label: 'Посох' },
  { key: 'wand', label: 'Жезл' },
  { key: 'tome', label: 'Фолиант' },
  { key: 'orb', label: 'Сфера' },
  { key: 'thrown', label: 'Метательное' },
]

export const WEAPON_ELEMENTS = [
  { key: 'physical', label: 'Физический', color: '#B8C2C0' },
  { key: 'fire', label: 'Огонь', color: '#E25C5C' },
  { key: 'ice', label: 'Лёд', color: '#5AB8D6' },
  { key: 'lightning', label: 'Молния', color: '#E8B547' },
  { key: 'poison', label: 'Яд', color: '#7BD389' },
  { key: 'dark', label: 'Тьма', color: '#9B6BFF' },
  { key: 'holy', label: 'Свет', color: '#F2EAD3' },
]

// Характеристики оружия (attrs jsonb; урон и скорость атаки — колонки).
export const WEAPON_ATTRS = [
  { key: 'weapon_power', label: 'Сила оружия' },
  { key: 'crit_chance', label: 'Шанс крита, %' },
  { key: 'crit_damage', label: 'Урон крита, %' },
  { key: 'accuracy', label: 'Точность, %' },
  { key: 'armor_pen', label: 'Пробивание брони, %' },
  { key: 'elemental_damage', label: 'Стихийный урон' },
  { key: 'life_steal', label: 'Вампиризм, %' },
  { key: 'mana_steal', label: 'Похищение маны, %' },
  { key: 'bleed_chance', label: 'Шанс кровотечения, %' },
  { key: 'poison_chance', label: 'Шанс яда, %' },
]

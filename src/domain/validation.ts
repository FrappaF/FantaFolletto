import type { Diary } from './model'

const text = (value: unknown, max: number, required = true): boolean =>
  typeof value === 'string' &&
  (!required || value.trim().length > 0) &&
  value.length <= max
const number = (value: unknown, min: number, max: number): boolean =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max
export const validDate = (value: unknown): boolean =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
export const validDay = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  value >= '0001-01-01' &&
  validDate(value) &&
  new Date(value).toISOString().slice(0, 10) === value
const uniqueIds = (values: { id: string }[]) =>
  new Set(values.map((item) => item.id)).size === values.length

export function parseDiary(value: unknown): Diary {
  const state = value as Diary
  const valid =
    state?.schemaVersion === 1 &&
    (state.pointBalance === undefined ||
      (state.pointBalance &&
        number(
          state.pointBalance.current,
          -Number.MAX_SAFE_INTEGER,
          Number.MAX_SAFE_INTEGER,
        ) &&
        number(state.pointBalance.maximum, 0, Number.MAX_SAFE_INTEGER))) &&
    Array.isArray(state.events) &&
    Array.isArray(state.entries) &&
    Array.isArray(state.rewards) &&
    state.events.every(
      (item) =>
        item &&
        text(item.id, 100) &&
        text(item.name, 60) &&
        text(item.description, 180, false) &&
        number(item.points, -1000, 1000) &&
        number(item.version, 1, Number.MAX_SAFE_INTEGER) &&
        typeof item.archived === 'boolean' &&
        (item.categoryId === undefined || text(item.categoryId, 100)) &&
        (item.rarity === undefined ||
          ['normal', 'rare', 'legendary'].includes(item.rarity)) &&
        (item.repeat === undefined ||
          ['unlimited', 'daily'].includes(item.repeat)),
    ) &&
    state.rewards.every(
      (item) =>
        item &&
        text(item.id, 100) &&
        text(item.name, 60) &&
        text(item.description, 180, false) &&
        number(item.target, 1, 100000) &&
        ['week', 'all'].includes(item.period) &&
        typeof item.archived === 'boolean',
    ) &&
    (state.pledges === undefined ||
      (Array.isArray(state.pledges) &&
        state.pledges.every(
          (item) =>
            item &&
            text(item.id, 100) &&
            text(item.name, 60) &&
            text(item.description, 180, false) &&
            number(item.target, 1, 100000) &&
            ['week', 'month'].includes(item.period) &&
            number(item.version, 1, Number.MAX_SAFE_INTEGER) &&
            typeof item.archived === 'boolean' &&
            validDay(item.effectiveFrom) &&
            (item.period === 'month'
              ? item.effectiveFrom.endsWith('-01')
              : new Date(`${item.effectiveFrom}T12:00:00Z`).getUTCDay() === 1),
        ) &&
        new Set(state.pledges.map((item) => `${item.id}:${item.version}`))
          .size === state.pledges.length &&
        state.pledges.every((item) =>
          state.pledges!.every(
            (other) => other.id !== item.id || other.period === item.period,
          ),
        ))) &&
    (state.pledgeClaims === undefined ||
      (Array.isArray(state.pledgeClaims) &&
        state.pledgeClaims.every(
          (item) =>
            item &&
            text(item.id, 100) &&
            text(item.pledgeId, 100) &&
            text(item.name, 60) &&
            text(item.description, 180, false) &&
            number(item.target, 1, 100000) &&
            ['week', 'month'].includes(item.period) &&
            number(item.pledgeVersion, 1, Number.MAX_SAFE_INTEGER) &&
            validDay(item.periodKey) &&
            number(
              item.points,
              -Number.MAX_SAFE_INTEGER,
              Number.MAX_SAFE_INTEGER,
            ) &&
            validDate(item.redeemedAt) &&
            typeof item.needsReview === 'boolean',
        ) &&
        uniqueIds(state.pledgeClaims) &&
        new Set(
          state.pledgeClaims.map(
            (item) => `${item.pledgeId}:${item.periodKey}`,
          ),
        ).size === state.pledgeClaims.length)) &&
    state.entries.every(
      (item) =>
        item &&
        text(item.id, 100) &&
        text(item.eventId, 100) &&
        text(item.name, 60) &&
        number(item.points, -1000, 20000) &&
        number(item.eventVersion, 1, Number.MAX_SAFE_INTEGER) &&
        validDate(item.occurredAt) &&
        (item.voidedAt === undefined || validDate(item.voidedAt)) &&
        (item.sync === undefined || ['pending', 'error'].includes(item.sync)) &&
        (item.basePoints === undefined ||
          number(item.basePoints, -1000, 1000)) &&
        (item.bonusPoints === undefined ||
          number(item.bonusPoints, 0, 19000)) &&
        (item.comboIndex === undefined ||
          number(item.comboIndex, 1, Number.MAX_SAFE_INTEGER)) &&
        (item.scoringVersion === undefined ||
          number(item.scoringVersion, 1, Number.MAX_SAFE_INTEGER)),
    ) &&
    (state.awards === undefined ||
      (Array.isArray(state.awards) &&
        state.awards.every(
          (item) =>
            item &&
            text(item.id, 100) &&
            text(item.rewardId, 100) &&
            text(item.name, 60) &&
            text(item.description, 180, false) &&
            number(item.target, 1, 100000) &&
            ['all', 'week'].includes(item.period) &&
            text(item.periodKey, 10) &&
            validDate(item.achievedAt) &&
            (item.redeemedAt === undefined ||
              (validDate(item.redeemedAt) &&
                item.pointsSpent === item.target)) &&
            (item.pointsSpent === undefined ||
              (number(item.pointsSpent, 1, 100000) &&
                validDate(item.redeemedAt))) &&
            (item.rewardVersion === undefined ||
              number(item.rewardVersion, 1, Number.MAX_SAFE_INTEGER)) &&
            (item.revokedAt === undefined || validDate(item.revokedAt)) &&
            (item.deliveredAt === undefined || validDate(item.deliveredAt)) &&
            typeof item.needsReview === 'boolean',
        ))) &&
    (state.combos === undefined ||
      (Array.isArray(state.combos) &&
        state.combos.every(
          (item) =>
            item &&
            text(item.id, 100) &&
            text(item.firstSurname, 60) &&
            text(item.secondSurname, 60, false) &&
            text(item.note, 180, false) &&
            validDate(item.createdAt) &&
            (item.removedAt === undefined || validDate(item.removedAt)) &&
            (item.sync === undefined ||
              ['pending', 'error'].includes(item.sync)),
        ) &&
        uniqueIds(state.combos))) &&
    (state.notes === undefined ||
      (Array.isArray(state.notes) &&
        state.notes.every(
          (item) =>
            item &&
            text(item.id, 100) &&
            validDay(item.day) &&
            text(item.text, 2000) &&
            validDate(item.createdAt) &&
            (item.removedAt === undefined || validDate(item.removedAt)) &&
            (item.sync === undefined ||
              ['pending', 'error'].includes(item.sync)),
        ) &&
        uniqueIds(state.notes))) &&
    (state.categories === undefined ||
      (Array.isArray(state.categories) &&
        uniqueIds(state.categories) &&
        state.categories.every(
          (item) =>
            item &&
            text(item.id, 100) &&
            text(item.name, 60) &&
            text(item.icon, 16) &&
            number(item.order, 0, 1000),
        ))) &&
    (state.scoringRules === undefined ||
      (Array.isArray(state.scoringRules) &&
        new Set(state.scoringRules.map((rule) => rule.version)).size ===
          state.scoringRules.length &&
        state.scoringRules.every(
          (rule) =>
            rule &&
            number(rule.version, 1, Number.MAX_SAFE_INTEGER) &&
            /^\d{4}-\d{2}-\d{2}$/.test(rule.effectiveDay) &&
            validDate(rule.effectiveDay) &&
            number(rule.incrementPercent, 0, 1000) &&
            typeof rule.maxMultiplier === 'number' &&
            rule.maxMultiplier >= 1 &&
            rule.maxMultiplier <= 20 &&
            Math.abs(
              rule.maxMultiplier * 10 - Math.round(rule.maxMultiplier * 10),
            ) < 1e-8,
        ))) &&
    uniqueIds(state.events) &&
    uniqueIds(state.rewards) &&
    uniqueIds(state.entries)
  if (!valid)
    throw new Error(
      'Il diario salvato non è compatibile. I dati sono stati conservati: non cancellare lo spazio del sito.',
    )
  return state
}

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
        typeof item.archived === 'boolean',
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
    state.entries.every(
      (item) =>
        item &&
        text(item.id, 100) &&
        text(item.eventId, 100) &&
        text(item.name, 60) &&
        number(item.points, -1000, 1000) &&
        number(item.eventVersion, 1, Number.MAX_SAFE_INTEGER) &&
        validDate(item.occurredAt) &&
        (item.voidedAt === undefined || validDate(item.voidedAt)) &&
        (item.sync === undefined || ['pending', 'error'].includes(item.sync)),
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
    uniqueIds(state.events) &&
    uniqueIds(state.rewards) &&
    uniqueIds(state.entries)
  if (!valid)
    throw new Error(
      'Il diario salvato non è compatibile. I dati sono stati conservati: non cancellare lo spazio del sito.',
    )
  return state
}

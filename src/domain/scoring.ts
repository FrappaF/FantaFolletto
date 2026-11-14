import type {
  Diary,
  Entry,
  EventCategory,
  EventDefinition,
  ScoringRule,
} from './model'
import { dayKey } from './stats'

export const defaultCategories: EventCategory[] = [
  { id: 'encounters', name: 'Incontri e gentilezze', icon: '☕', order: 1 },
  { id: 'animals', name: 'Animali di casa', icon: '🐾', order: 2 },
  { id: 'wins', name: 'Piccole vittorie', icon: '💚', order: 3 },
  { id: 'mishaps', name: 'Imprevisti e scene buffe', icon: '😅', order: 4 },
  { id: 'incredible', name: 'Incontri incredibili', icon: '🦄', order: 5 },
  { id: 'challenges', name: 'Sfide', icon: '🏆', order: 6 },
]
export const rarityLabels = {
  normal: 'Normale',
  rare: 'Raro',
  legendary: 'Leggendario',
}
export const categoriesFor = (diary: Diary) =>
  diary.categories ?? defaultCategories
export function nextRomeDay(at: Date) {
  const date = new Date(`${dayKey(at)}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
export function ruleFor(
  diary: Diary,
  at: string | Date,
): ScoringRule | undefined {
  const day = dayKey(at)
  return [...(diary.scoringRules ?? [])]
    .filter((rule) => rule.effectiveDay <= day)
    .sort(
      (a, b) =>
        b.effectiveDay.localeCompare(a.effectiveDay) || b.version - a.version,
    )[0]
}
export function comboPoints(base: number, index: number, rule?: ScoringRule) {
  if (base <= 0 || !rule) return base
  // Integer hundredths match PostgreSQL numeric rounding, including half points.
  const percent = Math.min(
    Math.round(rule.maxMultiplier * 100),
    100 + (index - 1) * rule.incrementPercent,
  )
  return Math.floor((base * percent + 50) / 100)
}
export function previewEvent(
  diary: Diary,
  event: EventDefinition,
  at: string | Date,
) {
  const index =
    diary.entries.filter(
      (entry) =>
        entry.eventId === event.id &&
        !entry.voidedAt &&
        entry.sync !== 'error' &&
        dayKey(entry.occurredAt) === dayKey(at),
    ).length + 1
  const rule = ruleFor(diary, at)
  const points =
    event.repeat === 'daily'
      ? event.points
      : comboPoints(event.points, index, rule)
  return {
    available: event.repeat !== 'daily' || index === 1,
    entry: {
      basePoints: event.points,
      points,
      comboIndex: index,
      bonusPoints: points - event.points,
      scoringVersion: event.repeat === 'daily' ? undefined : rule?.version,
    },
  }
}
// Settings are historical snapshots. Only reordering/voids change a day's combo positions.
// Legacy entries without scoringVersion always retain their original points.
export function recalculateCombos<T extends Diary>(diary: T): T {
  const counters = new Map<string, number>()
  const calculated = new Map<string, Entry>()
  for (const entry of [...diary.entries].sort(
    (a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
      a.id.localeCompare(b.id),
  )) {
    if (entry.voidedAt || entry.sync === 'error') continue
    const key = `${entry.eventId}:${dayKey(entry.occurredAt)}`
    const index = (counters.get(key) ?? 0) + 1
    counters.set(key, index)
    if (entry.scoringVersion === undefined) continue
    const rule = diary.scoringRules?.find(
      (rule) => rule.version === entry.scoringVersion,
    )
    if (!rule || entry.basePoints === undefined) continue
    const points = comboPoints(entry.basePoints, index, rule)
    calculated.set(entry.id, {
      ...entry,
      points,
      comboIndex: index,
      bonusPoints: points - entry.basePoints,
    })
  }
  return {
    ...diary,
    entries: diary.entries.map((entry) => calculated.get(entry.id) ?? entry),
  }
}

export function formatRuleDay(day: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  }).format(new Date(`${day}T12:00:00Z`))
}

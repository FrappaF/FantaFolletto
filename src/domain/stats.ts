import type { Diary, Entry, Reward } from './model'
import { redemptionProgress } from './rewards'

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function dayKey(instant: string | Date): string {
  const parts = dayFormatter.formatToParts(new Date(instant))
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-')
}

export function weekKey(instant: string | Date): string {
  const date = new Date(`${dayKey(instant)}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

export const activeEntries = (state: Diary) =>
  state.entries.filter((entry) => !entry.voidedAt && entry.sync !== 'error')
export const sumPoints = (entries: Entry[]) =>
  entries.reduce((sum, entry) => sum + entry.points, 0)

export function statistics(state: Diary, now: Date) {
  const entries = activeEntries(state)
  const today = entries.filter(
    (entry) => dayKey(entry.occurredAt) === dayKey(now),
  )
  const week = entries.filter(
    (entry) => weekKey(entry.occurredAt) === weekKey(now),
  )
  return {
    today: sumPoints(today),
    week: sumPoints(week),
    total: sumPoints(entries),
    countToday: today.length,
    days: new Set(entries.map((entry) => dayKey(entry.occurredAt))).size,
  }
}

export function rankings(state: Diary, period: 'day' | 'week') {
  const groups = new Map<string, number>()
  for (const entry of activeEntries(state)) {
    const key =
      period === 'day' ? dayKey(entry.occurredAt) : weekKey(entry.occurredAt)
    groups.set(key, (groups.get(key) ?? 0) + entry.points)
  }
  return [...groups]
    .map(([date, points]) => ({ date, points }))
    .sort((a, b) => b.points - a.points || b.date.localeCompare(a.date))
}

export function rewardProgress(state: Diary, reward: Reward, now: Date) {
  const progress = redemptionProgress(state, reward, now)
  return { ...progress, reached: progress.available || progress.claimed }
}

export function formatDay(date: string, long = false) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: 'numeric',
    month: long ? 'long' : 'short',
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date))
}

export function pointsLabel(points: number) {
  return `${points > 0 ? '+' : ''}${points}`
}

import { afterEach, expect, it, vi } from 'vitest'
import { applyCommand, initialDiary, type Diary, type Pledge } from './model'
import { latestPledges, nextPeriodStart, periodStart, pledgeOccurrences } from './pledges'
import { parseDiary } from './validation'

const pledge: Pledge = {
  id: 'breakfast-for-you',
  name: 'La colazione la offri tu',
  description: 'Un cappuccino insieme',
  target: 100,
  period: 'week',
  version: 1,
  archived: false,
  effectiveFrom: '2026-11-09',
}
const diary = (): Diary => ({ ...initialDiary(), pledges: [pledge] })
const monday = new Date('2026-11-15T23:00:00Z')
const claim = {
  type: 'redeem-pledge',
  id: 'collection',
  pledgeId: pledge.id,
  expectedVersion: 1,
  periodKey: '2026-11-09',
  at: monday.toISOString(),
} as const
afterEach(() => vi.useRealTimers())

it('usa settimane italiane, mesi interi, anno bisestile e cambi di ora', () => {
  expect(periodStart('week', '2026-11-15T22:59:59Z')).toBe('2026-11-09')
  expect(periodStart('week', monday)).toBe('2026-11-16')
  expect(periodStart('month', '2026-11-30T23:00:00Z')).toBe('2026-12-01')
  expect(nextPeriodStart('month', '2026-12-15')).toBe('2027-01-01')
  expect(nextPeriodStart('week', '2026-03-29T01:30:00Z')).toBe('2026-03-30')
  expect(nextPeriodStart('week', '2026-10-25T01:30:00Z')).toBe('2026-10-26')
  const monthly: Diary = { ...diary(), pledges: [{ ...pledge, period: 'month', effectiveFrom: '2028-02-01' }] }
  expect(pledgeOccurrences(monthly, new Date('2028-03-01'))[0]).toMatchObject({
    periodKey: '2028-02-01', endDay: '2028-02-29', status: 'due',
  })
})

it('conta punti confermati del periodo e ignora spesa premi, dati pendenti e annullati', () => {
  const state = diary()
  state.entries = [
    { id: 'earned', eventId: 'coffee', eventVersion: 1, name: 'Caffè', points: 100, occurredAt: '2026-11-14T12:00:00Z' },
    { id: 'pending', eventId: 'coffee', eventVersion: 1, name: 'Caffè', points: 50, occurredAt: '2026-11-14T12:00:00Z', sync: 'pending' },
    { id: 'error', eventId: 'coffee', eventVersion: 1, name: 'Caffè', points: 50, occurredAt: '2026-11-14T12:00:00Z', sync: 'error' },
    { id: 'voided', eventId: 'coffee', eventVersion: 1, name: 'Caffè', points: 50, occurredAt: '2026-11-14T12:00:00Z', voidedAt: '2026-11-15T12:00:00Z' },
    { id: 'older', eventId: 'coffee', eventVersion: 1, name: 'Caffè', points: 1000, occurredAt: '2026-11-08T12:00:00Z' },
  ]
  state.pointBalance = { current: 0, maximum: 100 }
  const earned = pledgeOccurrences(state, monday)[0]
  expect(earned).toMatchObject({ points: 100, status: 'avoided', remaining: 0, percent: 100 })
  expect(() => applyCommand(state, claim)).toThrow(/quota non raggiunta/)
  const withoutPending = { ...state, entries: state.entries.filter((entry) => entry.id !== 'earned') }
  expect(pledgeOccurrences(withoutPending, monday)[0]).toMatchObject({ points: 0, status: 'due' })
})

it('riscuote soltanto periodi chiusi, una sola volta, senza spendere punti', () => {
  const state = diary()
  expect(() => applyCommand(state, { ...claim, at: '2026-11-15T22:59:59Z' })).toThrow(/periodo concluso/)
  expect(() => applyCommand(state, { ...claim, expectedVersion: 2 })).toThrow(/cambiato/)
  let collected = applyCommand(state, claim)
  expect(collected.pointBalance).toEqual({ current: 0, maximum: 0 })
  expect(collected.pledgeClaims?.[0]).toMatchObject({ name: pledge.name, target: 100, points: 0, pledgeVersion: 1 })
  expect(applyCommand(collected, claim)).toEqual(collected)
  expect(() => applyCommand(collected, { ...claim, periodKey: '2026-11-02' })).toThrow(/Identificativo/)
  expect(() => applyCommand(collected, { ...claim, id: 'another' })).toThrow(/già riscosso/)
  collected = { ...collected, pledges: [...collected.pledges!, { ...pledge, version: 2, effectiveFrom: '2026-11-16', archived: true }] }
  expect(applyCommand(collected, claim).pledgeClaims).toHaveLength(1)
})

it('salva modifiche e archivi dal prossimo periodo senza cambiare condizioni passate', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))
  const save = { type: 'save-pledge', expectedVersion: 1, value: { ...pledge, name: 'Nuovo pegno', target: 200 } } as const
  let state = applyCommand(diary(), save)
  expect(latestPledges(state)[0]).toMatchObject({ version: 2, target: 200, effectiveFrom: '2026-11-16' })
  expect(pledgeOccurrences(state, new Date())[0].pledge.target).toBe(100)
  expect(pledgeOccurrences(state, new Date())[1]).toMatchObject({ status: 'upcoming', pledge: { target: 200 } })
  state = applyCommand(state, { ...save, expectedVersion: 2, value: { ...save.value, target: 250 } })
  expect(pledgeOccurrences(state, monday).find((item) => item.periodKey === '2026-11-16')?.pledge.target).toBe(250)
  expect(() => applyCommand(state, save)).toThrow(/cambiato/)
  expect(() => applyCommand(state, { ...save, expectedVersion: 3, value: { ...save.value, period: 'month' } })).toThrow(/periodicità/)
  state = applyCommand(state, { type: 'archive-pledge', id: pledge.id, expectedVersion: 3 })
  expect(pledgeOccurrences(state, monday)).toHaveLength(1)
  expect(pledgeOccurrences(state, monday)[0]).toMatchObject({ status: 'due', pledge: { name: pledge.name, target: 100 } })
  expect(applyCommand(state, claim).pledgeClaims?.[0].name).toBe(pledge.name)
})

it('crea pegni futuri visibili e conserva le riscossioni dopo un invio tardivo', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))
  const created = applyCommand(initialDiary(), { type: 'save-pledge', value: pledge, expectedVersion: 0 })
  expect(pledgeOccurrences(created, new Date())).toHaveLength(1)
  expect(pledgeOccurrences(created, new Date())[0]).toMatchObject({ status: 'upcoming', periodKey: '2026-11-16' })
  let collected = applyCommand(diary(), claim)
  collected = applyCommand(collected, { type: 'record', id: 'late', eventId: 'coffee', at: '2026-11-14T12:00:00Z' })
  expect(collected.pledgeClaims?.[0].needsReview).toBe(false)
  collected = { ...collected, events: collected.events.map((event) => event.id === 'pet' ? { ...event, points: 100 } : event) }
  collected = applyCommand(collected, { type: 'record', id: 'late-2', eventId: 'pet', at: '2026-11-14T12:00:00Z' })
  expect(collected.pledgeClaims?.[0]).toMatchObject({ points: 0, needsReview: true })
  expect(pledgeOccurrences(collected, monday)[0]).toMatchObject({ status: 'collected', needsReview: true, points: 110 })
  collected = applyCommand(collected, { type: 'void', id: 'late-2', at: monday.toISOString() })
  expect(collected.pledgeClaims?.[0]).toMatchObject({ points: 0, needsReview: false })
})

it('legge i diari precedenti e valida versioni e riscossioni senza duplicati', () => {
  expect(parseDiary(initialDiary())).toEqual(initialDiary())
  expect(parseDiary(applyCommand(diary(), claim)).pledgeClaims).toHaveLength(1)
  for (const pledges of [
    [{ ...pledge, effectiveFrom: '2026-11-10' }],
    [pledge, pledge],
    [pledge, { ...pledge, version: 2, period: 'month', effectiveFrom: '2026-12-01' }],
    [{ ...pledge, target: 0 }],
  ]) expect(() => parseDiary({ ...diary(), pledges })).toThrow(/compatibile/)
  const collected = applyCommand(diary(), claim)
  expect(() => parseDiary({ ...collected, pledgeClaims: [collected.pledgeClaims![0], { ...collected.pledgeClaims![0], id: 'duplicate' }] })).toThrow(/compatibile/)
})

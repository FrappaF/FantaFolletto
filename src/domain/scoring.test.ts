import { describe, expect, it } from 'vitest'
import { applyCommand, initialDiary, type Diary } from './model'
import {
  comboPoints,
  nextRomeDay,
  previewEvent,
  recalculateCombos,
  ruleFor,
} from './scoring'
import { parseDiary } from './validation'
import { projectDiary } from '../remote/types'

const at = '2026-11-14T10:00:00Z'
function record(state: Diary, id: string, time = at, eventId = 'coffee') {
  return applyCommand(state, { type: 'record', id, eventId, at: time })
}
describe('combo giornaliera e compatibilità', () => {
  it('cresce sui punti base, arrotonda e rispetta un tetto modificabile', () => {
    const rule = {
      version: 1,
      effectiveDay: '2026-01-01',
      incrementPercent: 20,
      maxMultiplier: 1.5,
    }
    expect(
      [1, 2, 3, 4, 50].map((index) => comboPoints(10, index, rule)),
    ).toEqual([10, 12, 14, 15, 15])
    expect(comboPoints(5, 2, { ...rule, incrementPercent: 10 })).toBe(6)
    expect(
      comboPoints(15, 2, { ...rule, incrementPercent: 310, maxMultiplier: 5 }),
    ).toBe(62)
    expect(comboPoints(-10, 50, rule)).toBe(-10)
    expect(comboPoints(10, 50, { ...rule, incrementPercent: 0 })).toBe(10)
  })
  it('separa eventi e giorni italiani, anche al cambio di ora', () => {
    let state = record(initialDiary(), 'a', '2026-10-25T00:30:00Z')
    state = record(state, 'b', '2026-10-25T01:30:00Z')
    state = record(state, 'c', '2026-10-25T02:30:00Z', 'pet')
    state = record(state, 'd', '2026-10-25T23:01:00Z')
    expect(state.entries.map((entry) => entry.points)).toEqual([10, 12, 15, 10])
    expect(nextRomeDay(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-30')
  })
  it('ricalcola dopo invii fuori ordine e annullamenti, senza duplicare', () => {
    let state = record(initialDiary(), 'later', '2026-11-14T11:00:00Z')
    state = record(state, 'earlier')
    expect(state.entries.map((entry) => entry.points)).toEqual([12, 10])
    expect(record(state, 'earlier').entries).toHaveLength(2)
    state = applyCommand(state, { type: 'void', id: 'earlier', at })
    expect(state.entries[0]).toMatchObject({
      points: 10,
      comboIndex: 1,
      bonusPoints: 0,
    })
    expect(state.entries[1].voidedAt).toBe(at)
  })
  it('le regole future non riscrivono quelle degli episodi e i dati precedenti restano leggibili', () => {
    const state = record(initialDiary(), 'a')
    state.scoringRules!.push({
      version: 2,
      effectiveDay: '2026-11-15',
      incrementPercent: 100,
      maxMultiplier: 5,
    })
    expect(ruleFor(state, at)?.version).toBe(1)
    expect(record(state, 'b').entries[1].points).toBe(12)
    expect(ruleFor(state, '2026-11-15T10:00:00Z')?.version).toBe(2)
    const legacy = {
      ...state,
      scoringRules: undefined,
      categories: undefined,
      entries: [
        {
          id: 'old',
          eventId: 'coffee',
          eventVersion: 1,
          name: 'Vecchio episodio',
          points: 123,
          occurredAt: at,
        },
      ],
    }
    expect(recalculateCombos(parseDiary(legacy)).entries[0].points).toBe(123)
    expect(() =>
      parseDiary({
        ...state,
        scoringRules: [
          {
            version: 3,
            effectiveDay: '2026-11-15',
            incrementPercent: 10,
            maxMultiplier: 50,
          },
        ],
      }),
    ).toThrow(/compatibile/)
  })
  it('le sfide sono una al giorno, si possono ripristinare dopo annullamento e non hanno combo', () => {
    let state = initialDiary()
    state.events[0].repeat = 'daily'
    state = record(state, 'a')
    expect(previewEvent(state, state.events[0], at).available).toBe(false)
    expect(() => record(state, 'b')).toThrow(/già stata/)
    state = applyCommand(state, { type: 'void', id: 'a', at })
    expect(record(state, 'b').entries[1].points).toBe(10)
  })
  it('stima le ripetizioni nella coda offline e ricalcola le attese dopo un annullamento', () => {
    const snapshot = {
      ...record(initialDiary(), 'confirmed'),
      role: 'player' as const,
      ownerId: 'player',
      fetchedAt: at,
    }
    const pending = {
      id: 'pending',
      eventId: 'coffee',
      eventVersion: 1,
      name: 'Caffè',
      points: 10,
      occurredAt: '2026-11-14T11:00:00Z',
    }
    const queue = [
      {
        type: 'record' as const,
        operationId: 'pending',
        status: 'pending' as const,
        entry: pending,
      },
    ]
    expect(
      projectDiary({ schemaVersion: 1, snapshot, queue })?.entries[1].points,
    ).toBe(12)
    expect(
      projectDiary({
        schemaVersion: 1,
        snapshot,
        queue: [
          ...queue,
          {
            type: 'void',
            operationId: 'undo',
            status: 'pending',
            entryId: 'confirmed',
            at,
          },
        ],
      })?.entries[1].points,
    ).toBe(10)
  })
})

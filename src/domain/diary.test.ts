import { describe, expect, it } from 'vitest'
import { applyCommand, initialDiary } from './model'
import { dayKey, rankings, rewardProgress, statistics, weekKey } from './stats'

const at = '2026-11-14T10:00:00.000Z'
const now = new Date(at)
const record = { type: 'record', id: 'one', eventId: 'coffee', at } as const

describe('integrità del diario', () => {
  it('un ritentativo non conta due volte lo stesso episodio', () => {
    const state = applyCommand(initialDiary(), record)
    expect(applyCommand(state, record).entries).toHaveLength(1)
    expect(statistics(state, now).total).toBe(10)
    expect(() => applyCommand(state, { ...record, eventId: 'pet' })).toThrow(
      /Identificativo/,
    )
    expect(() =>
      applyCommand(state, { ...record, at: '2026-11-14T11:00:00.000Z' }),
    ).toThrow(/Identificativo/)
  })

  it('modificare e archiviare il catalogo non riscrive lo storico', () => {
    let state = applyCommand(initialDiary(), record)
    state = applyCommand(state, {
      type: 'save-event',
      value: { id: 'coffee', name: 'Caffè nuovo', description: '', points: 50 },
    })
    state = applyCommand(state, { ...record, id: 'two' })
    state = applyCommand(state, { type: 'archive-event', id: 'coffee' })
    expect(
      state.entries.map((entry) => [
        entry.name,
        entry.points,
        entry.eventVersion,
      ]),
    ).toEqual([
      ['Un caffè offerto', 10, 1],
      ['Caffè nuovo', 50, 2],
    ])
    expect(() => applyCommand(state, { ...record, id: 'three' })).toThrow(
      /non è più disponibile/,
    )
    expect(applyCommand(state, record).entries).toHaveLength(2)
  })

  it('annullare è idempotente, tracciato e aggiorna statistiche e progressi', () => {
    let state = initialDiary()
    for (let i = 0; i < 4; i++)
      state = applyCommand(state, { ...record, id: String(i), eventId: 'demo' })
    expect(rewardProgress(state, state.rewards[0], now).reached).toBe(true)
    state = applyCommand(state, { type: 'void', id: '0', at })
    const again = applyCommand(state, {
      type: 'void',
      id: '0',
      at: '2026-11-15T00:00:00Z',
    })
    expect(again.entries[0].voidedAt).toBe(at)
    expect(again.entries).toHaveLength(4)
    expect(statistics(again, now)).toMatchObject({
      total: 75,
      today: 75,
      countToday: 3,
    })
    expect(rewardProgress(again, again.rewards[0], now)).toMatchObject({
      reached: false,
      remaining: 25,
    })
    expect(rankings(again, 'day')[0].points).toBe(75)
  })

  it('accetta malus ma rifiuta punti e soglie non validi', () => {
    const event = {
      id: 'bad',
      name: 'Giornata storta',
      description: '',
      points: -10,
    }
    let state = applyCommand(initialDiary(), {
      type: 'save-event',
      value: event,
    })
    state = applyCommand(state, { ...record, eventId: 'bad' })
    expect(statistics(state, now).total).toBe(-10)
    expect(rewardProgress(state, state.rewards[0], now).percent).toBe(0)
    expect(() =>
      applyCommand(state, {
        type: 'save-event',
        value: { ...event, points: 2.5 },
      }),
    ).toThrow(/intero/)
    expect(() =>
      applyCommand(state, {
        type: 'save-reward',
        value: {
          id: 'r',
          name: 'Cena',
          description: '',
          target: 0,
          period: 'all',
        },
      }),
    ).toThrow(/intero/)
    expect(() =>
      applyCommand(state, {
        type: 'save-event',
        value: { ...event, name: ' ' },
      }),
    ).toThrow(/campi/)
  })

  it('crea, modifica e archivia un premio senza perdere la definizione', () => {
    let state = applyCommand(initialDiary(), {
      type: 'save-reward',
      value: {
        id: 'trip',
        name: 'Gita',
        description: 'Una domenica insieme',
        target: 200,
        period: 'all',
      },
    })
    state = applyCommand(state, {
      type: 'save-reward',
      value: {
        id: 'trip',
        name: 'Gita',
        description: '',
        target: 250,
        period: 'week',
      },
    })
    state = applyCommand(state, { type: 'archive-reward', id: 'trip' })
    expect(state.rewards.find((reward) => reward.id === 'trip')).toMatchObject({
      target: 250,
      period: 'week',
      archived: true,
    })
  })
})

describe('calendario Europe/Rome', () => {
  it('usa il giorno italiano anche prima della mezzanotte UTC', () => {
    expect(dayKey('2026-07-12T22:30:00Z')).toBe('2026-07-13')
    expect(dayKey('2026-01-12T23:30:00Z')).toBe('2026-01-13')
  })
  it('la settimana inizia il lunedì, anche tra anni diversi', () => {
    expect(weekKey('2026-11-15T22:30:00Z')).toBe('2026-11-09')
    expect(weekKey('2026-11-15T23:30:00Z')).toBe('2026-11-16')
    expect(weekKey('2027-01-01T12:00:00Z')).toBe('2026-12-28')
  })
  it('gestisce il cambio di ora senza inventare nuovi giorni o settimane', () => {
    expect(dayKey('2026-03-29T00:30:00Z')).toBe('2026-03-29')
    expect(dayKey('2026-03-29T01:30:00Z')).toBe('2026-03-29')
    expect(weekKey('2026-03-29T01:30:00Z')).toBe('2026-03-23')
    expect(dayKey('2026-10-25T00:30:00Z')).toBe(dayKey('2026-10-25T01:30:00Z'))
  })
  it('il nuovo lunedì azzera solo il progresso settimanale', () => {
    const state = applyCommand(initialDiary(), record)
    expect(statistics(state, new Date('2026-11-16T12:00:00Z'))).toMatchObject({
      week: 0,
      today: 0,
      total: 10,
    })
  })
})

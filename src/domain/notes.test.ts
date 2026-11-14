import { describe, expect, it } from 'vitest'
import { applyCommand, initialDiary, type NoteCommand } from './model'
import { parseDiary, validDay } from './validation'
import { statistics } from './stats'

const at = '2026-11-14T10:00:00.000Z'
const add = {
  type: 'add-note',
  value: {
    id: 'note',
    day: '2026-11-14',
    text: '  Una risata\nUna bella sorpresa  ',
    createdAt: at,
  },
} satisfies NoteCommand

describe('note giornaliere', () => {
  it('accetta più note per giornata e conserva testo e diari precedenti senza cambiare i punti', () => {
    const diary = applyCommand(applyCommand(initialDiary(), add), {
      ...add,
      value: { ...add.value, id: 'another' },
    })
    expect(diary.notes).toHaveLength(2)
    expect(diary.notes?.[0].text).toBe('Una risata\nUna bella sorpresa')
    expect(statistics(diary, new Date(at)).total).toBe(0)
    expect(diary.entries).toEqual([])
    expect(diary.rewards).toEqual(initialDiary().rewards)
    expect(parseDiary(diary)).toEqual(diary)
    expect(parseDiary(initialDiary()).notes).toBeUndefined()
  })
  it('deduplica i ritentativi, rifiuta payload diversi e non ricrea note rimosse', () => {
    let diary = applyCommand(initialDiary(), add)
    expect(applyCommand(diary, add).notes).toHaveLength(1)
    for (const value of [
      { ...add.value, text: 'Altro' },
      { ...add.value, day: '2026-11-13' },
    ])
      expect(() => applyCommand(diary, { type: 'add-note', value })).toThrow(
        /dati diversi/,
      )
    diary = applyCommand(diary, { type: 'remove-note', id: 'note', at })
    diary = applyCommand(diary, {
      type: 'remove-note',
      id: 'note',
      at: '2026-11-15T10:00:00Z',
    })
    expect(applyCommand(diary, add).notes?.[0].removedAt).toBe(at)
    expect(() =>
      applyCommand(diary, { type: 'remove-note', id: 'missing', at }),
    ).toThrow(/non trovata/)
  })
  it('valida date di calendario reali, testo non vuoto e dimensioni dei dati salvati', () => {
    expect(validDay('2028-02-29')).toBe(true)
    for (const day of [
      '2026-02-29',
      '2026-04-31',
      '2026-13-01',
      '0000-01-01',
      '2026-1-1',
    ]) {
      expect(validDay(day)).toBe(false)
      expect(() =>
        applyCommand(initialDiary(), { ...add, value: { ...add.value, day } }),
      ).toThrow(/data/)
    }
    for (const text of [' \t\n ', 'a'.repeat(2001)])
      expect(() =>
        applyCommand(initialDiary(), { ...add, value: { ...add.value, text } }),
      ).toThrow()
    expect(
      applyCommand(initialDiary(), {
        ...add,
        value: { ...add.value, text: 'a'.repeat(2000) },
      }).notes?.[0].text,
    ).toHaveLength(2000)
    for (const notes of [
      [null],
      [{ ...add.value, day: '2026-02-30' }],
      [add.value, add.value],
    ])
      expect(() => parseDiary({ ...initialDiary(), notes })).toThrow(
        /conservati/,
      )
  })
})

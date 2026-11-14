import { describe, expect, it } from 'vitest'
import { applyCommand, initialDiary, type ComboCommand } from './model'
import { parseDiary } from './validation'
import { statistics } from './stats'

const at = '2026-11-14T10:00:00.000Z'
const add = {
  type: 'add-combo',
  value: {
    id: 'combo',
    firstSurname: '  Allegri  ',
    secondSurname: '',
    note: '',
    createdAt: at,
  },
} satisfies ComboCommand

describe('raccolta cognomi', () => {
  it('salva un cognome singolo e una coppia senza cambiare punti o premi', () => {
    let diary = applyCommand(initialDiary(), add)
    diary = applyCommand(diary, {
      ...add,
      value: {
        ...add.value,
        id: 'pair',
        firstSurname: 'Belli',
        secondSurname: 'Allegri',
      },
    })
    expect(
      diary.combos?.map((item) => [item.firstSurname, item.secondSurname]),
    ).toEqual([
      ['Allegri', ''],
      ['Belli', 'Allegri'],
    ])
    expect(statistics(diary, new Date(at)).total).toBe(0)
    expect(diary.entries).toEqual([])
    expect(diary.rewards).toEqual(initialDiary().rewards)
    expect(parseDiary(diary)).toEqual(diary)
  })

  it('deduplica i ritentativi e conserva le rimozioni senza ricrearle', () => {
    let diary = applyCommand(initialDiary(), add)
    diary = applyCommand(diary, add)
    expect(diary.combos).toHaveLength(1)
    expect(() =>
      applyCommand(diary, { ...add, value: { ...add.value, note: 'Diverso' } }),
    ).toThrow(/dati diversi/)
    diary = applyCommand(diary, { type: 'remove-combo', id: 'combo', at })
    diary = applyCommand(diary, {
      type: 'remove-combo',
      id: 'combo',
      at: '2026-11-15T10:00:00Z',
    })
    diary = applyCommand(diary, add)
    expect(diary.combos?.[0].removedAt).toBe(at)
  })

  it('rifiuta campi vuoti, troppo lunghi o corrotti e legge i diari precedenti', () => {
    expect(parseDiary(initialDiary()).combos).toBeUndefined()
    for (const value of [
      { ...add.value, firstSurname: '   ' },
      { ...add.value, firstSurname: 'a'.repeat(61) },
      { ...add.value, secondSurname: 'a'.repeat(61) },
      { ...add.value, note: 'a'.repeat(181) },
      { ...add.value, createdAt: 'no' },
    ])
      expect(() =>
        applyCommand(initialDiary(), { type: 'add-combo', value }),
      ).toThrow()
    expect(() => parseDiary({ ...initialDiary(), combos: [null] })).toThrow(
      /conservati/,
    )
    expect(() =>
      parseDiary({ ...initialDiary(), combos: [add.value, add.value] }),
    ).toThrow(/conservati/)
  })
})

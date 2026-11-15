import { expect, it } from 'vitest'
import { applyCommand, initialDiary } from './model'
import { pointBalance } from './rewards'
import { rankings } from './stats'
import { parseDiary } from './validation'
const at = '2026-11-15T10:00:00Z'
function funded() {
  let diary = initialDiary()
  diary.events[0].points = 200
  diary = applyCommand(diary, {
    type: 'record',
    id: 'episode',
    eventId: 'coffee',
    at,
  })
  return diary
}
const redeem = {
  type: 'redeem-reward',
  id: 'redemption',
  rewardId: 'breakfast',
  periodKey: '2026-11-09',
  expectedVersion: 1,
  at,
} as const
it('sceglie un premio, addebita una volta sola e conserva il massimale e i record', () => {
  let diary = funded()
  expect(diary.awards).toEqual([])
  diary = applyCommand(diary, redeem)
  expect(diary.pointBalance).toEqual({ current: 100, maximum: 200 })
  expect(diary.awards).toHaveLength(1)
  const legacy = {
    ...funded(),
    awards: diary.awards!.map((award) => ({
      ...award,
      redeemedAt: undefined,
      pointsSpent: undefined,
    })),
  }
  expect(() => applyCommand(legacy, redeem)).toThrow(/Identificativo/)
  expect(rankings(diary, 'day')[0].points).toBe(200)
  expect(applyCommand(diary, redeem)).toEqual(diary)
  expect(() => applyCommand(diary, { ...redeem, rewardId: 'dinner' })).toThrow(
    /Identificativo/,
  )
  expect(() => applyCommand(diary, { ...redeem, id: 'other' })).toThrow(
    /già riscattato/,
  )
  expect(() =>
    applyCommand(diary, {
      ...redeem,
      id: 'other',
      rewardId: 'dinner',
      periodKey: 'all',
    }),
  ).toThrow(/insufficienti/)
})
it('conserva riscatto e massimo dopo annullamento, mostra il debito e impedisce altra spesa', () => {
  let diary = applyCommand(funded(), redeem)
  diary = applyCommand(diary, { type: 'void', id: 'episode', at })
  expect(diary.pointBalance).toEqual({ current: -100, maximum: 200 })
  expect(diary.awards?.[0]).toMatchObject({
    pointsSpent: 100,
    needsReview: true,
  })
  diary = applyCommand(diary, {
    type: 'record',
    id: 'next',
    eventId: 'coffee',
    at,
  })
  expect(diary.pointBalance).toEqual({ current: 100, maximum: 200 })
  expect(diary.awards?.[0].needsReview).toBe(false)
})
it('protegge prezzo, periodo, archiviazione e limite settimanale', () => {
  const diary = funded()
  expect(() => applyCommand(diary, { ...redeem, expectedVersion: 2 })).toThrow(
    /cambiato/,
  )
  expect(() =>
    applyCommand(diary, { ...redeem, periodKey: '2026-11-02' }),
  ).toThrow(/periodo/)
  const monday = '2026-11-16T10:00:00Z'
  expect(() =>
    applyCommand(diary, { ...redeem, at: monday, periodKey: '2026-11-16' }),
  ).toThrow(/insufficienti/)
  const archived = applyCommand(diary, {
    type: 'archive-reward',
    id: 'breakfast',
  })
  expect(() => applyCommand(archived, redeem)).toThrow(/disponibile/)
})
it('legge dati precedenti senza addebiti retroattivi e valida i nuovi campi', () => {
  const diary = funded()
  delete diary.pointBalance
  expect(pointBalance(parseDiary(diary))).toEqual({
    current: 200,
    maximum: 200,
  })
  expect(() =>
    parseDiary({ ...diary, pointBalance: { current: 1, maximum: -1 } }),
  ).toThrow(/compatibile/)
})

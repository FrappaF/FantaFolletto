// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, expect, it, vi } from 'vitest'
import { pledgeOccurrences } from '../domain/pledges'
import { parseDiary } from '../domain/validation'
import { isPledgesDemo, pledgesDemoDiary } from './pledges-demo'

afterEach(() => {
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
})

it('attiva l’anteprima solo con il parametro dedicato nella modalità demo', () => {
  vi.stubEnv('VITE_APP_MODE', 'demo')
  expect(isPledgesDemo('?anteprima=pegni')).toBe(true)
  expect(isPledgesDemo('?anteprima=altro')).toBe(false)
  expect(isPledgesDemo('')).toBe(false)
  vi.stubEnv('VITE_APP_MODE', 'remote')
  expect(isPledgesDemo('?anteprima=pegni')).toBe(false)
  vi.stubEnv('VITE_APP_MODE', undefined)
  expect(isPledgesDemo('?anteprima=pegni')).toBe(false)
})

it.each([
  '2026-11-19T10:00:00Z',
  '2026-11-30T23:30:00Z',
  '2027-01-03T23:15:00Z',
  '2027-03-28T01:30:00Z',
])('prepara scadenze attuali, pegno dovuto, riscosso e futuro al %s', (at) => {
  const now = new Date(at)
  const diary = parseDiary(pledgesDemoDiary(now))
  const occurrences = pledgeOccurrences(diary, now)
  expect(occurrences.filter((item) => item.status === 'due')).toHaveLength(1)
  expect(occurrences.filter((item) => item.status === 'collected')).toHaveLength(1)
  expect(occurrences.filter((item) => item.status === 'upcoming')).toHaveLength(1)
  const active = occurrences.filter((item) => item.status === 'active')
  expect(active).toHaveLength(2)
  expect(active.find((item) => item.pledge.period === 'week')).toMatchObject({
    points: 35,
    remaining: 65,
    pledge: { target: 100 },
  })
  expect(active.find((item) => item.pledge.period === 'month')).toMatchObject({
    points: 35,
    remaining: 415,
    pledge: { target: 450 },
  })
})

it('salva l’anteprima in un database distinto e non la rigenera dopo una modifica', async () => {
  vi.stubEnv('VITE_APP_MODE', 'demo')
  vi.resetModules()
  window.history.replaceState(null, '', '/?anteprima=pegni')
  const preview = await import('./diary-store')
  expect((await preview.readDiary()).pledges).toHaveLength(5)
  await preview.saveCommand({
    type: 'add-note',
    value: {
      id: 'preview-note',
      day: '2026-11-19',
      text: 'Nota di prova',
      createdAt: '2026-11-19T10:00:00Z',
    },
  })
  expect((await preview.readDiary()).notes?.[0].text).toBe('Nota di prova')

  vi.resetModules()
  window.history.replaceState(null, '', '/')
  const regular = await import('./diary-store')
  const regularDiary = await regular.readDiary()
  expect(regularDiary.pledges ?? []).toHaveLength(0)
  expect(regularDiary.entries).toHaveLength(0)
  expect(regularDiary.notes ?? []).toHaveLength(0)
})

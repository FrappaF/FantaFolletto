// @vitest-environment jsdom
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, afterEach, expect, it, vi } from 'vitest'
import Admin from './Admin'
import { DiaryView } from '../App'
import { initialDiary } from '../domain/model'
const now = new Date('2026-11-14T10:00:00Z')
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  window.scrollTo = vi.fn()
})
afterEach(cleanup)
it('admin cambia sia incremento sia tetto e invia una versione controllata', async () => {
  const user = userEvent.setup()
  const execute = vi.fn().mockResolvedValue(true)
  render(
    <Admin
      diary={initialDiary()}
      now={now}
      busy={false}
      error=""
      execute={execute}
      onExit={() => {}}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Combo' }))
  const input = screen.getByLabelText(/Moltiplicatore massimo/)
  await user.clear(input)
  await user.type(input, '4.5')
  await user.clear(screen.getByLabelText(/Incremento per ripetizione/))
  await user.type(screen.getByLabelText(/Incremento per ripetizione/), '50')
  expect(
    within(screen.getByLabelText('Esempio su un evento da 10 punti')).getByText(
      '30 pt',
    ),
  ).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Salva per domani' }))
  expect(execute).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'save-scoring',
      expectedVersion: 1,
      value: { incrementPercent: 50, maxMultiplier: 4.5 },
    }),
  )
})
it('i filtri del catalogo selezionano gli animali e il modulo admin mantiene categoria e rarità', async () => {
  const user = userEvent.setup()
  const execute = vi.fn().mockResolvedValue(true)
  render(
    <Admin
      diary={initialDiary()}
      now={now}
      busy={false}
      error=""
      execute={execute}
      onExit={() => {}}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Eventi' }))
  await user.click(
    screen.getByRole('button', { name: '🐾 Animali' }),
  )
  expect(
    screen.getByRole('heading', { name: 'Assistente a quattro zampe' }),
  ).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Un caffè offerto' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Modifica' }))
  const dialog = screen.getByRole('dialog')
  await user.selectOptions(within(dialog).getByLabelText('Rarità'), 'legendary')
  await user.selectOptions(
    within(dialog).getByLabelText('Ripetizione'),
    'daily',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Salva modifiche' }),
  )
  expect(execute).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'save-event',
      value: expect.objectContaining({
        categoryId: 'animals',
        rarity: 'legendary',
        repeat: 'daily',
      }),
    }),
  )
})
it('la giocatrice vede i filtri, la prossima combo e le sfide già registrate disabilitate', async () => {
  const diary = initialDiary()
  diary.events[0].repeat = 'daily'
  diary.entries = [
    {
      id: 'one',
      name: 'Caffè',
      eventId: 'coffee',
      eventVersion: 1,
      points: 10,
      occurredAt: new Date().toISOString(),
    },
  ]
  const user = userEvent.setup()
  render(
    <DiaryView
      controller={{
        diary,
        busy: false,
        error: '',
        execute: vi.fn(),
        refresh: vi.fn(),
      }}
    />,
  )
  await user.click(screen.getByRole('button', { name: /Segna un evento/ }))
  expect(
    screen
      .getByRole('button', { name: /Un caffè offerto/ })
      .hasAttribute('disabled'),
  ).toBe(true)
  await user.click(
    screen.getByRole('button', { name: '🐾 Animali' }),
  )
  expect(screen.queryByRole('button', { name: /Un caffè offerto/ })).toBeNull()
  expect(
    screen.getByRole('button', { name: /Assistente a quattro zampe/ }),
  ).toBeTruthy()
})

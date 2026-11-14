// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { DailyNotes } from './DailyNotes'
import { useDiary } from '../hooks/useDiary'
import { initialDiary } from '../domain/model'

const now = new Date('2026-07-12T22:30:00Z')
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)
function LocalNotes() {
  const controller = useDiary()
  return (
    controller.diary && (
      <DailyNotes
        {...controller}
        diary={controller.diary}
        now={now}
        shared={false}
      />
    )
  )
}

it('salva e rilegge le note raggruppate per giorno, con data italiana e rimozione confermata', async () => {
  const user = userEvent.setup()
  const view = render(<LocalNotes />)
  await user.click(
    await screen.findByRole('button', { name: 'Scrivi una nota' }),
  )
  expect((screen.getByLabelText('Giornata') as HTMLInputElement).value).toBe(
    '2026-07-13',
  )
  await user.type(
    screen.getByLabelText('Cosa è successo?'),
    'Una risata da ricordare',
  )
  await user.click(screen.getByRole('button', { name: 'Salva nota' }))
  await screen.findByText('Una risata da ricordare')
  view.unmount()
  render(<LocalNotes />)
  await screen.findByText('Una risata da ricordare')
  await user.click(screen.getByRole('button', { name: 'Scrivi una nota' }))
  fireEvent.change(screen.getByLabelText('Giornata'), {
    target: { value: '2026-07-12' },
  })
  await user.type(
    screen.getByLabelText('Cosa è successo?'),
    'Una pausa\nPoi una sorpresa',
  )
  await user.click(screen.getByRole('button', { name: 'Salva nota' }))
  expect((await screen.findByText(/Una pausa/)).textContent).toBe(
    'Una pausa\nPoi una sorpresa',
  )
  const groups = screen.getAllByRole('region', { name: /Note di/ })
  expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
    'Note di lunedì 13 luglio 2026',
    'Note di domenica 12 luglio 2026',
  ])
  await user.click(
    screen.getByRole('button', {
      name: 'Rimuovi nota: Una risata da ricordare',
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Tieni la nota' }))
  expect(screen.getByText('Una risata da ricordare')).toBeTruthy()
  await user.click(
    screen.getByRole('button', {
      name: 'Rimuovi nota: Una risata da ricordare',
    }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Rimuovi nota' }),
  )
  await waitFor(() =>
    expect(screen.queryByText('Una risata da ricordare')).toBeNull(),
  )
  expect(
    screen.queryByRole('region', { name: 'Note di lunedì 13 luglio 2026' }),
  ).toBeNull()
})

it('rifiuta il testo vuoto e conserva testo e data dopo un salvataggio fallito', async () => {
  const execute = vi.fn(async () => false)
  const user = userEvent.setup()
  render(
    <DailyNotes
      diary={initialDiary()}
      now={now}
      busy={false}
      error="Salvataggio non riuscito"
      execute={execute}
      shared
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Scrivi una nota' }))
  await user.type(screen.getByLabelText('Cosa è successo?'), '   ')
  expect(
    (screen.getByRole('button', { name: 'Salva nota' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true)
  await user.clear(screen.getByLabelText('Cosa è successo?'))
  await user.type(screen.getByLabelText('Cosa è successo?'), 'Da conservare')
  await user.click(screen.getByRole('button', { name: 'Salva nota' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(
    (screen.getByLabelText('Cosa è successo?') as HTMLTextAreaElement).value,
  ).toBe('Da conservare')
  expect((screen.getByLabelText('Giornata') as HTMLInputElement).value).toBe(
    '2026-07-13',
  )
  expect(screen.getByRole('alert').textContent).toBe('Salvataggio non riuscito')
})

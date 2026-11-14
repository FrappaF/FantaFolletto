// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { Combos } from './Combos'
import { useDiary } from '../hooks/useDiary'
import { initialDiary } from '../domain/model'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

function LocalCombos() {
  const controller = useDiary()
  return (
    controller.diary && (
      <Combos {...controller} diary={controller.diary} shared={false} />
    )
  )
}

it('salva un solo cognome, rilegge dopo riapertura, aggiunge una coppia e conferma la rimozione', async () => {
  const user = userEvent.setup()
  const view = render(<LocalCombos />)
  await user.click(
    await screen.findByRole('button', { name: 'Aggiungi una combo' }),
  )
  expect(
    (screen.getByLabelText('Secondo cognome (facoltativo)') as HTMLInputElement)
      .required,
  ).toBe(false)
  await user.type(screen.getByLabelText('Primo cognome'), 'Allegri')
  await user.click(screen.getByRole('button', { name: 'Salva combo' }))
  await screen.findByRole('heading', { name: 'Allegri' })
  expect(screen.queryByRole('dialog')).toBeNull()
  view.unmount()
  render(<LocalCombos />)
  await screen.findByRole('heading', { name: 'Allegri' })
  await user.click(screen.getByRole('button', { name: 'Aggiungi una combo' }))
  await user.type(screen.getByLabelText('Primo cognome'), 'Belli')
  await user.type(
    screen.getByLabelText('Secondo cognome (facoltativo)'),
    'Allegri',
  )
  await user.type(screen.getByLabelText('Nota (facoltativa)'), 'Un bel duo')
  await user.click(screen.getByRole('button', { name: 'Salva combo' }))
  await screen.findByRole('heading', { name: 'Belli + Allegri' })
  await user.click(screen.getByRole('button', { name: 'Rimuovi Allegri' }))
  await user.click(screen.getByRole('button', { name: 'Tieni la combo' }))
  expect(screen.getByRole('heading', { name: 'Allegri' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Rimuovi Allegri' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Rimuovi combo',
    }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Allegri' })).toBeNull(),
  )
  expect(screen.getByText('Un bel duo')).toBeTruthy()
})

it('un salvataggio fallito mantiene il modulo e i dati inseriti', async () => {
  const execute = vi.fn(async () => false)
  const user = userEvent.setup()
  render(
    <Combos
      diary={initialDiary()}
      busy={false}
      error="Salvataggio non riuscito"
      execute={execute}
      shared
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Aggiungi una combo' }))
  await user.type(screen.getByLabelText('Primo cognome'), 'Belli')
  await user.click(screen.getByRole('button', { name: 'Salva combo' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(
    (screen.getByLabelText('Primo cognome') as HTMLInputElement).value,
  ).toBe('Belli')
  expect(screen.getByRole('alert').textContent).toBe('Salvataggio non riuscito')
})

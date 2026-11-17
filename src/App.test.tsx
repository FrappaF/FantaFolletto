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
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { App } from './App'
import { StrictMode } from 'react'

beforeAll(() => {
  // A configured developer checkout must still exercise the isolated demo here.
  vi.stubEnv('VITE_APP_MODE', 'demo')
  // jsdom has no browser dialog/focus engine. Exercise application behavior only.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  window.scrollTo = vi.fn()
})
afterEach(cleanup)
afterAll(() => vi.unstubAllEnvs())

it('apre l’upload nella pagina e conserva l’editor passando alle altre tab', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Raccolte' }))
  await user.click(await screen.findByRole('button', { name: 'Apri Zerbini' }))
  await user.click(await screen.findByRole('button', { name: 'Aggiungi foto' }))
  expect(screen.getByRole('heading', { name: 'Aggiungi foto.' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Torna alle raccolte' }),
  ).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Record' }))
  await user.click(screen.getByRole('button', { name: 'Raccolte' }))
  expect(screen.getByRole('button', { name: 'Scegli una foto' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Torna agli zerbini' }))
  expect(
    screen.getByRole('heading', { name: 'Zerbini da ricordare.' }),
  ).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Torna alle raccolte' }),
  ).toBeTruthy()
})

it('percorre il Diario: registra, annulla, ricarica, modifica catalogo e gestisce premi', async () => {
  const user = userEvent.setup()
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  await user.click(
    await screen.findByRole('button', { name: /Segna un evento/ }),
  )
  await user.click(screen.getByRole('button', { name: /Un caffè offerto/ }))
  await screen.findByText(/Un caffè offerto · \+10 punti/)
  expect(document.querySelector('.score-number')?.textContent).toBe('10punti')
  await user.click(
    within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Chiudi' })[0],
  )

  await user.click(screen.getByRole('button', { name: 'Annulla' }))
  await screen.findByText('Episodio annullato. Il diario è aggiornato.')
  expect(document.querySelector('.score-number')?.textContent).toBe('0punti')
  await user.click(screen.getByRole('button', { name: /Segna un evento/ }))
  await user.click(screen.getByRole('button', { name: /Un caffè offerto/ }))
  await screen.findByText(/Un caffè offerto · \+10 punti/)
  await user.click(
    within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Chiudi' })[0],
  )
  view.unmount()

  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  await screen.findByRole('button', { name: /Segna un evento/ })
  expect(document.querySelector('.score-number')?.textContent).toBe('10punti')
  await user.click(screen.getByRole('button', { name: 'Record' }))
  await screen.findByRole('heading', { name: 'I tuoi record' })
  await user.click(screen.getByRole('button', { name: 'Raccolte' }))
  expect(within(screen.getByRole('navigation')).getAllByRole('button')).toHaveLength(4)
  await user.click(await screen.findByRole('button', { name: 'Apri Note' }))
  await screen.findByRole('heading', { name: /Note giornaliere/ })
  await user.click(screen.getByRole('button', { name: 'Record' }))
  expect(screen.getAllByText('Un caffè offerto')).toHaveLength(1)
  await user.click(
    screen.getByRole('checkbox', {
      name: /Mostra anche gli episodi annullati/,
    }),
  )
  expect(screen.getAllByText('Un caffè offerto')).toHaveLength(2)

  await user.click(screen.getByRole('button', { name: 'Prova area admin' }))
  await screen.findByRole('heading', { name: 'Il tuo spazio admin' })
  await user.click(screen.getByRole('button', { name: 'Raccolte' }))
  await user.click(await screen.findByRole('button', { name: 'Apri Note' }))
  await screen.findByRole('heading', { name: /Note giornaliere/ })
  await user.click(screen.getByRole('button', { name: 'Eventi' }))
  await user.click(screen.getAllByRole('button', { name: 'Modifica' })[0])
  const eventDialog = screen.getByRole('dialog', { name: 'Modifica evento' })
  await user.clear(within(eventDialog).getByLabelText('Nome'))
  await user.type(
    within(eventDialog).getByLabelText('Nome'),
    'Un caffè speciale',
  )
  await user.clear(within(eventDialog).getByLabelText(/Punti/))
  await user.type(within(eventDialog).getByLabelText(/Punti/), '40')
  await user.click(
    within(eventDialog).getByRole('button', { name: 'Salva modifiche' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

  await user.click(screen.getByRole('button', { name: 'Premi' }))
  await user.click(screen.getByRole('button', { name: /Crea premio/ }))
  const rewardDialog = screen.getByRole('dialog', { name: 'Crea premio' })
  await user.type(
    within(rewardDialog).getByLabelText('Nome'),
    'Una gita insieme',
  )
  await user.click(
    within(rewardDialog).getByRole('button', { name: 'Salva modifiche' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const rewardCard = screen
    .getByRole('heading', { name: 'Una gita insieme' })
    .closest('article')!
  await user.click(within(rewardCard).getByRole('button', { name: 'Archivia' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Archivia',
    }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('heading', { name: 'Una gita insieme' }),
    ).toBeNull(),
  )

  await user.click(
    screen.getAllByRole('button', { name: 'Torna al diario' })[0],
  )
  await user.click(screen.getByRole('button', { name: 'Oggi' }))
  await user.click(screen.getByRole('button', { name: /Segna un evento/ }))
  await user.type(screen.getByRole('searchbox'), 'speciale')
  await user.click(screen.getByRole('button', { name: /Un caffè speciale/ }))
  await screen.findByText(/Un caffè speciale · \+48 punti/)
  await user.click(
    within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Chiudi' })[0],
  )
  expect(document.querySelector('.score-number')?.textContent).toBe('58punti')
  expect(screen.getByRole('heading', { name: 'Un caffè offerto' })).toBeTruthy()
  expect(
    screen.getByRole('heading', { name: 'Un caffè speciale' }),
  ).toBeTruthy()
}, 20000)

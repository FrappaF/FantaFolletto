// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { initialDiary } from '../domain/model'
import RemoteApplication from './RemoteApplication'
import { useRemoteDiary } from './useRemoteDiary'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('./client', () => ({ makeClient: () => ({ auth: mocks }) }))
vi.mock('./useRemoteDiary', () => ({ useRemoteDiary: vi.fn() }))
const config = {
  url: 'https://example.supabase.co',
  key: 'sb_publishable_test',
}
const controller = () => ({
  diary: {
    ...initialDiary(),
    awards: [],
    role: 'player' as const,
    ownerId: 'player',
    fetchedAt: new Date().toISOString(),
  },
  busy: false,
  error: '',
  execute: vi.fn(async () => true),
  refresh: vi.fn(async () => {}),
  remote: {
    role: 'player' as const,
    queue: [],
    syncError: '',
    syncing: false,
    confirmedTotal: 0,
    fetchedAt: new Date().toISOString(),
    retryBlocked: vi.fn(async () => {}),
    discardRejected: vi.fn(async () => {}),
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  mocks.signOut.mockResolvedValue({ error: null })
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  window.scrollTo = vi.fn()
  vi.mocked(useRemoteDiary).mockReturnValue(controller())
})
afterEach(cleanup)

it('mostra il login senza registrazione pubblica e spiega un errore di accesso', async () => {
  const user = userEvent.setup()
  mocks.signInWithPassword.mockResolvedValue({ error: { status: 400 } })
  render(<RemoteApplication config={config} />)
  await user.type(await screen.findByLabelText('Email'), 'player@example.test')
  await user.type(screen.getByLabelText('Password'), 'example-password')
  await user.click(screen.getByRole('button', { name: 'Entra nel diario' }))
  await screen.findByText('Email o password non corrette.')
  expect(screen.queryByRole('button', { name: /registr/i })).toBeNull()
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({
    email: 'player@example.test',
    password: 'example-password',
  })
})

it('la giocatrice vede il diario senza un selettore admin e può chiudere la sessione', async () => {
  const user = userEvent.setup()
  const connected = controller()
  vi.mocked(useRemoteDiary).mockReturnValue({
    ...connected,
    remote: { ...connected.remote, syncing: true },
  })
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'player' } } },
    error: null,
  })
  render(<RemoteApplication config={config} />)
  await screen.findByRole('button', { name: /Segna un evento/ })
  expect(screen.queryByRole('button', { name: /area admin/ })).toBeNull()
  expect(screen.queryByText(/Versione demo/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Esci dal diario' }))
  await user.click(screen.getByRole('button', { name: 'Esci' }))
  await screen.findByRole('button', { name: 'Entra nel diario' })
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
})

it('un cambio di account rimuove il diario precedente e il login non mostra dati in cache', async () => {
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'player' } } },
    error: null,
  })
  render(<RemoteApplication config={config} />)
  await screen.findByRole('button', { name: /Segna un evento/ })
  const listener = mocks.onAuthStateChange.mock.calls[0][0]
  act(() => listener('SIGNED_OUT', null))
  await screen.findByLabelText('Email')
  expect(screen.queryByRole('button', { name: /Segna un evento/ })).toBeNull()
  expect(
    screen.queryByRole('heading', { name: /piccola avventura/ }),
  ).toBeNull()
})

it('l’admin apre il pannello reale e non può segnare episodi nemmeno tornando al diario', async () => {
  const user = userEvent.setup()
  const connected = controller()
  vi.mocked(useRemoteDiary).mockReturnValue({
    ...connected,
    diary: { ...connected.diary, role: 'admin' },
    remote: { ...connected.remote, role: 'admin' },
  })
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'admin' } } },
    error: null,
  })
  render(<RemoteApplication config={config} />)
  await screen.findByRole('heading', { name: 'Il tuo spazio admin' })
  expect(
    screen.queryByText(/Anteprima admin, senza accesso protetto/),
  ).toBeNull()
  await user.click(
    screen.getAllByRole('button', { name: 'Torna al diario' })[0],
  )
  expect(screen.queryByRole('button', { name: /Segna un evento/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Apri area admin' })).toBeTruthy()
})

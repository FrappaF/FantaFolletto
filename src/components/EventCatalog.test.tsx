// @vitest-environment jsdom
import { act, render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, afterEach, expect, it, vi } from 'vitest'
import Admin from './Admin'
import { DiaryView } from '../App'
import { applyCommand, initialDiary } from '../domain/model'
import { Modal } from './ui'
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
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
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

it('registra più eventi mantenendo modale, ricerca, categoria e scorrimento', async () => {
  const user = userEvent.setup()
  let complete!: (value: boolean) => void
  const execute = vi.fn().mockImplementationOnce(
    () => new Promise<boolean>((resolve) => { complete = resolve }),
  ).mockResolvedValue(true)
  const controller = {
    diary: initialDiary(), busy: false, error: '', execute, refresh: vi.fn(),
  }
  const { rerender } = render(<DiaryView controller={controller} />)
  await user.click(screen.getByRole('button', { name: /Segna un evento/ }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: '🐾 Animali' }))
  const search = within(dialog).getByRole('searchbox') as HTMLInputElement
  await user.type(search, 'quattro')
  dialog.scrollTop = 247
  const choice = within(dialog).getByRole('button', { name: /Assistente a quattro zampe/ })
  await user.click(choice)
  expect(choice.hasAttribute('disabled')).toBe(true)
  expect(within(dialog).getAllByRole('button', { name: 'Chiudi' }).every(
    (button) => button.hasAttribute('disabled'),
  )).toBe(true)
  expect(execute).toHaveBeenCalledTimes(1)
  await act(async () => { complete(true) })
  rerender(<DiaryView controller={{
    ...controller,
    diary: applyCommand(controller.diary, execute.mock.calls[0][0]),
  }} />)
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(dialog.scrollTop).toBe(247)
  expect(search.value).toBe('quattro')
  expect(within(dialog).getByRole('button', { name: '🐾 Animali' }).getAttribute('aria-pressed')).toBe('true')
  expect(within(dialog).getByRole('status').textContent).toContain('Assistente a quattro zampe · +15 punti')
  expect(within(choice).getByText('2ª volta oggi · bonus +3')).toBeTruthy()
  await user.click(choice)
  expect(execute).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('dialog')).toBe(dialog)
  await user.click(dialog.querySelector<HTMLButtonElement>('.modal-close-footer button')!)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('un salvataggio fallito conserva il catalogo e permette di riprovare o chiudere', async () => {
  const user = userEvent.setup()
  const controller = {
    diary: initialDiary(), busy: false, error: '',
    execute: vi.fn().mockResolvedValue(false), refresh: vi.fn(),
  }
  const { rerender } = render(<DiaryView controller={controller} />)
  await user.click(screen.getByRole('button', { name: /Segna un evento/ }))
  const dialog = screen.getByRole('dialog')
  dialog.scrollTop = 180
  await user.click(within(dialog).getByRole('button', { name: /Un caffè offerto/ }))
  rerender(<DiaryView controller={{ ...controller, error: 'Salvataggio non riuscito.' }} />)
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(dialog.scrollTop).toBe(180)
  expect(within(dialog).getByRole('alert').textContent).toBe('Salvataggio non riuscito.')
  expect(within(dialog).getByRole('button', { name: /Un caffè offerto/ }).hasAttribute('disabled')).toBe(false)
  expect(within(dialog).getByRole('status').textContent).toBe('')
  await user.click(within(dialog).getAllByRole('button', { name: 'Chiudi' })[0])
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('mostra la chiusura in fondo solo quando la X non è interamente visibile', async () => {
  let notify!: IntersectionObserverCallback
  const disconnect = vi.fn()
  const observe = vi.fn()
  const observer = vi.fn(function (callback: IntersectionObserverCallback) {
    notify = callback
    return { observe, disconnect }
  })
  vi.stubGlobal('IntersectionObserver', observer)
  const onClose = vi.fn()
  const { rerender, unmount } = render(
    <Modal title="Eventi" scrollCloseButton onClose={onClose}>Catalogo</Modal>,
  )
  const dialog = screen.getByRole('dialog')
  const topClose = within(dialog).getByRole('button', { name: 'Chiudi' })
  expect(observer).toHaveBeenCalledWith(expect.any(Function), { root: dialog, threshold: 1 })
  expect(observe).toHaveBeenCalledWith(topClose)
  const visibility = (ratio: number) => act(() => notify(
    [{ intersectionRatio: ratio } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  ))
  visibility(1)
  expect(dialog.querySelector('.modal-close-footer')).toBeNull()
  visibility(0)
  const bottomClose = dialog.querySelector('.modal-close-footer button') as HTMLButtonElement
  expect(bottomClose).toBeTruthy()
  rerender(<Modal title="Eventi" scrollCloseButton onClose={onClose} busy>Catalogo</Modal>)
  expect(bottomClose.disabled).toBe(true)
  rerender(<Modal title="Eventi" scrollCloseButton onClose={onClose}>Catalogo</Modal>)
  await userEvent.setup().click(bottomClose)
  expect(onClose).toHaveBeenCalledTimes(1)
  visibility(0.5)
  expect(dialog.querySelector('.modal-close-footer')).toBeTruthy()
  visibility(1)
  expect(dialog.querySelector('.modal-close-footer')).toBeNull()
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})

// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import { PwaPrompt } from './PwaPrompt'

const update = vi.hoisted(() => vi.fn(async () => {}))
const registration = vi.hoisted(() => ({ options: {} as RegisterSWOptions }))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: RegisterSWOptions) => {
    registration.options = options
    return {
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: update,
    }
  },
}))
afterEach(() => {
  cleanup()
  update.mockClear()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('aspetta la coda e la chiusura dei moduli prima di permettere l’aggiornamento', async () => {
  const user = userEvent.setup()
  const view = render(
    <>
      <PwaPrompt />
      <div data-update-blocked="true" />
      <dialog open />
    </>,
  )
  const button = screen.getByRole('button', {
    name: 'Aggiorna app',
  }) as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(true))
  await user.click(button)
  expect(update).not.toHaveBeenCalled()
  view.rerender(
    <>
      <PwaPrompt />
      <div data-update-blocked="false" />
      <dialog open />
    </>,
  )
  expect(button.disabled).toBe(true)
  view.rerender(
    <>
      <PwaPrompt />
      <div data-update-blocked="false" />
      <dialog />
    </>,
  )
  await waitFor(() => expect(button.disabled).toBe(false))
  await user.click(button)
  expect(update).toHaveBeenCalledWith(true)
})

it('cerca una nuova versione al ritorno in Safari e periodicamente, senza applicarla da sola', async () => {
  vi.useFakeTimers()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const check = vi.fn().mockResolvedValue(undefined)
  const view = render(<PwaPrompt />)
  await act(async () => {
    registration.options.onRegisteredSW?.('/sw.js', {
      update: check,
    } as unknown as ServiceWorkerRegistration)
  })
  expect(check).toHaveBeenCalledTimes(1)
  for (const event of ['focus', 'online']) {
    await act(async () => {
      window.dispatchEvent(new Event(event))
    })
  }
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(check).toHaveBeenCalledTimes(4)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
  })
  expect(check).toHaveBeenCalledTimes(5)
  expect(update).not.toHaveBeenCalled()
  view.unmount()
  window.dispatchEvent(new Event('focus'))
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
  expect(check).toHaveBeenCalledTimes(5)
})

it('rimanda i controlli nascosta o offline e riprende dopo un errore di rete', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const check = vi.fn().mockRejectedValueOnce(new Error('Rete assente')).mockResolvedValue(undefined)
  render(<PwaPrompt />)
  await act(async () => {
    registration.options.onRegisteredSW?.('/sw.js', {
      update: check,
    } as unknown as ServiceWorkerRegistration)
  })
  expect(check).not.toHaveBeenCalled()
  visibility.mockReturnValue('visible')
  online.mockReturnValue(false)
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(check).not.toHaveBeenCalled()
  online.mockReturnValue(true)
  await act(async () => window.dispatchEvent(new Event('online')))
  expect(check).toHaveBeenCalledTimes(1)
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(check).toHaveBeenCalledTimes(2)
  expect(screen.queryByText(/modalità offline non è ancora pronta/)).toBeNull()
  expect(update).not.toHaveBeenCalled()
})

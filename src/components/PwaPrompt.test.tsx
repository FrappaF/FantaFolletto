// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { PwaPrompt } from './PwaPrompt'

const update = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: update,
  }),
}))
afterEach(() => {
  cleanup()
  update.mockClear()
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

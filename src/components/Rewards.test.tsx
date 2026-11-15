// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Rewards } from './Rewards'
import { initialDiary, type Diary } from '../domain/model'
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)
function setup(overrides: Partial<Parameters<typeof Rewards>[0]> = {}) {
  const diary: Diary = {
    ...initialDiary(),
    entries: [
      {
        id: 'e',
        eventId: 'coffee',
        eventVersion: 1,
        name: 'Caffè',
        points: 200,
        occurredAt: '2026-11-15T10:00:00Z',
      },
    ],
  }
  const execute = vi.fn(async () => true)
  render(
    <Rewards
      diary={diary}
      now={new Date('2026-11-15T10:00:00Z')}
      busy={false}
      error=""
      execute={execute}
      canRedeem
      shared={false}
      waiting={false}
      {...overrides}
    />,
  )
  return execute
}
it('richiede una scelta e la conferma esplicita prima di scalare i punti', async () => {
  const execute = setup()
  const user = userEvent.setup()
  expect(execute).not.toHaveBeenCalled()
  expect(screen.getByText('Massimale punti')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Riscatta · 100 punti' }))
  expect(execute).not.toHaveBeenCalled()
  expect(screen.getByText(/Userai 100 punti/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Conferma riscatto' }))
  expect(execute).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'redeem-reward',
      rewardId: 'breakfast',
      expectedVersion: 1,
      periodKey: '2026-11-09',
    }),
  )
})
it('impedisce riscatti senza saldo, con operazioni in attesa e dal ruolo admin', () => {
  setup({ waiting: true })
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Riscatta · 100 punti',
    }).disabled,
  ).toBe(true)
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Riscatta · 300 punti',
    }).disabled,
  ).toBe(true)
  cleanup()
  setup({ canRedeem: false })
  expect(screen.queryByRole('button', { name: /Riscatta/ })).toBeNull()
})

// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initialDiary, type Command, type Diary, type Pledge } from '../domain/model'
import { PledgeNotice, Pledges } from './Pledges'

const now = new Date('2026-11-19T10:00:00Z')
const pledge: Pledge = {
  id: 'pledge-breakfast',
  name: 'Colazione offerta',
  description: 'Una pausa insieme, questa volta offri tu.',
  target: 100,
  period: 'week',
  version: 1,
  archived: false,
  effectiveFrom: '2026-11-09',
}
function diary(): Diary {
  return {
    ...initialDiary(),
    pledges: [pledge],
    entries: [{
      id: 'entry',
      eventId: 'coffee',
      eventVersion: 1,
      name: 'Caffè',
      points: 50,
      occurredAt: '2026-11-12T10:00:00Z',
    }],
  }
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

it('mostra alla giocatrice scadenze e pegni da onorare senza comandi amministrativi', () => {
  render(<Pledges diary={diary()} now={now} />)
  expect(screen.getByRole('heading', { name: 'Scadenze' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Da onorare' })).toBeTruthy()
  expect(screen.getByText('50 / 100 punti nel periodo')).toBeTruthy()
  expect(screen.getByText('100 punti per evitare il pegno')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Riscuoti pegno' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Crea pegno' })).toBeNull()
  expect(screen.getByText(/riscattare premi non cambia la quota/)).toBeTruthy()
})

it('chiede conferma all’admin e conserva gli identificativi al nuovo tentativo', async () => {
  const execute = vi.fn(async (_command: Command) => false)
  const user = userEvent.setup()
  render(<Pledges diary={diary()} now={now} admin execute={execute} />)
  await user.click(screen.getByRole('button', { name: 'Riscuoti pegno' }))
  expect(execute).not.toHaveBeenCalled()
  expect(screen.getByText(/Confermi di aver ricevuto/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Conferma riscossione' }))
  await user.click(screen.getByRole('button', { name: 'Conferma riscossione' }))
  expect(execute).toHaveBeenCalledTimes(2)
  expect(execute.mock.calls[0][0]).toEqual(execute.mock.calls[1][0])
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({
    type: 'redeem-pledge',
    pledgeId: pledge.id,
    expectedVersion: 1,
    periodKey: '2026-11-09',
    at: now.toISOString(),
    id: expect.any(String),
    operationId: expect.any(String),
  }))
})

it('permette di scegliere settimana o mese e comunica la decorrenza del nuovo pegno', async () => {
  const execute = vi.fn(async () => true)
  const user = userEvent.setup()
  render(<Pledges diary={initialDiary()} now={now} admin execute={execute} />)
  await user.click(screen.getByRole('button', { name: 'Crea pegno' }))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByText(/dal 23 nov 2026/)).toBeTruthy()
  await user.type(dialog.getByRole('textbox', { name: 'Nome' }), 'Una cena preparata da te')
  await user.selectOptions(dialog.getByRole('combobox', { name: 'Periodo' }), 'month')
  expect(dialog.getByText(/dal 1 dic 2026/)).toBeTruthy()
  await user.clear(dialog.getByRole('spinbutton', { name: /Quota da raggiungere/ }))
  await user.type(dialog.getByRole('spinbutton', { name: /Quota da raggiungere/ }), '300')
  await user.click(dialog.getByRole('button', { name: 'Salva pegno' }))
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({
    type: 'save-pledge',
    expectedVersion: 0,
    value: expect.objectContaining({ name: 'Una cena preparata da te', target: 300, period: 'month' }),
  }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('blocca le riscossioni finché ci sono episodi da inviare e disabilita la gestione offline', () => {
  const state = diary()
  state.entries[0].sync = 'pending'
  render(<Pledges diary={state} now={now} admin execute={vi.fn()} canManage={false} />)
  expect(screen.getByText(/conteggio usa i punti confermati/)).toBeTruthy()
  for (const name of ['Riscuoti pegno', 'Crea pegno'])
    expect(screen.getByRole<HTMLButtonElement>('button', { name }).disabled).toBe(true)
})

it('modifica soltanto i periodi futuri e preserva la periodicità del pegno', async () => {
  const execute = vi.fn(async () => true)
  const user = userEvent.setup()
  render(<Pledges diary={diary()} now={now} admin execute={execute} />)
  await user.click(screen.getByRole('button', { name: 'Modifica' }))
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByRole<HTMLSelectElement>('combobox', { name: /Periodo/ }).disabled).toBe(true)
  expect(dialog.getByText(/dal 23 nov 2026/)).toBeTruthy()
  const target = dialog.getByRole('spinbutton', { name: /Quota da raggiungere/ })
  await user.clear(target)
  await user.type(target, '80')
  await user.click(dialog.getByRole('button', { name: 'Salva pegno' }))
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({
    type: 'save-pledge',
    expectedVersion: 1,
    value: expect.objectContaining({ id: pledge.id, target: 80, period: 'week' }),
  }))
})

it('consente di chiudere il modulo se la connessione si perde durante la modifica', async () => {
  const execute = vi.fn(async () => true)
  const user = userEvent.setup()
  const view = render(<Pledges diary={diary()} now={now} admin execute={execute} />)
  await user.click(screen.getByRole('button', { name: 'Modifica' }))
  view.rerender(<Pledges diary={diary()} now={now} admin execute={execute} canManage={false} />)
  await user.click(screen.getByRole('button', { name: 'Chiudi' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(execute).not.toHaveBeenCalled()
})

it('conserva lo storico delle riscossioni da verificare e lo rende visibile', () => {
  const state = diary()
  state.entries[0].points = 150
  state.pledgeClaims = [{
    id: 'claim',
    pledgeId: pledge.id,
    pledgeVersion: pledge.version,
    name: pledge.name,
    description: pledge.description,
    target: pledge.target,
    period: pledge.period,
    periodKey: '2026-11-09',
    points: 50,
    redeemedAt: '2026-11-16T10:00:00Z',
    needsReview: true,
  }]
  render(<Pledges diary={state} now={now} />)
  expect(screen.getByText('Riscosso · da verificare')).toBeTruthy()
  expect(screen.getByText(/I punti sono cambiati dopo la riscossione e ora raggiungono la quota/)).toBeTruthy()
  expect(screen.getByText('Storico dei pegni').closest('details')?.open).toBe(true)
})

it('riassume i pegni nella home e apre la loro pagina', async () => {
  const onOpen = vi.fn()
  const user = userEvent.setup()
  const view = render(<PledgeNotice diary={diary()} now={now} onOpen={onOpen} />)
  expect(screen.getByText('1 pegno da onorare')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Vedi i pegni' }))
  expect(onOpen).toHaveBeenCalledOnce()
  view.rerender(<PledgeNotice diary={initialDiary()} now={now} onOpen={onOpen} />)
  expect(screen.queryByLabelText('Avviso pegni')).toBeNull()
})

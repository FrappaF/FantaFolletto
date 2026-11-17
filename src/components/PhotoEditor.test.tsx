// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { PhotoEditor } from './Doormats'
import { noCrop } from '../photos/image'

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  decode: vi.fn(),
  process: vi.fn(),
}))
vi.mock('../photos/PhotoProvider', () => ({
  usePhotos: () => ({ add: mocks.add, busy: false, error: '' }),
}))
vi.mock('../photos/image', async (original) => ({
  ...(await original<typeof import('../photos/image')>()),
  decodePhoto: mocks.decode,
  processPhoto: mocks.process,
}))
const processed = {
  photo: new Blob(['foto']),
  thumbnail: new Blob(['thumb']),
  width: 1600,
  height: 1200,
  mime: 'image/webp',
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  URL.createObjectURL = vi.fn(() => 'blob:foto-test')
  URL.revokeObjectURL = vi.fn()
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.decode.mockResolvedValue({ naturalWidth: 4000, naturalHeight: 3000 })
  mocks.process.mockResolvedValue(processed)
  mocks.add.mockResolvedValue(true)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
it('usa un solo selettore e dopo la scelta mostra foto, didascalia e caricamento con parametri automatici', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T22:59:59Z'))
  const user = userEvent.setup()
  const close = vi.fn()
  render(<PhotoEditor onClose={close} />)
  expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1)
  await user.upload(
    screen.getByLabelText('Scegli foto'),
    new File(['foto'], 'zerbino.jpg', { type: 'image/jpeg' }),
  )
  expect(await screen.findByAltText(/Foto scelta/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Scegli una foto' })).toBeNull()
  expect(
    document.querySelector('input[type="date"], input[type="range"], select'),
  ).toBeNull()
  expect(screen.queryByText('Ritaglia la foto')).toBeNull()
  await user.type(
    screen.getByLabelText('Didascalia (facoltativa)'),
    'Benvenuti!',
  )
  // The modal was opened yesterday in Italy: the day is evaluated at saving.
  vi.setSystemTime(new Date('2026-11-16T23:00:01Z'))
  await user.click(screen.getByRole('button', { name: 'Carica foto' }))
  expect(mocks.process).toHaveBeenCalledWith(expect.anything(), 0, noCrop, 1600)
  expect(mocks.add).toHaveBeenCalledWith(processed, '2026-11-17', 'Benvenuti!')
  expect(close).toHaveBeenCalledOnce()
})
it('applica il ritaglio accessibile sulla foto e conserva immagine e didascalia se il salvataggio fallisce', async () => {
  mocks.add.mockResolvedValue(false)
  const user = userEvent.setup()
  const close = vi.fn()
  render(<PhotoEditor onClose={close} />)
  await user.upload(
    screen.getByLabelText('Scegli foto'),
    new File(['foto'], 'zerbino.jpg', { type: 'image/jpeg' }),
  )
  await screen.findByAltText(/Foto scelta/)
  screen
    .getByRole('button', { name: 'Angolo superiore sinistro del ritaglio' })
    .focus()
  await user.keyboard('{ArrowRight}{ArrowDown}')
  await user.type(
    screen.getByLabelText('Didascalia (facoltativa)'),
    'Da conservare',
  )
  await user.click(screen.getByRole('button', { name: 'Carica foto' }))
  expect(mocks.process).toHaveBeenCalledWith(
    expect.anything(),
    0,
    { left: 1, top: 1, right: 0, bottom: 0 },
    1600,
  )
  expect(close).not.toHaveBeenCalled()
  expect(
    within(screen.getByRole('dialog')).getByAltText(/Foto scelta/),
  ).toBeTruthy()
  expect(
    (screen.getByLabelText('Didascalia (facoltativa)') as HTMLTextAreaElement)
      .value,
  ).toBe('Da conservare')
})
it('consente di scegliere di nuovo dopo un file illeggibile', async () => {
  mocks.decode.mockRejectedValueOnce(new Error('Foto non leggibile.'))
  const user = userEvent.setup()
  render(<PhotoEditor onClose={() => {}} />)
  const input = screen.getByLabelText('Scegli foto')
  await user.upload(input, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Scegli una foto' })).toBeTruthy()
  await user.upload(
    input,
    new File(['valida'], 'foto.jpg', { type: 'image/jpeg' }),
  )
  await screen.findByAltText(/Foto scelta/)
  expect(screen.queryByRole('alert')).toBeNull()
})

it('cambia foto dallo stesso selettore, mantiene la didascalia e azzera solo il ritaglio', async () => {
  const user = userEvent.setup()
  const replacement = { naturalWidth: 3000, naturalHeight: 4000 }
  render(<PhotoEditor onClose={() => {}} />)
  const input = screen.getByLabelText('Scegli foto') as HTMLInputElement
  await user.upload(
    input,
    new File(['prima'], 'prima.jpg', { type: 'image/jpeg' }),
  )
  await screen.findByAltText(/Foto scelta/)
  screen
    .getByRole('button', { name: 'Angolo superiore sinistro del ritaglio' })
    .focus()
  await user.keyboard('{ArrowRight}')
  await user.type(
    screen.getByLabelText('Didascalia (facoltativa)'),
    'La mia didascalia',
  )
  const click = vi.spyOn(input, 'click')
  await user.click(screen.getByRole('button', { name: 'Cambia foto' }))
  expect(click).toHaveBeenCalledOnce()
  fireEvent.change(input, { target: { files: [] } })
  expect(screen.getByAltText(/Foto scelta/)).toBeTruthy()
  expect(
    document.querySelector<HTMLElement>('.photo-crop-selection')!.style.left,
  ).toBe('1%')
  mocks.decode.mockResolvedValueOnce(replacement)
  await user.upload(
    input,
    new File(['seconda'], 'seconda.jpg', { type: 'image/jpeg' }),
  )
  expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1)
  expect(
    document.querySelector<HTMLElement>('.photo-crop-selection')!.style.left,
  ).toBe('0%')
  await user.click(screen.getByRole('button', { name: 'Carica foto' }))
  expect(mocks.process).toHaveBeenCalledWith(replacement, 0, noCrop, 1600)
  expect(mocks.add.mock.calls[0][2]).toBe('La mia didascalia')
})

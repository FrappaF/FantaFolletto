import { beforeEach, expect, it, vi } from 'vitest'
import type { Client } from '../remote/client'
import { digest, type Doormat } from './model'
import { photoTransport } from './transport'
const mocks = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.create }))
const userId = '10000000-0000-4000-8000-000000000001'
const files = {
  photo: new Blob(['photo'], { type: 'image/jpeg' }),
  thumbnail: new Blob(['thumb'], { type: 'image/jpeg' }),
}
let api: {
  rpc: ReturnType<typeof vi.fn>
  storage: { from: ReturnType<typeof vi.fn> }
}
let storage: {
  upload: ReturnType<typeof vi.fn>
  download: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}
let client: Client
async function fixture(): Promise<Doormat> {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    createdBy: userId,
    createdAt: '2026-11-17T12:00:00Z',
    day: '2026-11-17',
    caption: '',
    width: 100,
    height: 100,
    bytes: 5,
    thumbnailBytes: 5,
    mime: 'image/jpeg',
    digest: await digest(files.photo),
    thumbnailDigest: await digest(files.thumbnail),
    status: 'uploading',
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  storage = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    download: vi.fn(),
    remove: vi.fn().mockResolvedValue({ error: null }),
  }
  api = {
    rpc: vi
      .fn()
      .mockImplementation(async (name) => ({
        data: name === 'prepare_doormat' ? 'uploading' : [],
        error: null,
      })),
    storage: { from: vi.fn().mockReturnValue(storage) },
  }
  mocks.create.mockReturnValue(api)
  client = {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({
          data: {
            session: { user: { id: userId }, access_token: 'token-originale' },
          },
        }),
    },
  } as unknown as Client
})
const transport = () =>
  photoTransport(
    client,
    { url: 'https://example.supabase.co', key: 'publishable-test' },
    userId,
  )
it('blocca una sessione diversa prima di qualunque invio o download', async () => {
  vi.mocked(client.auth.getSession).mockResolvedValue({
    data: { session: null },
    error: null,
  })
  await expect(transport().list()).rejects.toThrow(/stesso account/)
  await expect(transport().download(await fixture(), false)).rejects.toThrow(
    /stesso account/,
  )
  expect(mocks.create).not.toHaveBeenCalled()
})
it('usa lo stesso token per RPC e Storage e conferma dopo entrambe le varianti', async () => {
  const p = await fixture()
  await transport().upload(p, files)
  expect(await mocks.create.mock.calls[0][2].accessToken()).toBe(
    'token-originale',
  )
  expect(storage.upload).toHaveBeenCalledTimes(2)
  expect(storage.upload.mock.calls[0][0]).toBe(
    `${userId}/${p.id}/photo-${p.digest}`,
  )
  expect(storage.upload.mock.calls[1][0]).toBe(
    `${userId}/${p.id}/thumb-${p.thumbnailDigest}`,
  )
  expect(storage.upload.mock.calls[0][2].upsert).toBe(false)
  expect(api.rpc.mock.calls.at(-1)).toEqual([
    'finalize_doormat',
    { client_id: p.id },
  ])
})
it('recupera un upload acquisito prima del timeout confrontando il digest senza sovrascrivere', async () => {
  const p = await fixture()
  storage.upload.mockResolvedValueOnce({ error: { message: 'already exists' } })
  storage.download.mockResolvedValueOnce({ data: files.photo, error: null })
  await transport().upload(p, files)
  expect(storage.download).toHaveBeenCalledOnce()
  expect(api.rpc.mock.calls.at(-1)![0]).toBe('finalize_doormat')
})
it('non finalizza se un oggetto esistente ha un contenuto incompatibile', async () => {
  storage.upload.mockResolvedValueOnce({ error: { message: 'already exists' } })
  storage.download.mockResolvedValueOnce({
    data: new Blob(['wrong']),
    error: null,
  })
  await expect(transport().upload(await fixture(), files)).rejects.toThrow(
    /non completato/,
  )
  expect(api.rpc).toHaveBeenCalledTimes(1)
})
it('rispetta una conferma precedente o una rimozione definitiva senza nuovi upload', async () => {
  const p = await fixture()
  for (const status of ['ready', 'removed']) {
    api.rpc.mockResolvedValueOnce({ data: status, error: null })
    await transport().upload(p, files)
  }
  expect(storage.upload).not.toHaveBeenCalled()
})
it('segna la rimozione prima di pulire i due file e conserva l’errore se la pulizia fallisce', async () => {
  const p = await fixture()
  storage.remove.mockResolvedValueOnce({ error: { message: 'offline' } })
  await expect(transport().remove(p)).rejects.toThrow(/pulizia/)
  expect(api.rpc.mock.calls.map((call) => call[0])).toEqual([
    'prepare_doormat',
    'remove_doormat',
  ])
  expect(storage.remove.mock.calls[0][0]).toHaveLength(2)
})

import { createClient } from '@supabase/supabase-js'
import type { Client, RemoteConfig } from '../remote/client'
import {
  digest,
  objectPath,
  parseDoormat,
  type Doormat,
  type PhotoFiles,
  type PhotoTransport,
} from './model'

const bucket = 'doormats'
export function photoTransport(
  client: Client,
  config: RemoteConfig,
  userId: string,
): PhotoTransport {
  async function scoped() {
    const { data, error } = await client.auth.getSession()
    if (error || data.session?.user.id !== userId)
      throw new Error(
        'Accedi con lo stesso account per riprendere l’invio delle foto.',
      )
    // Freeze the caller's token for the entire request, including Storage.
    const token = data.session.access_token
    return createClient(config.url, config.key, {
      accessToken: async () => token,
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(30000),
          }),
      },
    })
  }
  async function prepare(api: Client, photo: Doormat) {
    const { data, error } = await api.rpc('prepare_doormat', {
      photo: {
        ...photo,
        status: undefined,
      },
    })
    if (error) throw new Error(error.message)
    return data as string
  }
  return {
    async list() {
      const api = await scoped()
      const { data, error } = await api.rpc('list_doormats')
      if (error)
        throw new Error(
          'La raccolta foto non è raggiungibile. Gli invii sul telefono sono conservati. Riprova online.',
        )
      if (!Array.isArray(data))
        throw new Error('Raccolta foto non compatibile. Aggiorna l’app.')
      return data.map(parseDoormat)
    },
    async upload(photo, files: PhotoFiles) {
      const api = await scoped()
      const status = await prepare(api, photo)
      if (status === 'ready' || status === 'removed') return
      const storage = api.storage.from(bucket)
      for (const thumbnail of [false, true]) {
        const file = thumbnail ? files.thumbnail : files.photo
        const expected = thumbnail ? photo.thumbnailDigest : photo.digest
        if ((await digest(file)) !== expected)
          throw new Error(
            'Il file sul telefono non corrisponde alla foto. Rimuovi l’invio e scegli di nuovo la foto.',
          )
        const path = objectPath(photo, thumbnail)
        const { error } = await storage.upload(path, file, {
          contentType: photo.mime,
          upsert: false,
          cacheControl: '3600',
        })
        if (error) {
          // Upload may have completed before a timeout, or in another tab.
          // Never overwrite a file on retry: verify bytes already acquired.
          const existing = await storage.download(path)
          if (
            existing.error ||
            !existing.data ||
            (await digest(existing.data)) !== expected
          )
            throw new Error(
              'Caricamento non completato. Controlla la connessione e lo spazio disponibile nel servizio, poi riprova.',
            )
        }
      }
      const { error } = await api.rpc('finalize_doormat', {
        client_id: photo.id,
      })
      if (error) throw new Error(error.message)
    },
    async remove(photo) {
      const api = await scoped()
      // Reserve even a not-yet-uploaded photo before removing it: the tombstone
      // prevents a late upload in another tab from resurrecting the image.
      if (photo.createdBy === userId) await prepare(api, photo)
      const { error } = await api.rpc('remove_doormat', { client_id: photo.id })
      if (error) throw new Error(error.message)
      const removed = await api.storage
        .from(bucket)
        .remove([objectPath(photo, false), objectPath(photo, true)])
      if (removed.error)
        throw new Error(
          'Foto rimossa dalla raccolta. La pulizia dei file riprenderà online.',
        )
    },
    async download(photo, thumbnail) {
      const api = await scoped()
      const { data, error } = await api.storage
        .from(bucket)
        .download(objectPath(photo, thumbnail))
      if (error || !data)
        throw new Error('Foto non disponibile. Riprova online.')
      return data
    },
  }
}

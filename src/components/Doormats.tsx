import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { ArrowLeft, Check, ImagePlus, Trash2 } from 'lucide-react'
import { dayKey } from '../domain/stats'
import { usePhotos } from '../photos/PhotoProvider'
import { decodePhoto, noCrop, processPhoto, type Crop } from '../photos/image'
import { formatBytes, type Doormat } from '../photos/model'
import { EmptyState, Modal } from './ui'
const PhotoCropper = lazy(() =>
  import('./PhotoCropper').then((module) => ({ default: module.PhotoCropper })),
)

function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const value = URL.createObjectURL(blob)
    setUrl(value)
    return () => URL.revokeObjectURL(value)
  }, [blob])
  return url
}

function PhotoImage({
  photo,
  thumbnail = false,
}: {
  photo: Doormat
  thumbnail?: boolean
}) {
  const photos = usePhotos()
  const [blob, setBlob] = useState<Blob>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const container = useRef<HTMLDivElement>(null)
  const url = useBlobUrl(blob)
  useEffect(() => {
    let active = true
    let started = false
    const load = () => {
      if (started) return
      started = true
      setError('')
      void photos
        .getImage(photo, thumbnail)
        .then((file) => {
          if (active) setBlob(file)
        })
        .catch((error) => {
          if (active)
            setError(
              error instanceof Error ? error.message : 'Foto non disponibile.',
            )
        })
    }
    const observer =
      thumbnail && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting) {
                load()
                observer?.disconnect()
              }
            },
            { rootMargin: '200px' },
          )
        : undefined
    if (observer && container.current) observer.observe(container.current)
    else load()
    return () => {
      active = false
      observer?.disconnect()
    }
  }, [photos.scope, photo.id, photo.status, thumbnail, attempt])
  return (
    <div
      className={`doormat-image ${thumbnail ? 'doormat-thumbnail' : ''}`}
      ref={container}
    >
      {url ? (
        <img
          src={url}
          width={photo.width}
          height={photo.height}
          alt={photo.caption || 'Uno zerbino da ricordare'}
          loading={thumbnail ? 'lazy' : 'eager'}
        />
      ) : (
        <span role="status">{error || 'Apro la foto…'}</span>
      )}
      {error && (
        <button
          type="button"
          className="text-button"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Riprova foto
        </button>
      )}
    </div>
  )
}

export function PhotoEditor({
  onClose,
}: {
  onClose: (saved?: boolean) => void
}) {
  const photos = usePhotos()
  const [chosen, setChosen] = useState<{
    source: HTMLImageElement
    url: string
  }>()
  const source = chosen?.source
  const url = chosen?.url
  const [crop, setCrop] = useState<Crop>(noCrop)
  const [cropReady, setCropReady] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const [caption, setCaption] = useState('')
  const [attempted, setAttempted] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const sequence = useRef(0)
  const saving = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const headingId = useId()
  const working = preparing || photos.busy
  useEffect(() => {
    if (heading.current?.getClientRects().length) {
      heading.current.focus({ preventScroll: true })
      window.scrollTo({ top: 0 })
    }
  }, [])
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])
  useEffect(
    () => () => {
      ++sequence.current
    },
    [],
  )

  async function select(file?: File) {
    if (!file) return
    const current = ++sequence.current
    setPreparing(true)
    setError('')
    setAttempted(false)
    try {
      const decoded = await decodePhoto(file)
      if (sequence.current !== current) return
      // Keep the decoded source and its live preview URL in one update.
      setChosen({ source: decoded, url: URL.createObjectURL(file) })
      setCrop(noCrop)
      setCropReady(false)
    } catch (error) {
      if (sequence.current === current)
        setError(error instanceof Error ? error.message : 'Foto non leggibile.')
    } finally {
      if (sequence.current === current) setPreparing(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!source || !cropReady || working || saving.current) return
    saving.current = true
    setAttempted(true)
    const current = sequence.current
    setPreparing(true)
    setError('')
    try {
      const processed = await processPhoto(source, 0, crop, 1600)
      if (sequence.current !== current) return
      if (await photos.add(processed, dayKey(new Date()), caption))
        onClose(true)
    } catch (error) {
      if (sequence.current === current)
        setError(
          error instanceof Error
            ? error.message
            : 'Non riesco a preparare la foto. Riprova.',
        )
    } finally {
      saving.current = false
      if (sequence.current === current) setPreparing(false)
    }
  }
  return (
    <section
      className="diary-collection photo-upload-page"
      aria-labelledby={headingId}
    >
      <button
        type="button"
        className="text-button back-link"
        disabled={working}
        onClick={() => onClose()}
      >
        <ArrowLeft size={18} aria-hidden="true" /> Torna agli zerbini
      </button>
      <div className="page-title">
        <span className="eyebrow">Un nuovo ricordo</span>
        <h1 id={headingId} ref={heading} tabIndex={-1}>
          Aggiungi foto<span className="green-dot">.</span>
        </h1>
      </div>
      <form
        className="collection-form photo-editor"
        aria-label="Carica uno zerbino"
        onSubmit={(event) => void save(event)}
      >
        <input
          className="photo-file-input"
          hidden
          ref={picker}
          aria-label="Scegli foto"
          type="file"
          accept="image/*"
          disabled={working}
          onChange={(event) => {
            void select(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        {source && url ? (
          <>
            <div className="photo-preview-card">
              <div className="photo-preview-toolbar">
                <button
                  type="button"
                  className="text-button"
                  disabled={working}
                  onClick={() => picker.current?.click()}
                >
                  Cambia foto
                </button>
              </div>
              <Suspense fallback={<p role="status">Apro la foto…</p>}>
                <PhotoCropper
                  source={source}
                  url={url}
                  onChange={setCrop}
                  onReadyChange={setCropReady}
                  onError={setError}
                  disabled={working}
                />
              </Suspense>
              <p className="photo-crop-hint">
                Trascina gli angoli per ritagliare. Allarga con due dita per
                ingrandire.
              </p>
            </div>
            <label>
              Didascalia (facoltativa)
              <textarea
                maxLength={300}
                rows={2}
                value={caption}
                disabled={working}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Quel benvenuto che ti ha fatto sorridere…"
              />
            </label>
            <button
              className="primary-button full-width"
              type="submit"
              disabled={working || !cropReady}
            >
              {working ? 'Carico la foto…' : 'Carica foto'}
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label="Scegli una foto"
            className="photo-choose"
            disabled={working}
            onClick={() => picker.current?.click()}
          >
            <ImagePlus size={32} aria-hidden="true" />
            <strong>{preparing ? 'Apro la foto…' : 'Scegli una foto'}</strong>
            <span>Dalla libreria o dalla fotocamera</span>
          </button>
        )}
        {(error || (attempted && photos.error)) && (
          <p className="form-error" role="alert">
            {error || photos.error}
          </p>
        )}
      </form>
    </section>
  )
}

export function Doormats({
  onEditingChange,
}: {
  onEditingChange?: (editing: boolean) => void
}) {
  const photos = usePhotos()
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Doormat>()
  const [removing, setRemoving] = useState<Doormat>()
  const [limit, setLimit] = useState(24)
  const [message, setMessage] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const items = photos.items
    .filter((p) => p.status !== 'removed')
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id),
    )
  const failures = photos.queue.filter((p) => p.error)
  if (adding)
    return (
      <PhotoEditor
        onClose={(saved) => {
          setAdding(false)
          onEditingChange?.(false)
          if (saved)
            setMessage(
              photos.shared
                ? 'Foto salvata sul telefono, pronta per l’invio.'
                : 'Foto salvata nella raccolta.',
            )
          window.requestAnimationFrame(() => {
            if (heading.current?.getClientRects().length) {
              heading.current.focus({ preventScroll: true })
              window.scrollTo({ top: 0 })
            }
          })
        }}
      />
    )
  return (
    <section className="diary-collection">
      <div className="page-title">
        <span className="eyebrow">Un sorriso sulla soglia</span>
        <h1 ref={heading} tabIndex={-1}>
          Zerbini da ricordare<span className="green-dot">.</span>
        </h1>
        <p>I benvenuti più buffi incontrati lungo la strada.</p>
      </div>
      <div className="collection-actions">
        <button
          className="primary-button record-button"
          disabled={!photos.ready}
          onClick={() => {
            setMessage('')
            setAdding(true)
            onEditingChange?.(true)
          }}
        >
          <ImagePlus size={21} /> Aggiungi foto
        </button>
        {message && (
          <p className="note-feedback" role="status">
            <Check size={16} />
            {message}
          </p>
        )}
      </div>
      <p className="demo-footnote">
        {photos.shared
          ? 'Foto condivise con l’altro account.'
          : 'Le foto della demo restano in questo browser.'}{' '}
        Non assegnano punti.
      </p>
      {(photos.error || photos.queue.length > 0) && (
        <div className="photo-sync notice" role="status">
          <p>
            {photos.error ||
              (failures.length
                ? failures[0].error
                : `${photos.queue.length} operazioni foto in attesa di conferma.`)}
          </p>
          <button
            className="text-button"
            disabled={photos.syncing}
            onClick={() => void photos.refresh()}
          >
            {photos.syncing ? 'Invio in corso…' : 'Riprova invio foto'}
          </button>
        </div>
      )}
      {!photos.ready ? (
        <p role="status">Apro la raccolta…</p>
      ) : items.length ? (
        <>
          <div className="doormat-grid">
            {items.slice(0, limit).map((photo) => {
              const pending = photos.queue.find(
                (op) => op.photo.id === photo.id,
              )
              return (
                <article className="panel doormat-card" key={photo.id}>
                  <PhotoImage photo={photo} thumbnail />
                  <div className="doormat-caption">
                    <p>{photo.caption || 'Un benvenuto speciale'}</p>
                    <time dateTime={photo.day}>
                      {new Intl.DateTimeFormat('it-IT', {
                        dateStyle: 'medium',
                        timeZone: 'Europe/Rome',
                      }).format(new Date(`${photo.day}T12:00:00Z`))}
                    </time>
                    <small>
                      {pending?.error
                        ? 'Invio da riprovare'
                        : pending
                          ? 'Salvata sul telefono · in attesa di invio'
                          : photos.shared
                            ? photo.status === 'uploading'
                              ? 'Caricamento da completare sul telefono di origine'
                              : 'Sincronizzata'
                            : 'Salvata in questo browser'}
                    </small>
                    <div className="doormat-actions">
                      <button
                        className="text-button"
                        onClick={() => setSelected(photo)}
                      >
                        Apri foto
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Rimuovi foto: ${photo.caption || 'zerbino'}`}
                        disabled={photos.busy}
                        onClick={() => setRemoving(photo)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          {items.length > limit && (
            <button
              className="secondary-button"
              onClick={() => setLimit((n) => n + 24)}
            >
              Mostra altre foto
            </button>
          )}
        </>
      ) : (
        <section className="panel">
          <EmptyState title="Il prossimo sorriso è sulla soglia">
            Fotografa uno zerbino divertente. Qui ritroverai tutti i tuoi
            benvenuti preferiti.
          </EmptyState>
        </section>
      )}
      {selected && (
        <Modal
          title={selected.caption || 'Un benvenuto speciale'}
          onClose={() => setSelected(undefined)}
        >
          <PhotoImage photo={selected} />
          <p className="field-hint">
            {selected.width} × {selected.height} px ·{' '}
            {formatBytes(selected.bytes)}
          </p>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Rimuovere questa foto?"
          busy={photos.busy}
          onClose={() => setRemoving(undefined)}
        >
          <p className="modal-description">
            La foto verrà rimossa dalla raccolta
            {photos.shared ? ' condivisa' : ''}.{' '}
            {photos.shared &&
              'Se sei offline, la rimozione sarà completata al prossimo invio.'}
          </p>
          {photos.error && (
            <p role="alert" className="form-error">
              {photos.error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={photos.busy}
              onClick={() => setRemoving(undefined)}
            >
              Tieni la foto
            </button>
            <button
              className="primary-button"
              disabled={photos.busy}
              onClick={async () => {
                if (await photos.remove(removing)) {
                  setRemoving(undefined)
                  setMessage(
                    photos.shared
                      ? 'Rimozione salvata sul telefono, pronta per l’invio.'
                      : 'Foto rimossa dalla raccolta.',
                  )
                }
              }}
            >
              Rimuovi foto
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

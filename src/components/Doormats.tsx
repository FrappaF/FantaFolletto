import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Camera,
  Check,
  ImagePlus,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { dayKey } from '../domain/stats'
import { validDay } from '../domain/validation'
import { usePhotos } from '../photos/PhotoProvider'
import {
  decodePhoto,
  noCrop,
  processPhoto,
  type Crop,
  type ProcessedPhoto,
} from '../photos/image'
import { formatBytes, type Doormat } from '../photos/model'
import { EmptyState, Modal } from './ui'

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

function PhotoEditor({ now, onClose }: { now: Date; onClose: () => void }) {
  const photos = usePhotos()
  const [source, setSource] = useState<HTMLImageElement>()
  const [originalBytes, setOriginalBytes] = useState(0)
  const [crop, setCrop] = useState<Crop>(noCrop)
  const [rotation, setRotation] = useState(0)
  const [maximum, setMaximum] = useState<1280 | 1600>(1600)
  const [processed, setProcessed] = useState<ProcessedPhoto>()
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const [day, setDay] = useState(dayKey(now))
  const [caption, setCaption] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const sequence = useRef(0)
  const url = useBlobUrl(processed?.photo)
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
    setSource(undefined)
    setProcessed(undefined)
    try {
      const decoded = await decodePhoto(file)
      if (sequence.current !== current) return
      setSource(decoded)
      setOriginalBytes(file.size)
      setRotation(0)
      setCrop(noCrop)
    } catch (error) {
      if (sequence.current === current)
        setError(error instanceof Error ? error.message : 'Foto non leggibile.')
    } finally {
      if (sequence.current === current) setPreparing(false)
    }
  }
  useEffect(() => {
    if (!source) return
    let active = true
    setProcessed(undefined)
    setPreparing(true)
    const timer = window.setTimeout(() => {
      void processPhoto(source, rotation, crop, maximum)
        .then((value) => {
          if (active) {
            setProcessed(value)
            setError('')
          }
        })
        .catch((error) => {
          if (active)
            setError(
              error instanceof Error
                ? error.message
                : 'Elaborazione non riuscita.',
            )
        })
        .finally(() => {
          if (active) setPreparing(false)
        })
    }, 150)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [source, rotation, crop, maximum])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!processed || preparing || !validDay(day)) return
    if (await photos.add(processed, day, caption)) onClose()
  }
  return (
    <Modal
      title="Uno zerbino da ricordare"
      scrollCloseButton
      busy={photos.busy}
      onClose={onClose}
    >
      <form
        className="collection-form photo-editor"
        onSubmit={(event) => void save(event)}
      >
        <p className="modal-description">
          Scegli la foto, sistema l’inquadratura e lascia a noi il peso.
        </p>
        <input
          hidden
          ref={picker}
          aria-label="Foto dalla libreria"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          onChange={(event) => {
            void select(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <input
          hidden
          ref={camera}
          aria-label="Foto dalla fotocamera"
          type="file"
          capture="environment"
          accept="image/*"
          onChange={(event) => {
            void select(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <div className="photo-source-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={photos.busy}
            onClick={() => picker.current?.click()}
          >
            <ImagePlus size={18} /> Scegli foto
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={photos.busy}
            onClick={() => camera.current?.click()}
          >
            <Camera size={18} /> Scatta
          </button>
        </div>
        {preparing && (
          <p className="field-hint" role="status">
            Preparo una foto più leggera…
          </p>
        )}
        {url && processed && (
          <>
            <div className="photo-editor-preview">
              <img src={url} alt="Anteprima della foto da salvare" />
            </div>
            <p className="photo-size" role="status">
              <strong>
                {formatBytes(originalBytes)} →{' '}
                {formatBytes(processed.photo.size)}
              </strong>
              <span>
                {processed.width} × {processed.height} px · miniatura{' '}
                {formatBytes(processed.thumbnail.size)}
              </span>
            </p>
          </>
        )}
        {source && (
          <fieldset disabled={photos.busy}>
            <div className="photo-source-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setRotation((n) => (n + 90) % 360)
                  setCrop(noCrop)
                }}
              >
                <RotateCw size={17} /> Ruota
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setRotation(0)
                  setCrop(noCrop)
                }}
              >
                <RotateCcw size={17} /> Ripristina
              </button>
            </div>
            <details className="photo-crop">
              <summary>Ritaglia la foto</summary>
              <p className="field-hint">
                Riduci i bordi per tenere solo lo zerbino. Controlla che la
                scritta resti intera.
              </p>
              {(
                [
                  ['left', 'Bordo sinistro'],
                  ['right', 'Bordo destro'],
                  ['top', 'Bordo superiore'],
                  ['bottom', 'Bordo inferiore'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label} · {crop[key]}%
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="1"
                    value={crop[key]}
                    onChange={(event) =>
                      setCrop((value) => ({
                        ...value,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </details>
            <label>
              Dimensione
              <select
                value={maximum}
                onChange={(event) =>
                  setMaximum(Number(event.target.value) as 1280 | 1600)
                }
              >
                <option value={1600}>Standard · fino a 1600 px</option>
                <option value={1280}>Leggera · fino a 1280 px</option>
              </select>
            </label>
            <label>
              Giornata
              <input
                type="date"
                required
                min="0001-01-01"
                max="9999-12-31"
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
            </label>
            <label>
              Didascalia (facoltativa)
              <textarea
                maxLength={300}
                rows={3}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Quel benvenuto che ti ha fatto sorridere…"
              />
            </label>
          </fieldset>
        )}
        {(error || photos.error) && (
          <p className="form-error" role="alert">
            {error || photos.error}
          </p>
        )}
        <p className="field-hint">
          Si salva una copia ottimizzata, senza copiare i dati di posizione.
          Le foto già nella tua libreria restano intatte.
        </p>
        <div className="form-actions">
          <button
            className="primary-button"
            disabled={!processed || preparing || photos.busy || !validDay(day)}
          >
            {photos.busy ? 'Salvo…' : 'Salva foto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function Doormats({ now }: { now: Date }) {
  const photos = usePhotos()
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Doormat>()
  const [removing, setRemoving] = useState<Doormat>()
  const [limit, setLimit] = useState(24)
  const [message, setMessage] = useState('')
  const items = photos.items
    .filter((p) => p.status !== 'removed')
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id),
    )
  const failures = photos.queue.filter((p) => p.error)
  return (
    <section className="diary-collection">
      <div className="page-title">
        <span className="eyebrow">Un sorriso sulla soglia</span>
        <h1>
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
      {adding && <PhotoEditor now={now} onClose={() => setAdding(false)} />}
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

import { useRef, useState, type FormEvent } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { Command, DailyNote, Diary } from '../domain/model'
import { newId } from '../domain/ids'
import { dayKey } from '../domain/stats'
import { validDay } from '../domain/validation'
import { EmptyState, Modal, SectionHeading } from './ui'

const formatDay = (day: string) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    dateStyle: 'full',
  }).format(new Date(`${day}T12:00:00Z`))

export function DailyNotes({
  diary,
  now,
  busy,
  error,
  execute,
  shared,
}: {
  diary: Diary
  now: Date
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  shared: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<DailyNote>()
  const [day, setDay] = useState(dayKey(now))
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const notes = (diary.notes ?? []).filter((item) => !item.removedAt)
  const days = [...new Set(notes.map((item) => item.day))].sort().reverse()
  const working = busy || saving

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || busy || !text.trim() || !validDay(day)) return
    lock.current = true
    setSaving(true)
    try {
      if (
        await execute({
          type: 'add-note',
          value: {
            id: newId(),
            day,
            text: text.trim(),
            createdAt: new Date().toISOString(),
          },
        })
      ) {
        setAdding(false)
        setText('')
        setMessage(
          shared
            ? 'Nota salvata sul telefono, pronta per l’invio.'
            : 'Nota salvata in questo browser.',
        )
      }
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  async function remove() {
    if (!removing || lock.current || busy) return
    lock.current = true
    setSaving(true)
    try {
      if (
        await execute({
          type: 'remove-note',
          id: removing.id,
          at: new Date().toISOString(),
        })
      ) {
        setRemoving(undefined)
        setMessage('Nota rimossa dal diario.')
      }
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return (
    <section
      className="diary-collection"
      data-update-blocked={adding || !!removing || saving ? 'true' : 'false'}
    >
      <div className="page-title">
        <span className="eyebrow">Una pagina per ogni giornata</span>
        <h1>
          Note giornaliere<span className="green-dot">.</span>
        </h1>
        <p>
          Una risata, un imprevisto, una piccola scoperta. Scrivi quello che
          vuoi ricordare.
        </p>
      </div>
      <div className="collection-actions">
        <button
          className="primary-button record-button"
          onClick={() => {
            if (!text) setDay(dayKey(now))
            setMessage('')
            setAdding(true)
          }}
        >
          <Plus size={21} aria-hidden="true" /> Scrivi una nota
        </button>
        {message && (
          <p className="note-feedback" role="status">
            <Check size={16} aria-hidden="true" />
            {message}
          </p>
        )}
      </div>
      <p className="demo-footnote">
        {shared
          ? 'Le note sono condivise con l’altro account.'
          : 'Le note della demo restano in questo browser.'}{' '}
        Non assegnano punti.
      </p>
      {days.length ? (
        <div className="daily-notes">
          {days.map((noteDay) => (
            <section
              className="panel"
              key={noteDay}
              aria-label={`Note di ${formatDay(noteDay)}`}
            >
              <SectionHeading title={formatDay(noteDay)} />
              <ul className="note-list">
                {notes
                  .filter((note) => note.day === noteDay)
                  .sort(
                    (a, b) =>
                      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
                      a.id.localeCompare(b.id),
                  )
                  .map((note) => (
                    <li key={note.id}>
                      <article className="note-card">
                        <div className="note-content">
                          <p>{note.text}</p>
                          {shared && (
                            <small>
                              {note.sync === 'pending'
                                ? 'In attesa di invio'
                                : note.sync === 'error'
                                  ? 'Da correggere: vedi gli invii'
                                  : 'Condivisa'}
                            </small>
                          )}
                        </div>
                        <button
                          className="icon-button"
                          disabled={working || note.sync === 'error'}
                          aria-label={`Rimuovi nota: ${note.text.slice(0, 60)}`}
                          onClick={() => {
                            setMessage('')
                            setRemoving(note)
                          }}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      </article>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState title="Le tue giornate hanno una storia">
            Scrivi la prima nota. Qui ritroverai i tuoi ricordi, giorno per
            giorno.
          </EmptyState>
        </section>
      )}
      {adding && (
        <Modal
          title="Scrivi una nota"
          busy={working}
          onClose={() => setAdding(false)}
        >
          <p className="modal-description">
            Puoi aggiungere più note alla stessa giornata.
          </p>
          <form className="collection-form" onSubmit={(event) => void save(event)}>
            <fieldset disabled={working}>
              <label>
                Giornata
                <input
                  required
                  type="date"
                  min="0001-01-01"
                  max="9999-12-31"
                  value={day}
                  onChange={(event) => setDay(event.target.value)}
                />
              </label>
              <div>
                <label>
                  Cosa è successo?
                  <textarea
                    autoFocus
                    required
                    maxLength={2000}
                    rows={7}
                    value={text}
                    placeholder="Oggi è successa una cosa da ricordare…"
                    onChange={(event) => setText(event.target.value)}
                    aria-describedby="note-length"
                  />
                </label>
                <p id="note-length" className="field-hint">
                  {text.length} / 2000 caratteri
                </p>
              </div>
            </fieldset>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={working || !text.trim() || !validDay(day)}
              >
                {working ? 'Salvo…' : 'Salva nota'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Rimuovere questa nota?"
          busy={working}
          onClose={() => setRemoving(undefined)}
        >
          <p className="modal-description">
            La nota di {formatDay(removing.day)} verrà rimossa dal diario
            {shared ? ' condiviso' : ''}.
          </p>
          <blockquote className="note-preview">{removing.text}</blockquote>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={working}
              onClick={() => setRemoving(undefined)}
            >
              Tieni la nota
            </button>
            <button
              className="primary-button"
              disabled={working}
              onClick={() => void remove()}
            >
              Rimuovi nota
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

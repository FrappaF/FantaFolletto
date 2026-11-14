import { useRef, useState, type FormEvent } from 'react'
import { Check, Plus, Smile, Trash2 } from 'lucide-react'
import type { Command, Diary, SurnameCombo } from '../domain/model'
import { newId } from '../domain/ids'
import { EmptyState, Modal, SectionHeading } from './ui'

export function Combos({
  diary,
  busy,
  error,
  execute,
  shared,
}: {
  diary: Diary
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  shared: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<SurnameCombo>()
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const combos = (diary.combos ?? [])
    .filter((item) => !item.removedAt)
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        a.id.localeCompare(b.id),
    )

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || busy || !first.trim()) return
    lock.current = true
    setSaving(true)
    try {
      if (
        await execute({
          type: 'add-combo',
          value: {
            id: newId(),
            firstSurname: first.trim(),
            secondSurname: second.trim(),
            note: note.trim(),
            createdAt: new Date().toISOString(),
          },
        })
      ) {
        setAdding(false)
        setFirst('')
        setSecond('')
        setNote('')
        setMessage(
          shared
            ? 'Combo salvata sul telefono, pronta per l’invio.'
            : 'Combo salvata in questo browser.',
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
          type: 'remove-combo',
          id: removing.id,
          at: new Date().toISOString(),
        })
      ) {
        setRemoving(undefined)
        setMessage('Combo rimossa dalla raccolta.')
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
        <span className="eyebrow">Da leggere con un sorriso</span>
        <h1>
          I cognomi migliori<span className="green-dot">.</span>
        </h1>
        <p>Da soli o in combo: certe scoperte meritano un posto nel diario.</p>
      </div>
      <div className="collection-actions">
        <button
          className="primary-button record-button"
          onClick={() => {
            setMessage('')
            setAdding(true)
          }}
        >
          <Plus size={21} aria-hidden="true" /> Aggiungi una combo
        </button>
        {message && (
          <p className="combo-feedback" role="status">
            <Check size={16} aria-hidden="true" />
            {message}
          </p>
        )}
      </div>
      <section
        className="panel combo-collection"
        aria-label="Raccolta di cognomi divertenti"
      >
        <SectionHeading title="Le migliori combo" />
        {combos.length ? (
          <ul className="combo-list">
            {combos.map((combo) => (
              <li key={combo.id}>
                <article className="combo-card">
                  <span className="combo-icon">
                    <Smile size={23} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <div className="combo-content">
                    <h3
                      aria-label={[combo.firstSurname, combo.secondSurname]
                        .filter(Boolean)
                        .join(' + ')}
                    >
                      {combo.firstSurname}
                      {combo.secondSurname && (
                        <>
                          <span className="combo-plus"> + </span>
                          {combo.secondSurname}
                        </>
                      )}
                    </h3>
                    {combo.note && <p>{combo.note}</p>}
                    <small>
                      {new Intl.DateTimeFormat('it-IT', {
                        timeZone: 'Europe/Rome',
                        dateStyle: 'medium',
                      }).format(new Date(combo.createdAt))}
                      {shared &&
                        (combo.sync === 'pending'
                          ? ' · In attesa di invio'
                          : combo.sync === 'error'
                            ? ' · Da correggere: vedi gli invii'
                            : ' · Condivisa')}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    disabled={busy || saving || combo.sync === 'error'}
                    aria-label={`Rimuovi ${[combo.firstSurname, combo.secondSurname].filter(Boolean).join(' + ')}`}
                    onClick={() => {
                      setMessage('')
                      setRemoving(combo)
                    }}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="La prima risata la segni tu">
            Salva un cognome buffo o abbinalo a un secondo. Qui ritroverai i
            tuoi preferiti.
          </EmptyState>
        )}
      </section>
      <p className="demo-footnote">
        Una raccolta di sorrisi, senza punti. Bastano i cognomi, senza indirizzi
        o contatti.
      </p>
      {adding && (
        <Modal
          title="Aggiungi una combo"
          busy={busy || saving}
          onClose={() => setAdding(false)}
        >
          <p className="modal-description">
            Un cognome può bastare. Il secondo è facoltativo.
          </p>
          <form className="collection-form" onSubmit={(event) => void save(event)}>
            <fieldset disabled={busy || saving}>
              <label>
                Primo cognome
                <input
                  autoFocus
                  required
                  maxLength={60}
                  autoComplete="off"
                  value={first}
                  onChange={(event) => setFirst(event.target.value)}
                />
              </label>
              <label>
                Secondo cognome (facoltativo)
                <input
                  maxLength={60}
                  autoComplete="off"
                  value={second}
                  onChange={(event) => setSecond(event.target.value)}
                />
              </label>
              <label>
                Nota (facoltativa)
                <textarea
                  maxLength={180}
                  rows={3}
                  value={note}
                  placeholder="Cosa ti ha fatto sorridere?"
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
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
                disabled={busy || saving || !first.trim()}
              >
                {saving || busy ? 'Salvo…' : 'Salva combo'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Rimuovere questa combo?"
          busy={busy || saving}
          onClose={() => setRemoving(undefined)}
        >
          <p className="modal-description">
            «
            {[removing.firstSurname, removing.secondSurname]
              .filter(Boolean)
              .join(' + ')}
            » verrà rimossa dalla raccolta{shared ? ' condivisa' : ''}.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={busy || saving}
              onClick={() => setRemoving(undefined)}
            >
              Tieni la combo
            </button>
            <button
              className="primary-button"
              disabled={busy || saving}
              onClick={() => void remove()}
            >
              Rimuovi combo
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

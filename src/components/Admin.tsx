import { useState, type FormEvent } from 'react'
import {
  Archive,
  ArrowLeft,
  Download,
  Pencil,
  Plus,
  Settings2,
} from 'lucide-react'
import type { Command, Diary, EventDefinition, Reward } from '../domain/model'
import { pointsLabel, statistics } from '../domain/stats'
import { EmptyState, EventIcon, Modal, SectionHeading } from './ui'
import { Timeline } from './Timeline'
import { newId } from '../domain/ids'

type Editor =
  | { kind: 'event'; value?: EventDefinition }
  | { kind: 'reward'; value?: Reward }
type ArchiveTarget = { kind: 'event' | 'reward'; id: string; name: string }

export default function Admin({
  diary,
  now,
  busy,
  error,
  execute,
  onExit,
}: {
  diary: Diary
  now: Date
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  onExit: () => void
}) {
  const [tab, setTab] = useState<'summary' | 'events' | 'rewards'>('summary')
  const [editor, setEditor] = useState<Editor>()
  const [archive, setArchive] = useState<ArchiveTarget>()
  const [showArchived, setShowArchived] = useState(false)
  const stats = statistics(diary, now)

  function download() {
    const data = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), mode: 'local-demo', diary },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `fantafolletto-demo-${now.toISOString().slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <button className="text-button back-link" onClick={onExit}>
        <ArrowLeft size={17} />
        Torna al diario
      </button>
      <div className="page-title">
        <span className="eyebrow">Dietro le piccole sorprese</span>
        <h1>Il tuo spazio admin</h1>
        <p>Prepara gli episodi e i premi che rendono speciale il suo diario.</p>
      </div>
      <div className="notice">
        <Settings2 size={19} aria-hidden="true" />
        <p>
          <strong>Anteprima admin, senza accesso protetto.</strong> Le modifiche
          restano in questo browser. Account separati e dati condivisi sono
          previsti nello sprint 2.
        </p>
      </div>
      <div
        className="segmented admin-tabs"
        role="group"
        aria-label="Sezioni admin"
      >
        {(
          [
            ['summary', 'Riepilogo'],
            ['events', 'Eventi'],
            ['rewards', 'Premi'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'summary' && (
        <>
          <div className="stat-grid">
            <article>
              <span>Punti oggi</span>
              <strong>{stats.today}</strong>
            </article>
            <article>
              <span>Punti totali</span>
              <strong>{stats.total}</strong>
            </article>
          </div>
          <section className="panel">
            <SectionHeading title="Ultimi episodi" />
            <Timeline
              entries={[...diary.entries].reverse().slice(0, 10)}
              busy={busy}
            />
          </section>
          <section className="panel export-panel">
            <div>
              <h2>Una copia del diario</h2>
              <p>
                Esporta i dati demo in JSON. Il ripristino non è ancora
                disponibile.
              </p>
            </div>
            <button className="secondary-button" onClick={download}>
              <Download size={18} />
              Esporta demo
            </button>
          </section>
        </>
      )}
      {tab !== 'summary' && (
        <section className="panel">
          <SectionHeading
            title={
              tab === 'events'
                ? 'Il catalogo degli eventi'
                : 'I premi da conquistare'
            }
          />
          <p className="section-description">
            {tab === 'events'
              ? 'Le modifiche valgono per i prossimi episodi. I punti già registrati restano nel diario.'
              : 'Nella demo il progresso segue le condizioni attuali. Non vengono ancora assegnati premi definitivi.'}
          </p>
          <button
            className="primary-button full-width"
            onClick={() =>
              setEditor({ kind: tab === 'events' ? 'event' : 'reward' })
            }
          >
            <Plus size={19} />
            {tab === 'events' ? 'Crea evento' : 'Crea premio'}
          </button>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Mostra gli archiviati
          </label>
          <div className="catalog-list">
            {tab === 'events'
              ? diary.events
                  .filter((item) => showArchived || !item.archived)
                  .map((item) => (
                    <article
                      key={item.id}
                      className={`catalog-item ${item.archived ? 'archived' : ''}`}
                    >
                      <div className="catalog-item-heading">
                        <EventIcon id={item.id} />
                        <div>
                          <h3>{item.name}</h3>
                          <span>
                            {pointsLabel(item.points)} punti · versione{' '}
                            {item.version}
                            {item.archived && ' · Archiviato'}
                          </span>
                        </div>
                      </div>
                      <p>{item.description}</p>
                      {!item.archived && (
                        <div className="item-actions">
                          <button
                            className="secondary-button"
                            onClick={() =>
                              setEditor({ kind: 'event', value: item })
                            }
                          >
                            <Pencil size={16} />
                            Modifica
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              setArchive({
                                kind: 'event',
                                id: item.id,
                                name: item.name,
                              })
                            }
                          >
                            <Archive size={16} />
                            Archivia
                          </button>
                        </div>
                      )}
                    </article>
                  ))
              : diary.rewards
                  .filter((item) => showArchived || !item.archived)
                  .map((item) => (
                    <article
                      key={item.id}
                      className={`catalog-item ${item.archived ? 'archived' : ''}`}
                    >
                      <h3>{item.name}</h3>
                      <span className="catalog-detail">
                        {item.target} punti ·{' '}
                        {item.period === 'week'
                          ? 'Settimana corrente'
                          : 'Totale diario'}
                        {item.archived && ' · Archiviato'}
                      </span>
                      <p>{item.description}</p>
                      {!item.archived && (
                        <div className="item-actions">
                          <button
                            className="secondary-button"
                            onClick={() =>
                              setEditor({ kind: 'reward', value: item })
                            }
                          >
                            <Pencil size={16} />
                            Modifica
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              setArchive({
                                kind: 'reward',
                                id: item.id,
                                name: item.name,
                              })
                            }
                          >
                            <Archive size={16} />
                            Archivia
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
          </div>
          {(tab === 'events' ? diary.events : diary.rewards).filter(
            (item) => showArchived || !item.archived,
          ).length === 0 && (
            <EmptyState title="Si parte da una bella idea">
              Crea il primo elemento con il pulsante qui sopra.
            </EmptyState>
          )}
        </section>
      )}
      {editor && (
        <EditorForm
          editor={editor}
          busy={busy}
          error={error}
          execute={execute}
          onClose={() => setEditor(undefined)}
        />
      )}
      {archive && (
        <Modal
          title="Archiviare questo elemento?"
          busy={busy}
          onClose={() => setArchive(undefined)}
        >
          <p className="modal-description">
            <strong>{archive.name}</strong> non sarà più disponibile per nuovi
            utilizzi. Gli episodi registrati resteranno nel diario.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setArchive(undefined)}
            >
              Torna indietro
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                if (
                  await execute({
                    type:
                      archive.kind === 'event'
                        ? 'archive-event'
                        : 'archive-reward',
                    id: archive.id,
                  })
                )
                  setArchive(undefined)
              }}
            >
              {busy ? 'Salvataggio…' : 'Archivia'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function EditorForm({
  editor,
  busy,
  error,
  execute,
  onClose,
}: {
  editor: Editor
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  onClose: () => void
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const common = {
      id: editor.value?.id ?? newId(),
      name: String(form.get('name')),
      description: String(form.get('description')),
    }
    const command: Command =
      editor.kind === 'event'
        ? {
            type: 'save-event',
            value: { ...common, points: Number(form.get('points')) },
          }
        : {
            type: 'save-reward',
            value: {
              ...common,
              target: Number(form.get('target')),
              period: form.get('period') as Reward['period'],
            },
          }
    if (await execute(command)) onClose()
  }
  return (
    <Modal
      title={`${editor.value ? 'Modifica' : 'Crea'} ${editor.kind === 'event' ? 'evento' : 'premio'}`}
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Nome
            <input
              name="name"
              defaultValue={editor.value?.name}
              maxLength={60}
              required
              autoComplete="off"
              placeholder={
                editor.kind === 'event'
                  ? 'Una piccola avventura…'
                  : 'Qualcosa di speciale…'
              }
            />
          </label>
          <label>
            Descrizione <span className="optional">facoltativa</span>
            <textarea
              name="description"
              defaultValue={editor.value?.description}
              maxLength={180}
              rows={3}
            />
          </label>
          {editor.kind === 'event' ? (
            <label>
              Punti
              <input
                name="points"
                type="number"
                min={-1000}
                max={1000}
                step={1}
                defaultValue={editor.value?.points ?? 10}
                required
              />
              <span className="field-hint">
                Puoi usare punti negativi per un malus.
              </span>
            </label>
          ) : (
            <>
              <label>
                Obiettivo in punti
                <input
                  name="target"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100000}
                  step={1}
                  defaultValue={editor.value?.target ?? 100}
                  required
                />
              </label>
              <label>
                Periodo
                <select
                  name="period"
                  defaultValue={editor.value?.period ?? 'all'}
                >
                  <option value="all">Totale del diario</option>
                  <option value="week">Settimana corrente (da lunedì)</option>
                </select>
              </label>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button full-width" type="submit">
            {busy ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </fieldset>
      </form>
    </Modal>
  )
}

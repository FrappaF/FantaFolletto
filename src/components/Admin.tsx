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
import { Awards } from './Awards'

type Editor =
  | { kind: 'event'; value?: EventDefinition }
  | { kind: 'reward'; value?: Reward }
type ArchiveTarget = {
  kind: 'event' | 'reward'
  id: string
  name: string
  expectedVersion: number
  operationId: string
}

export default function Admin({
  diary,
  now,
  busy,
  error,
  execute,
  onExit,
  shared = false,
  refreshing = false,
}: {
  diary: Diary
  now: Date
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  onExit: () => void
  shared?: boolean
  refreshing?: boolean
}) {
  const [tab, setTab] = useState<'summary' | 'events' | 'rewards'>('summary')
  const [editor, setEditor] = useState<Editor>()
  const [archive, setArchive] = useState<ArchiveTarget>()
  const [showArchived, setShowArchived] = useState(false)
  const [delivery, setDelivery] = useState<{
    id: string
    operationId: string
  }>()
  const stats = statistics(diary, now)

  function download() {
    const data = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            mode: shared ? 'shared' : 'local-demo',
            diary,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `fantafolletto-${shared ? 'diario' : 'demo'}-${now.toISOString().slice(0, 10)}.json`
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
          {shared ? (
            <>
              <strong>Il diario condiviso della giocatrice.</strong> Eventi e
              premi si gestiscono online. I punteggi già assegnati restano nello
              storico.
            </>
          ) : (
            <>
              <strong>Anteprima admin, senza accesso protetto.</strong> Le
              modifiche restano in questo browser. Account separati e dati
              condivisi sono disponibili nella modalità condivisa.
            </>
          )}
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
                {shared
                  ? 'Esporta gli ultimi dati ricevuti in JSON. È una copia consultabile, non un backup ripristinabile del database.'
                  : 'Esporta i dati demo in JSON. Il ripristino non è ancora disponibile.'}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={download}
              disabled={refreshing}
            >
              <Download size={18} />
              {shared ? 'Esporta diario' : 'Esporta demo'}
            </button>
          </section>
          {shared && (
            <section className="panel">
              <SectionHeading title="Premi conquistati e consegne" />
              <Awards
                awards={diary.awards ?? []}
                busy={busy}
                onDeliver={(id) => setDelivery({ id, operationId: newId() })}
              />
            </section>
          )}
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
              : shared
                ? 'I premi già conquistati conservano le loro condizioni originali. Le nuove condizioni possono sbloccare premi sui punti già confermati.'
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
                                expectedVersion: item.version,
                                operationId: newId(),
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
                                expectedVersion: item.version ?? 0,
                                operationId: newId(),
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
                    expectedVersion: archive.expectedVersion,
                    operationId: archive.operationId,
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
      {delivery && (
        <Modal
          title="Confermare la consegna?"
          busy={busy}
          onClose={() => setDelivery(undefined)}
        >
          <p className="modal-description">
            Segnerai questo premio come consegnato. Dopo un annullamento resterà
            nello storico, con una segnalazione se i punti scendono sotto la
            soglia.
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
              onClick={() => setDelivery(undefined)}
            >
              Torna indietro
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                if (await execute({ type: 'deliver-award', ...delivery }))
                  setDelivery(undefined)
              }}
            >
              Conferma consegna
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
  const [itemId] = useState(() => editor.value?.id ?? newId())
  const [operationId] = useState(newId)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const common = {
      id: itemId,
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
    if (
      await execute({
        ...command,
        operationId,
        expectedVersion: editor.value?.version ?? 0,
      })
    )
      onClose()
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

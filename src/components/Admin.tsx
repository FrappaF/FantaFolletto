import { CategoryFilters, EventMeta } from './EventCatalog'
import {
  categoriesFor,
  comboPoints,
  formatRuleDay,
  rarityLabels,
  ruleFor,
} from '../domain/scoring'
import type { ScoringRule } from '../domain/model'
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
import { Combos } from './Combos'
import { DailyNotes } from './DailyNotes'

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
  const [tab, setTab] = useState<
    'summary' | 'events' | 'rewards' | 'rules' | 'combos' | 'notes'
  >('summary')
  const [editor, setEditor] = useState<Editor>()
  const [archive, setArchive] = useState<ArchiveTarget>()
  const [category, setCategory] = useState('')
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
            ['rules', 'Combo'],
            ['combos', 'Cognomi'],
            ['notes', 'Note'],
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
      {tab === 'notes' && (
        <DailyNotes
          diary={diary}
          now={now}
          busy={busy}
          error={error}
          execute={execute}
          shared={shared}
        />
      )}
      {tab === 'combos' && (
        <Combos
          diary={diary}
          busy={busy}
          error={error}
          execute={execute}
          shared={shared}
        />
      )}
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
      {tab === 'rules' && (
        <ScoringSettings
          key={Math.max(
            0,
            ...(diary.scoringRules ?? []).map((rule) => rule.version),
          )}
          diary={diary}
          now={now}
          busy={busy}
          error={error}
          execute={execute}
        />
      )}
      {(tab === 'events' || tab === 'rewards') && (
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
          {tab === 'events' && (
            <CategoryFilters
              diary={diary}
              value={category}
              onChange={setCategory}
            />
          )}
          <div className="catalog-list">
            {tab === 'events'
              ? diary.events
                  .filter(
                    (item) =>
                      (showArchived || !item.archived) &&
                      (!category || item.categoryId === category),
                  )
                  .map((item) => (
                    <article
                      key={item.id}
                      className={`catalog-item ${item.archived ? 'archived' : ''}`}
                    >
                      <div className="catalog-item-heading">
                        <EventIcon id={item.id} categoryId={item.categoryId} />
                        <div>
                          <h3>{item.name}</h3>
                          <span>
                            {pointsLabel(item.points)} punti · versione{' '}
                            {item.version}
                            {item.archived && ' · Archiviato'}
                          </span>
                        </div>
                      </div>
                      <EventMeta event={item} diary={diary} />
                      {item.description && <p>{item.description}</p>}
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
            (item) =>
              (showArchived || !item.archived) &&
              (tab !== 'events' ||
                !category ||
                ('categoryId' in item && item.categoryId === category)),
          ).length === 0 && (
            <EmptyState title="Si parte da una bella idea">
              Crea il primo elemento con il pulsante qui sopra.
            </EmptyState>
          )}
        </section>
      )}
      {editor && (
        <EditorForm
          diary={diary}
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
  diary,
  editor,
  busy,
  error,
  execute,
  onClose,
}: {
  diary: Diary
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
            value: {
              ...common,
              points: Number(form.get('points')),
              categoryId: String(form.get('categoryId')),
              rarity: String(form.get('rarity')) as EventDefinition['rarity'],
              repeat: String(form.get('repeat')) as EventDefinition['repeat'],
            },
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
            <>
              <label>
                Categoria
                <select
                  name="categoryId"
                  defaultValue={
                    editor.value?.categoryId ?? categoriesFor(diary)[0]?.id
                  }
                  required
                >
                  {categoriesFor(diary).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Rarità
                <select
                  name="rarity"
                  defaultValue={editor.value?.rarity ?? 'normal'}
                >
                  {Object.entries(rarityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ripetizione
                <select
                  name="repeat"
                  defaultValue={editor.value?.repeat ?? 'unlimited'}
                >
                  <option value="unlimited">
                    Ripetibile · combo sui punti positivi
                  </option>
                  <option value="daily">
                    Una volta al giorno · senza combo
                  </option>
                </select>
              </label>
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
                  Puoi usare punti negativi per un malus, senza moltiplicatore.
                </span>
              </label>
            </>
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

function ScoringSettings({
  diary,
  now,
  busy,
  error,
  execute,
}: {
  diary: Diary
  now: Date
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
}) {
  const latest = [...(diary.scoringRules ?? [])].sort(
    (a, b) => b.version - a.version,
  )[0]
  const current = ruleFor(diary, now)
  const [increment, setIncrement] = useState(latest?.incrementPercent ?? 20)
  const [maximum, setMaximum] = useState(latest?.maxMultiplier ?? 3)
  const [saved, setSaved] = useState(false)
  const [operationId, setOperationId] = useState(newId)
  const preview: ScoringRule = {
    version: 0,
    effectiveDay: '',
    incrementPercent: increment,
    maxMultiplier: maximum,
  }
  return (
    <section className="panel scoring-settings">
      <SectionHeading title="La combo della giornata" />
      <p className="section-description">
        Ogni ripetizione dello stesso evento aggiunge una percentuale dei punti
        base. Si riparte a mezzanotte italiana. Sfide giornaliere e malus
        restano senza bonus.
      </p>
      <p className="rules-current">
        <strong>Oggi:</strong> +{current?.incrementPercent ?? 0}% per
        ripetizione, tetto ×{current?.maxMultiplier ?? 1}.
      </p>
      {latest &&
        latest.effectiveDay > (current?.effectiveDay ?? '') &&
        latest.version !== current?.version && (
          <p className="rules-current">
            Dal {formatRuleDay(latest.effectiveDay)}: +{latest.incrementPercent}
            %, tetto ×{latest.maxMultiplier}.
          </p>
        )}
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (
            await execute({
              type: 'save-scoring',
              value: { incrementPercent: increment, maxMultiplier: maximum },
              expectedVersion: latest?.version ?? 0,
              operationId,
            })
          ) {
            setSaved(true)
            setOperationId(newId())
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Incremento per ripetizione (%)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              step={1}
              required
              value={Number.isNaN(increment) ? '' : increment}
              onChange={(event) => {
                setIncrement(event.target.valueAsNumber)
                setSaved(false)
                setOperationId(newId())
              }}
            />
            <span className="field-hint">
              0 disattiva il bonus. Esempio: 20 significa +20% dei punti base a
              ogni ripetizione.
            </span>
          </label>
          <label>
            Moltiplicatore massimo
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={20}
              step={0.1}
              required
              value={Number.isNaN(maximum) ? '' : maximum}
              onChange={(event) => {
                setMaximum(event.target.valueAsNumber)
                setSaved(false)
                setOperationId(newId())
              }}
            />
            <span className="field-hint">
              Da ×1 a ×20; puoi usare un decimale. ×1 disattiva il bonus.
            </span>
          </label>
          <div
            className="combo-preview"
            aria-label="Esempio su un evento da 10 punti"
          >
            <strong>Esempio · evento da 10 punti</strong>
            <ol>
              {[1, 2, 3, 4, 5].map((index) => (
                <li key={index}>
                  <span>{index}ª volta</span>
                  <b>
                    {Number.isFinite(increment) &&
                    Number.isFinite(maximum) &&
                    maximum >= 1 &&
                    increment >= 0
                      ? comboPoints(10, index, preview)
                      : '—'}{' '}
                    pt
                  </b>
                </li>
              ))}
            </ol>
          </div>
          <p className="field-hint">
            Le modifiche partono domani, a mezzanotte italiana. Se salvi di
            nuovo, per domani vale l’ultima versione. I giorni precedenti
            conservano le proprie regole.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {saved && <p role="status">Regole salvate per domani.</p>}
          <button className="primary-button full-width" type="submit">
            {busy ? 'Salvataggio…' : 'Salva per domani'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}

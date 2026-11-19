import { CategoryFilters, EventMeta } from './components/EventCatalog'
import { previewEvent } from './domain/scoring'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  Plus,
  Settings2,
  WifiOff,
  X,
  LogOut,
  Images,
} from 'lucide-react'
import { useDiary } from './hooks/useDiary'
import {
  activeEntries,
  pointsLabel,
  rewardProgress,
  statistics,
} from './domain/stats'
import {
  EmptyState,
  EventIcon,
  Modal,
  RewardCard,
  SectionHeading,
} from './components/ui'
import { Timeline } from './components/Timeline'
import { Records } from './components/Records'
import { newId } from './domain/ids'
import type { Command, Diary } from './domain/model'
import { readConfig } from './remote/config'
import { SyncStatus, type RemoteState } from './components/SyncStatus'
import { Rewards } from './components/Rewards'
import { PledgeNotice } from './components/Pledges'
import { isPledgesDemo } from './data/pledges-demo'
import { PwaPrompt } from './components/PwaPrompt'
import { InstallHint } from './components/InstallHint'
import { PhotoProvider, type PhotoConnection } from './photos/PhotoProvider'
import { Brand } from './components/Brand'
import {
  DiaryIcon,
  GiftIcon,
  RecordIcon,
  SparkleIcon,
} from './components/DiaryIcons'

const Admin = lazy(() => import('./components/Admin'))
const RemoteApplication = lazy(() => import('./remote/RemoteApplication'))
const Collections = lazy(() =>
  import('./components/Collections').then((module) => ({
    default: module.Collections,
  })),
)
type Page = 'today' | 'records' | 'rewards' | 'collections'

export function App() {
  const mode =
    import.meta.env.VITE_APP_MODE ?? (import.meta.env.DEV ? 'demo' : 'remote')
  const config = readConfig()
  return (
    <>
      <PwaPrompt />
      {mode === 'demo' ? (
        <DemoApplication />
      ) : mode === 'remote' && config ? (
        <Suspense
          fallback={
            <p className="loading-state" role="status">
              Apro il diario…
            </p>
          }
        >
          <RemoteApplication config={config} />
        </Suspense>
      ) : (
        <div className="app">
          <section className="panel loading-state">
            <h1>Il diario è quasi pronto</h1>
            <p>
              Il collegamento al servizio deve ancora essere configurato da chi
              gestisce l’app.
            </p>
          </section>
        </div>
      )}
    </>
  )
}

function DemoApplication() {
  const controller = useDiary()
  return <DiaryView controller={controller} />
}

export type DiaryController = {
  diary?: Diary
  confirmedDiary?: Diary
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  refresh: () => Promise<unknown>
  remote?: RemoteState
}

export function DiaryView({
  photoConnection,
  ...props
}: {
  controller: DiaryController
  onLogout?: () => void
  photoConnection?: PhotoConnection
}) {
  return (
    <PhotoProvider
      key={photoConnection?.scope ?? 'demo'}
      connection={photoConnection}
    >
      <DiaryContent {...props} />
    </PhotoProvider>
  )
}

function DiaryContent({
  controller,
  onLogout,
}: {
  controller: DiaryController
  onLogout?: () => void
}) {
  const { diary, busy, error, execute, refresh, remote } = controller
  const [page, setPage] = useState<Page>('today')
  const [rewardsView, setRewardsView] = useState<'rewards' | 'pledges'>('rewards')
  const [collectionsOpened, setCollectionsOpened] = useState(false)
  const scrollPositions = useRef<Record<Page, number>>({
    today: 0,
    records: 0,
    rewards: 0,
    collections: 0,
  })
  const [admin, setAdmin] = useState(false)
  const [picker, setPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [toast, setToast] = useState<{
    text: string
    entryId?: string
    eventId?: string
  }>()
  const [now, setNow] = useState(new Date())
  const [online, setOnline] = useState(navigator.onLine)
  const [recording, setRecording] = useState(false)
  const recordLock = useRef(false)
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    if (remote?.role === 'admin') setAdmin(true)
  }, [remote?.role])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    const connection = () => setOnline(navigator.onLine)
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', connection)
      window.removeEventListener('offline', connection)
    }
  }, [])

  function navigate(next: Page) {
    scrollPositions.current[page] = window.scrollY
    if (next === 'collections') setCollectionsOpened(true)
    setPage(next)
    setToast(undefined)
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: scrollPositions.current[next] }),
    )
    main.current?.focus()
  }
  async function undo(id: string) {
    if (await execute({ type: 'void', id, at: new Date().toISOString() }))
      setToast({ text: 'Episodio annullato. Il diario è aggiornato.' })
  }
  async function record(eventId: string) {
    if (recordLock.current) return
    recordLock.current = true
    setRecording(true)
    const event = diary!.events.find((item) => item.id === eventId)!
    const id = newId()
    const estimate = previewEvent(diary!, event, new Date())
    try {
      if (
        await execute({
          type: 'record',
          id,
          eventId,
          at: new Date().toISOString(),
          version: event.version,
          snapshot: { name: event.name, points: event.points },
        })
      ) {
        setNow(new Date())
        setToast({
          text: `${event.name} · ${pointsLabel(estimate.entry.points)} punti${remote ? ' stimati' : ''}`,
          entryId: id,
          eventId,
        })
      }
    } finally {
      recordLock.current = false
      setRecording(false)
    }
  }

  const stats = diary && statistics(diary, now)
  const rewards = diary?.rewards.filter((reward) => !reward.archived) ?? []
  const featured =
    diary &&
    (rewards.find((reward) => !rewardProgress(diary, reward, now).reached) ??
      rewards[0])
  const date = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  return (
    <div
      className={`app ${admin ? 'admin-mode' : ''}`}
      data-update-blocked={
        busy || picker || (remote?.queue.length ?? 0) > 0 || remote?.syncing
          ? 'true'
          : 'false'
      }
    >
      <a className="skip-link" href="#main">
        Vai al contenuto
      </a>
      {!remote && (
        <div className="demo-banner">
          <span className="demo-dot" />
          {isPledgesDemo() ? 'Anteprima Pegni' : 'Versione demo'}
          <span className="demo-divider">·</span> Dati solo su
          questo browser
        </div>
      )}
      <header className="app-header">
        <a
          className="brand-home"
          href="#"
          onClick={(event) => {
            event.preventDefault()
            setAdmin(false)
            navigate('today')
          }}
          aria-label="FantaFolletto, torna a Oggi"
        >
          <Brand />
        </a>
        <div className="header-actions">
          {(!remote || remote.role === 'admin') && (
            <button
              className={`icon-button admin-button ${admin ? 'active' : ''}`}
              onClick={() => {
                setAdmin((value) => !value)
                setToast(undefined)
                window.scrollTo({ top: 0 })
              }}
              aria-label={
                admin
                  ? 'Torna al diario'
                  : remote
                    ? 'Apri area admin'
                    : 'Prova area admin'
              }
              aria-pressed={admin}
            >
              <Settings2 size={21} />
            </button>
          )}
          {onLogout && (
            <button
              className="icon-button"
              aria-label="Esci dal diario"
              onClick={onLogout}
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </header>
      <main id="main" ref={main} tabIndex={-1}>
        {remote && (
          <SyncStatus remote={remote} diary={diary} refresh={refresh} />
        )}
        {!diary ? (
          <section className="panel loading-state" aria-live="polite">
            <DiaryIcon size={32} />
            <h1>
              {error || remote?.syncError
                ? 'Il diario ha bisogno di una mano'
                : 'Apro una nuova pagina…'}
            </h1>
            <p>
              {error ||
                remote?.syncError ||
                'Un attimo, preparo le tue piccole avventure.'}
            </p>
            {error && (
              <button className="primary-button" onClick={() => void refresh()}>
                Riprova
              </button>
            )}
          </section>
        ) : (
          <>
            {error && (
              <div className="error-banner" role="alert">
                <strong>La modifica non è stata confermata.</strong>
                <p>{error}</p>
                <button className="text-button" onClick={() => void refresh()}>
                  Rileggi il diario
                </button>
              </div>
            )}
            {!online && (
              <div className="offline-notice">
                <WifiOff size={17} aria-hidden="true" />
                {remote
                  ? 'Sei offline. Gli inserimenti restano sul telefono fino al prossimo invio.'
                  : 'Sei offline. Questa demo salva sul dispositivo.'}
              </div>
            )}
            {admin ? (
              <Suspense
                fallback={
                  <p className="loading-state" role="status">
                    Apro lo spazio admin…
                  </p>
                }
              >
                <Admin
                  diary={diary}
                  now={now}
                  busy={busy}
                  error={error}
                  execute={execute}
                  onExit={() => setAdmin(false)}
                  shared={!!remote}
                  refreshing={remote?.syncing}
                  waiting={!!remote?.queue.length}
                  pledgeDiary={controller.confirmedDiary ?? diary}
                />
              </Suspense>
            ) : (
              <>
                {page === 'today' && (
                  <>
                    <div className="page-title today-title">
                      <span className="eyebrow">{date}</span>
                      <h1>
                        Ogni giorno,
                        <br />
                        una piccola avventura
                        <span className="green-dot">.</span>
                      </h1>
                      <p>Le cose belle meritano di essere segnate.</p>
                    </div>
                    <section
                      className="score-card"
                      aria-label="Il riepilogo della tua giornata"
                    >
                      <div className="score-flower" aria-hidden="true">
                        <SparkleIcon size={108} strokeWidth={0.6} />
                      </div>
                      <span className="score-label">
                        La tua giornata, in punti
                      </span>
                      <div className="score-number">
                        {stats!.today}
                        <span>punti</span>
                      </div>
                      <div className="score-footer">
                        <span>
                          <span className="score-status-dot" />
                          {stats!.countToday === 1
                            ? '1 episodio da ricordare'
                            : `${stats!.countToday} episodi da ricordare`}
                        </span>
                        <span className="score-week">
                          {stats!.week} questa settimana
                        </span>
                      </div>
                    </section>
                    {(!remote || remote.role === 'player') && (
                      <button
                        className="primary-button record-button"
                        onClick={() => {
                          setToast(undefined)
                          setSearch('')
                          setCategory('')
                          setNow(new Date())
                          setPicker(true)
                        }}
                      >
                        <Plus size={21} strokeWidth={2} />
                        Segna un evento
                        <ArrowRight size={20} className="button-arrow" />
                      </button>
                    )}
                    <div className="local-status">
                      <Check size={13} />
                      {busy
                        ? 'Salvataggio in corso…'
                        : remote
                          ? remote.queue.length
                            ? 'Salvato sul telefono · punti in attesa di conferma'
                            : 'Punti confermati nel diario condiviso'
                          : 'Diario salvato su questo dispositivo'}
                    </div>
                    <PledgeNotice
                      diary={controller.confirmedDiary ?? diary}
                      now={now}
                      onOpen={() => {
                        setRewardsView('pledges')
                        scrollPositions.current.rewards = 0
                        navigate('rewards')
                      }}
                    />
                    <section className="panel">
                      <SectionHeading
                        title="Le ultime piccole avventure"
                        action="Tutte"
                        onAction={() => navigate('records')}
                      />
                      <Timeline
                        entries={activeEntries(diary)
                          .slice()
                          .reverse()
                          .slice(0, 4)}
                        busy={busy}
                        onUndo={
                          !remote || remote.role === 'player' ? undo : undefined
                        }
                      />
                    </section>
                    {featured && (
                      <section>
                        <SectionHeading
                          title="Una bella cosa ti aspetta"
                          action="Premi"
                          onAction={() => navigate('rewards')}
                        />
                        <RewardCard
                          diary={diary}
                          reward={featured}
                          now={now}
                          compact
                        />
                      </section>
                    )}
                    <p className="diary-quote">
                      Anche una giornata normale può avere una bella storia.
                    </p>
                    {remote?.role === 'player' && <InstallHint />}
                  </>
                )}
                {page === 'records' && (
                  <Records
                    diary={diary}
                    now={now}
                    busy={busy}
                    onUndo={
                      !remote || remote.role === 'player' ? undo : undefined
                    }
                  />
                )}
                {collectionsOpened && (
                  <div hidden={page !== 'collections'}>
                    <Suspense fallback={<p role="status">Apro le raccolte…</p>}>
                      <Collections
                        diary={diary}
                        now={now}
                        busy={busy}
                        error={error}
                        execute={execute}
                        shared={!!remote}
                      />
                    </Suspense>
                  </div>
                )}
                {page === 'rewards' && (
                  <Rewards
                    diary={diary}
                    now={now}
                    busy={busy}
                    error={error}
                    execute={execute}
                    canRedeem={!remote || remote.role === 'player'}
                    shared={!!remote}
                    waiting={!!remote?.queue.length}
                    pledgeDiary={controller.confirmedDiary ?? diary}
                    view={rewardsView}
                    onViewChange={setRewardsView}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
      {diary && !admin && (
        <nav className="bottom-nav" aria-label="Navigazione principale">
          {(
            [
              { id: 'today', label: 'Oggi', icon: DiaryIcon },
              { id: 'records', label: 'Record', icon: RecordIcon },
              { id: 'rewards', label: 'Premi', icon: GiftIcon },
              { id: 'collections', label: 'Raccolte', icon: Images },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={22} strokeWidth={page === item.id ? 2 : 1.6} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
      {toast && !admin && !picker && (
        <div className="toast">
          <span role="status">
            <Check size={18} aria-hidden="true" />
            {toast.text}
          </span>
          {toast.entryId && (
            <button disabled={busy} onClick={() => void undo(toast.entryId!)}>
              Annulla
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Chiudi messaggio"
            onClick={() => setToast(undefined)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {picker && diary && (
        <Modal
          title="Cosa è successo di bello?"
          scrollCloseButton
          busy={busy || recording}
          onClose={() => setPicker(false)}
        >
          <p className="modal-description">
            Scegli un episodio. I punti sono indicati qui sotto.
          </p>
          <span className="sr-only" role="status">
            {toast?.text}
          </span>
          <label className="search-label">
            Cerca nel catalogo
            <input
              type="search"
              placeholder="Caffè, risate, piccole vittorie…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <CategoryFilters
            diary={diary}
            value={category}
            onChange={setCategory}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="event-picker">
            {diary.events
              .filter(
                (event) =>
                  !event.archived &&
                  (!category || event.categoryId === category) &&
                  `${event.name} ${event.description}`
                    .toLocaleLowerCase('it')
                    .includes(search.toLocaleLowerCase('it')),
              )
              .map((event) => {
                const score = previewEvent(diary, event, now)
                return (
                  <button
                    key={event.id}
                    className="event-choice"
                    disabled={busy || recording || !score.available}
                    onClick={() => void record(event.id)}
                  >
                    {toast?.eventId === event.id ? (
                      <span className="event-icon" aria-hidden="true">
                        <Check size={21} />
                      </span>
                    ) : (
                      <EventIcon id={event.id} categoryId={event.categoryId} />
                    )}
                    <span>
                      <strong>{event.name}</strong>
                      <small>{event.description}</small>
                      <EventMeta event={event} diary={diary} />
                      <small className="combo-hint">
                        {!score.available
                          ? 'Già segnata oggi'
                          : event.repeat === 'daily'
                            ? 'Bonus giornaliero'
                            : `${score.entry.comboIndex}ª volta oggi${score.entry.bonusPoints ? ` · bonus +${score.entry.bonusPoints}` : ''}`}
                      </small>
                    </span>
                    <b>
                      {pointsLabel(score.entry.points)}
                      <small>pt</small>
                    </b>
                  </button>
                )
              })}
          </div>
          {!diary.events.some(
            (event) =>
              !event.archived &&
              (!category || event.categoryId === category) &&
              `${event.name} ${event.description}`
                .toLocaleLowerCase('it')
                .includes(search.toLocaleLowerCase('it')),
          ) && (
            <EmptyState title="Nessun episodio trovato">
              {remote
                ? 'Prova con un’altra parola. Se il catalogo è vuoto, chi gestisce il regalo deve preparare i primi eventi.'
                : 'Prova con un’altra parola, oppure crea un evento dall’area admin demo.'}
            </EmptyState>
          )}
          <p className="demo-footnote">
            {remote
              ? 'Punti stimati fino alla conferma. La combo riparte a mezzanotte italiana. Non servono dati dei clienti.'
              : 'Catalogo dimostrativo. Nessun dato sui clienti è necessario.'}
          </p>
        </Modal>
      )}
    </div>
  )
}

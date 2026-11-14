import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  Gift,
  Leaf,
  Plus,
  Settings2,
  Sparkles,
  Trophy,
  WifiOff,
  X,
  LogOut,
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
import { Awards } from './components/Awards'
import { PwaPrompt } from './components/PwaPrompt'
import { InstallHint } from './components/InstallHint'

const Admin = lazy(() => import('./components/Admin'))
const RemoteApplication = lazy(() => import('./remote/RemoteApplication'))
type Page = 'today' | 'records' | 'rewards'

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
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  refresh: () => Promise<unknown>
  remote?: RemoteState
}

export function DiaryView({
  controller,
  onLogout,
}: {
  controller: DiaryController
  onLogout?: () => void
}) {
  const { diary, busy, error, execute, refresh, remote } = controller
  const [page, setPage] = useState<Page>('today')
  const [admin, setAdmin] = useState(false)
  const [picker, setPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ text: string; entryId?: string }>()
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
    setPage(next)
    setToast(undefined)
    window.scrollTo({ top: 0 })
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
        setPicker(false)
        setSearch('')
        setNow(new Date())
        setToast({
          text: `${event.name} · ${pointsLabel(event.points)} punti`,
          entryId: id,
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
          Versione demo <span className="demo-divider">·</span> Dati solo su
          questo browser
        </div>
      )}
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault()
            setAdmin(false)
            navigate('today')
          }}
          aria-label="FantaFolletto, torna a Oggi"
        >
          <span className="brand-mark">
            <Leaf size={22} strokeWidth={1.7} />
          </span>
          <span>
            fanta<span className="brand-light">folletto</span>
            <small>Il diario delle piccole avventure</small>
          </span>
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
            <BookOpen size={32} aria-hidden="true" />
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
                  ? 'Sei offline. Gli episodi restano sul telefono fino al prossimo invio.'
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
                        <Sparkles size={108} strokeWidth={0.6} />
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
                          setSearch('')
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
                {page === 'rewards' && (
                  <>
                    <div className="page-title">
                      <span className="eyebrow">Un pensiero, tutto per te</span>
                      <h1>
                        Le cose belle
                        <br />
                        che ti aspettano<span className="green-dot">.</span>
                      </h1>
                      <p>Piccoli traguardi, sorprese da condividere.</p>
                    </div>
                    <div className="reward-list">
                      {rewards.map((reward) => (
                        <RewardCard
                          key={reward.id}
                          diary={diary}
                          reward={reward}
                          now={now}
                        />
                      ))}
                    </div>
                    {!rewards.length && (
                      <section className="panel">
                        <EmptyState
                          title="Le sorprese sono in preparazione"
                          icon="gift"
                        >
                          Qui troverai i premi scelti per te.
                        </EmptyState>
                      </section>
                    )}
                    {remote && (
                      <section className="panel awards-panel">
                        <SectionHeading title="I premi conquistati" />
                        <Awards awards={diary.awards ?? []} />
                      </section>
                    )}
                    {!remote && (
                      <p className="demo-footnote">
                        Premi di esempio. Il progresso è dimostrativo: non
                        costituisce un’assegnazione definitiva.
                      </p>
                    )}
                  </>
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
              { id: 'today', label: 'Oggi', icon: BookOpen },
              { id: 'records', label: 'Record', icon: Trophy },
              { id: 'rewards', label: 'Premi', icon: Gift },
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
      {toast && !admin && (
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
          busy={busy || recording}
          onClose={() => setPicker(false)}
        >
          <p className="modal-description">
            Scegli un episodio. I punti sono indicati qui sotto.
          </p>
          <label className="search-label">
            Cerca nel catalogo
            <input
              type="search"
              placeholder="Caffè, risate, piccole vittorie…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
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
                  `${event.name} ${event.description}`
                    .toLocaleLowerCase('it')
                    .includes(search.toLocaleLowerCase('it')),
              )
              .map((event) => (
                <button
                  key={event.id}
                  className="event-choice"
                  disabled={busy || recording}
                  onClick={() => void record(event.id)}
                >
                  <EventIcon id={event.id} />
                  <span>
                    <strong>{event.name}</strong>
                    <small>{event.description}</small>
                  </span>
                  <b>
                    {pointsLabel(event.points)}
                    <small>pt</small>
                  </b>
                </button>
              ))}
          </div>
          {!diary.events.some(
            (event) =>
              !event.archived &&
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
              ? 'Non servono nomi o dati dei clienti.'
              : 'Catalogo dimostrativo. Nessun dato sui clienti è necessario.'}
          </p>
        </Modal>
      )}
    </div>
  )
}

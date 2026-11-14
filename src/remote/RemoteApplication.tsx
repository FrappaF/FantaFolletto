import { useEffect, useState, type FormEvent } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { BookOpen, LogOut } from 'lucide-react'
import { DiaryView } from '../App'
import { Modal } from '../components/ui'
import { makeClient, type RemoteConfig } from './client'
import { useRemoteDiary } from './useRemoteDiary'

export default function RemoteApplication({
  config,
}: {
  config: RemoteConfig
}) {
  const [client] = useState(() => makeClient(config))
  const [queries] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  useEffect(() => {
    let active = true
    let receivedEvent = false
    const { data } = client.auth.onAuthStateChange((_event, value) => {
      receivedEvent = true
      if (active) {
        setSession(value)
        setReady(true)
      }
    })
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !receivedEvent) {
          setSession(data.session)
          setReady(true)
          if (error)
            setError(
              'La sessione va riaperta. Accedi online: gli episodi in attesa sono conservati.',
            )
        }
      })
      .catch(() => {
        if (active) {
          setReady(true)
          setError('Impossibile recuperare la sessione. Riprova online.')
        }
      })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    setSigningOut(true)
    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      })
      if (error)
        setError(
          error.status === 400
            ? 'Email o password non corrette.'
            : 'Accesso non riuscito. Controlla la connessione e riprova.',
        )
    } catch {
      setError('Il servizio non è raggiungibile. Riprova tra poco.')
    } finally {
      setSigningOut(false)
    }
  }
  async function logout() {
    setError('')
    setSigningOut(true)
    try {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) {
        setError(
          'Non riesco a chiudere la sessione. Riprova con una connessione attiva.',
        )
        return
      }
      queries.clear()
      setSession(null)
    } catch {
      setError('Uscita non riuscita. Riprova online.')
    } finally {
      setSigningOut(false)
    }
  }

  if (!ready)
    return (
      <div className="app">
        <section className="panel loading-state" role="status">
          Apro il tuo diario…
        </section>
      </div>
    )
  if (!session)
    return (
      <div className="app login-page">
        <section className="panel">
          <span className="empty-icon">
            <BookOpen size={29} aria-hidden="true" />
          </span>
          <span className="eyebrow">FantaFolletto</span>
          <h1>
            Una nuova pagina
            <br />
            ti aspetta.
          </h1>
          <p className="section-description">
            Accedi al tuo diario delle piccole avventure.
          </p>
          <form onSubmit={login}>
            <fieldset disabled={signingOut}>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button className="primary-button full-width">
                {signingOut ? 'Accesso in corso…' : 'Entra nel diario'}
              </button>
            </fieldset>
          </form>
          <p className="demo-footnote">
            Il tuo account è stato preparato per te. Per recuperare l’accesso,
            contatta chi gestisce il regalo.
          </p>
        </section>
      </div>
    )
  return (
    <QueryClientProvider client={queries}>
      <ConnectedDiary
        key={`${config.url}:${session.user.id}`}
        client={client}
        projectUrl={config.url}
        userId={session.user.id}
        logout={logout}
        signingOut={signingOut}
        authError={error}
      />
    </QueryClientProvider>
  )
}

function ConnectedDiary({
  client,
  projectUrl,
  userId,
  logout,
  signingOut,
  authError,
}: {
  client: ReturnType<typeof makeClient>
  projectUrl: string
  userId: string
  logout: () => Promise<void>
  signingOut: boolean
  authError: string
}) {
  const controller = useRemoteDiary(client, projectUrl, userId)
  const [confirmExit, setConfirmExit] = useState(false)
  return (
    <>
      <DiaryView
        controller={controller}
        onLogout={() => setConfirmExit(true)}
      />
      {authError && (
        <div className="auth-error" role="alert">
          {authError}
        </div>
      )}
      {confirmExit && (
        <Modal
          title="Vuoi uscire dal diario?"
          busy={signingOut || controller.busy}
          onClose={() => setConfirmExit(false)}
        >
          <p className="modal-description">
            {controller.remote.queue.length
              ? `${controller.remote.queue.length} operazioni restano su questo telefono e riprenderanno quando accedi di nuovo con lo stesso account. Non saranno visibili a un altro account.`
              : 'Potrai riaprire il diario con la tua email e password.'}
          </p>
          {authError && (
            <p className="form-error" role="alert">
              {authError}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={signingOut || controller.busy}
              onClick={() => setConfirmExit(false)}
            >
              Resta qui
            </button>
            <button
              className="primary-button"
              disabled={signingOut || controller.busy}
              onClick={() => void logout()}
            >
              <LogOut size={17} />
              Esci
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

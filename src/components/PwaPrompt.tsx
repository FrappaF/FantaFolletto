import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaPrompt() {
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState('')
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const checking = useRef(false)
  const checkForUpdate = useCallback(async () => {
    if (
      !registration.current ||
      checking.current ||
      document.visibilityState === 'hidden' ||
      !navigator.onLine
    )
      return
    checking.current = true
    try {
      await registration.current.update()
    } catch {
      // Un controllo senza rete non invalida la versione già disponibile offline.
    } finally {
      checking.current = false
    }
  }, [])
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_url, value) => {
      registration.current = value
      void checkForUpdate()
    },
    onRegisterError: () =>
      setError(
        'La modalità offline non è ancora pronta. Riapri il diario online per completarla.',
      ),
  })
  useEffect(() => {
    const check = () => void checkForUpdate()
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    const interval = window.setInterval(check, 5 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(interval)
    }
  }, [checkForUpdate])
  useEffect(() => {
    const update = () =>
      setBlocked(
        !!document.querySelector('dialog[open], [data-update-blocked="true"]'),
      )
    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open', 'data-update-blocked'],
    })
    update()
    return () => observer.disconnect()
  }, [])
  if (!needRefresh && !error && !offlineReady) return null
  return (
    <aside className="pwa-prompt" aria-label="Stato app">
      <p role="status">
        {needRefresh
          ? blocked
            ? 'Una nuova versione ti aspetta. Chiudi i moduli e completa gli invii prima di aggiornare.'
            : 'È pronta una nuova versione del diario.'
          : error ||
            'Le risorse dell’app sono pronte per l’uso offline. Apri il diario online per caricare i tuoi dati.'}
      </p>
      {offlineReady && !needRefresh && (
        <button
          className="secondary-button"
          onClick={() => setOfflineReady(false)}
        >
          Va bene
        </button>
      )}
      {needRefresh && (
        <button
          className="secondary-button"
          disabled={blocked}
          onClick={() => {
            if (
              document.querySelector(
                'dialog[open], [data-update-blocked="true"]',
              )
            )
              return
            void updateServiceWorker(true).catch(() =>
              setError('Aggiornamento non riuscito. Riprova online.'),
            )
          }}
        >
          Aggiorna app
        </button>
      )}
    </aside>
  )
}

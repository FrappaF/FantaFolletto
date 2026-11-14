import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaPrompt() {
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState('')
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () =>
      setError(
        'La modalità offline non è ancora pronta. Riapri il diario online per completarla.',
      ),
  })
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

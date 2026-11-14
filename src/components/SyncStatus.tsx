import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { useRemoteDiary } from '../remote/useRemoteDiary'
import { Modal } from './ui'
import { statistics } from '../domain/stats'
import type { Diary } from '../domain/model'

export type RemoteState = ReturnType<typeof useRemoteDiary>['remote']

export function SyncStatus({
  remote,
  diary,
  refresh,
}: {
  remote: RemoteState
  diary?: Diary
  refresh: () => Promise<unknown>
}) {
  const [discard, setDiscard] = useState<string>()
  const blocked = remote.queue.filter(
    (operation) => operation.status === 'blocked',
  )
  const provisional = diary
    ? statistics(diary, new Date()).total - remote.confirmedTotal
    : 0
  return (
    <section className="sync-panel" aria-label="Stato del diario condiviso">
      <div className="sync-heading">
        <div>
          <strong>
            {remote.syncing
              ? 'Aggiorno il diario…'
              : remote.queue.length
                ? `${remote.queue.length} operazioni ancora sul telefono`
                : remote.fetchedAt
                  ? 'Diario condiviso aggiornato'
                  : 'Collego il diario…'}
          </strong>
          <p>
            {remote.fetchedAt
              ? `Ultima lettura: ${new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }).format(new Date(remote.fetchedAt))}`
              : 'Serve il primo caricamento online.'}
          </p>
        </div>
        <button
          className="icon-button"
          disabled={remote.syncing}
          onClick={() => void refresh()}
          aria-label="Aggiorna diario"
        >
          <RefreshCw size={19} />
        </button>
      </div>
      {remote.queue.length > 0 && (
        <p className="sync-copy">
          Gli inserimenti restano sul telefono fino alla conferma. I punti in
          attesa sono provvisori
          {provisional !== 0
            ? ` (${provisional > 0 ? '+' : ''}${provisional} sul totale)`
            : ''}
          . Gli inserimenti da correggere non aggiungono punti.
        </p>
      )}
      {remote.syncError && (
        <p className="sync-copy" role="status">
          {remote.syncError}
        </p>
      )}
      {blocked.length > 0 && (
        <div className="sync-errors">
          <h2>Questi inserimenti hanno bisogno di te</h2>
          {blocked.map((operation) => (
            <article key={operation.operationId}>
              <strong>
                {operation.type === 'record'
                  ? operation.entry.name
                  : operation.type === 'add-combo'
                    ? [
                        operation.combo.firstSurname,
                        operation.combo.secondSurname,
                      ]
                        .filter(Boolean)
                        .join(' + ')
                    : operation.type === 'remove-combo'
                      ? 'Rimozione combo'
                      : operation.type === 'add-note'
                        ? `Nota del ${operation.note.day.split('-').reverse().join('/')}`
                        : operation.type === 'remove-note'
                          ? 'Rimozione nota'
                          : 'Annullamento episodio'}
              </strong>
              <p>{operation.error}</p>
              <button
                className="text-button"
                onClick={() => setDiscard(operation.operationId)}
              >
                Rimuovi dalla coda
              </button>
            </article>
          ))}
          <button
            className="secondary-button"
            disabled={remote.syncing}
            onClick={() => void remote.retryBlocked()}
          >
            Riprova gli invii
          </button>
        </div>
      )}
      {discard && (
        <Modal
          title="Rimuovere questa operazione?"
          onClose={() => setDiscard(undefined)}
        >
          <p className="modal-description">
            Verrà rimossa solo l’operazione rifiutata. I dati già ricevuti dal
            server resteranno nel diario e potranno essere rimossi dalla loro
            sezione.
          </p>
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => setDiscard(undefined)}
            >
              Torna indietro
            </button>
            <button
              className="primary-button"
              onClick={async () => {
                await remote.discardRejected(discard)
                setDiscard(undefined)
              }}
            >
              Rimuovi dalla coda
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

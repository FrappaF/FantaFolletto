import { RotateCcw } from 'lucide-react'
import type { Entry } from '../domain/model'
import { formatDay, pointsLabel } from '../domain/stats'
import { EmptyState, EventIcon } from './ui'

const time = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  hour: '2-digit',
  minute: '2-digit',
})

export function Timeline({
  entries,
  busy,
  onUndo,
}: {
  entries: Entry[]
  busy: boolean
  onUndo?: (id: string) => void
}) {
  if (!entries.length)
    return (
      <EmptyState title="La prossima storia è tutta da scrivere">
        Un caffè, una risata, una piccola vittoria. Segna il primo episodio
        della tua giornata.
      </EmptyState>
    )
  return (
    <ol className="timeline">
      {entries.map((entry) => (
        <li key={entry.id} className={entry.voidedAt ? 'voided' : ''}>
          <EventIcon id={entry.eventId} />
          <div className="timeline-copy">
            <h3>{entry.name}</h3>
            <span>
              <time dateTime={entry.occurredAt}>
                {formatDay(entry.occurredAt)} ·{' '}
                {time.format(new Date(entry.occurredAt))}
              </time>
              {entry.voidedAt && ' · Annullato'}
              {entry.sync === 'pending' && ' · In attesa di invio'}
              {entry.sync === 'error' && ' · Da correggere'}
            </span>
          </div>
          <strong className={entry.points < 0 ? 'negative' : ''}>
            {pointsLabel(entry.points)}
            <small>pt</small>
          </strong>
          {onUndo && !entry.voidedAt && (
            <button
              className="icon-button undo-entry"
              title="Annulla episodio"
              aria-label={`Annulla ${entry.name}`}
              onClick={() => onUndo(entry.id)}
              disabled={busy}
            >
              <RotateCcw size={17} />
            </button>
          )}
        </li>
      ))}
    </ol>
  )
}

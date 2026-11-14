import { useState } from 'react'
import { Trophy } from 'lucide-react'
import type { Diary } from '../domain/model'
import { formatDay, rankings, statistics } from '../domain/stats'
import { EmptyState, SectionHeading } from './ui'
import { Timeline } from './Timeline'

export function Records({
  diary,
  now,
  busy,
  onUndo,
}: {
  diary: Diary
  now: Date
  busy: boolean
  onUndo: (id: string) => void
}) {
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [showVoided, setShowVoided] = useState(false)
  const stats = statistics(diary, now)
  const rows = rankings(diary, period)
  const entries = [...diary.entries]
    .filter((entry) => showVoided || !entry.voidedAt)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const [visible, setVisible] = useState(20)
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Ogni piccolo passo conta</span>
        <h1>I tuoi record</h1>
        <p>La tua unica avversaria? La te di ieri.</p>
      </div>
      <div className="stat-grid">
        <article>
          <span>Punti totali</span>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <span>Giorni di avventure</span>
          <strong>{stats.days}</strong>
        </article>
      </div>
      <section className="panel">
        <SectionHeading title="Le tue giornate migliori" />
        <div className="segmented" role="group" aria-label="Periodo dei record">
          <button
            aria-pressed={period === 'day'}
            onClick={() => setPeriod('day')}
          >
            Giornate
          </button>
          <button
            aria-pressed={period === 'week'}
            onClick={() => setPeriod('week')}
          >
            Settimane
          </button>
        </div>
        {rows.length ? (
          <ol className="ranking">
            {rows.slice(0, 5).map((row, index) => (
              <li key={row.date}>
                <span className={`rank ${index === 0 ? 'first' : ''}`}>
                  {index === 0 ? (
                    <Trophy size={19} aria-label="Primo posto" />
                  ) : (
                    index + 1
                  )}
                </span>
                <div>
                  <strong>
                    {period === 'week' ? 'Settimana del ' : ''}
                    {formatDay(row.date, true)}
                  </strong>
                  <span>{row.date.slice(0, 4)}</span>
                </div>
                <b>
                  {row.points} <small>pt</small>
                </b>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Il primo record ti aspetta">
            Appena registri un episodio, qui inizia la tua classifica personale.
          </EmptyState>
        )}
      </section>
      <section className="panel">
        <SectionHeading title="Le pagine del diario" />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showVoided}
            onChange={(event) => setShowVoided(event.target.checked)}
          />
          Mostra anche gli episodi annullati
        </label>
        <Timeline
          entries={entries.slice(0, visible)}
          busy={busy}
          onUndo={onUndo}
        />
        {entries.length > visible && (
          <button
            className="secondary-button full-width"
            onClick={() => setVisible((value) => value + 20)}
          >
            Mostra altri episodi
          </button>
        )}
      </section>
    </>
  )
}

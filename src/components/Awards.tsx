import type { Award } from '../domain/model'
import { formatDay } from '../domain/stats'

export function Awards({
  awards,
  busy = false,
  onDeliver,
}: {
  awards: Award[]
  busy?: boolean
  onDeliver?: (id: string) => void
}) {
  if (!awards.length)
    return (
      <p className="section-description">
        I premi conquistati compariranno qui dopo la conferma del diario
        condiviso.
      </p>
    )
  return (
    <div className="award-list">
      {awards.map((award) => (
        <article className="catalog-item" key={award.id}>
          <span className="badge">
            {award.deliveredAt
              ? 'Consegnato'
              : award.revokedAt
                ? 'Da riconquistare'
                : 'Conquistato'}
          </span>
          <h3>{award.name}</h3>
          {award.description && <p>{award.description}</p>}
          <p>
            {award.target} punti ·{' '}
            {award.period === 'week'
              ? `settimana del ${formatDay(award.periodKey)}`
              : 'totale diario'}{' '}
            · raggiunto il {formatDay(award.achievedAt)}
          </p>
          {award.needsReview && (
            <p role="status">
              Dopo una correzione, il totale è sotto la soglia. Il premio
              consegnato resta nel tuo storico.
            </p>
          )}
          {onDeliver &&
            !award.deliveredAt &&
            !award.revokedAt &&
            !award.needsReview && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => onDeliver(award.id)}
              >
                Segna come consegnato
              </button>
            )}
        </article>
      ))}
    </div>
  )
}

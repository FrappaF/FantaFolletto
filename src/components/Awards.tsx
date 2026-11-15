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
        Scegli un premio dal catalogo e riscattalo: comparirà qui dopo la
        conferma.
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
                : award.redeemedAt
                  ? 'Riscattato'
                  : 'Traguardo precedente'}
          </span>
          <h3>{award.name}</h3>
          {award.description && <p>{award.description}</p>}
          <p>
            {award.target} punti ·{' '}
            {award.period === 'week'
              ? `settimana del ${formatDay(award.periodKey)}`
              : 'totale diario'}{' '}
            · {award.redeemedAt ? 'riscattato' : 'raggiunto'} il{' '}
            {formatDay(award.redeemedAt ?? award.achievedAt)}
          </p>
          {award.needsReview && (
            <p role="status">
              {award.redeemedAt
                ? 'Dopo una correzione, i punti non coprono i riscatti. Il premio resta nello storico; i prossimi punti recupereranno il saldo.'
                : 'Dopo una correzione, il punteggio è sotto la soglia originale. Il premio consegnato resta nello storico.'}
            </p>
          )}
          {onDeliver &&
            !!award.redeemedAt &&
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

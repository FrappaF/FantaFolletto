import { initialDiary, type Diary, type Pledge } from '../domain/model'
import { nextPeriodStart, periodStart } from '../domain/pledges'
import { withPointBalance } from '../domain/rewards'

// L’anteprima è facoltativa e non si attiva mai nella modalità condivisa.
export function isPledgesDemo(
  search = typeof window === 'undefined' ? '' : window.location.search,
) {
  return (
    import.meta.env.VITE_APP_MODE === 'demo' &&
    new URLSearchParams(search).get('anteprima') === 'pegni'
  )
}

export function pledgesDemoDiary(now = new Date()): Diary {
  const week = periodStart('week', now)
  const previous = new Date(`${week}T12:00:00Z`)
  previous.setUTCDate(previous.getUTCDate() - 7)
  const previousWeek = previous.toISOString().slice(0, 10)
  const pledge = (
    id: string,
    name: string,
    description: string,
    period: Pledge['period'],
    target: number,
    effectiveFrom: string,
  ): Pledge => ({
    id,
    name,
    description,
    period,
    target,
    effectiveFrom,
    version: 1,
    archived: false,
  })
  const collected = pledge(
    'preview-collected',
    'La scelta del film',
    'Una serata cinema con il film scelto dall’admin.',
    'week',
    80,
    previousWeek,
  )
  return withPointBalance({
    ...initialDiary(),
    pledges: [
      pledge(
        'preview-week',
        'Colazione offerta da te',
        'Cappuccino e qualcosa di buono, questa volta offri tu.',
        'week',
        100,
        previousWeek,
      ),
      pledge(
        'preview-month',
        'Una cena cucinata da te',
        'Un piccolo menu fatto in casa da condividere.',
        'month',
        450,
        periodStart('month', now),
      ),
      collected,
      { ...collected, version: 2, archived: true, effectiveFrom: week },
      pledge(
        'preview-upcoming',
        'La playlist del prossimo viaggio',
        'Per il prossimo giro in auto la musica la sceglie l’admin.',
        'week',
        150,
        nextPeriodStart('week', now),
      ),
    ],
    pledgeClaims: [{
      id: 'preview-claim',
      pledgeId: collected.id,
      pledgeVersion: collected.version,
      name: collected.name,
      description: collected.description,
      target: collected.target,
      period: collected.period,
      periodKey: previousWeek,
      points: 0,
      redeemedAt: now.toISOString(),
      needsReview: false,
    }],
    entries: [
      {
        id: 'preview-coffee',
        eventId: 'coffee',
        eventVersion: 1,
        name: 'Un caffè offerto',
        points: 10,
        occurredAt: now.toISOString(),
      },
      {
        id: 'preview-demo',
        eventId: 'demo',
        eventVersion: 1,
        name: 'Dimostrazione da applausi',
        points: 25,
        occurredAt: now.toISOString(),
      },
    ],
  })
}

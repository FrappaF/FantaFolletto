import type { Diary, Pledge, PledgeClaim, PledgeCommand } from './model'
import { dayKey, weekKey } from './stats'
import { validDate, validDay } from './validation'

export type PledgeOccurrence = {
  pledge: Pledge
  periodKey: string
  endDay: string
  points: number
  remaining: number
  percent: number
  status: 'upcoming' | 'active' | 'avoided' | 'due' | 'collected'
  claim?: PledgeClaim
  needsReview: boolean
}

export function periodStart(period: Pledge['period'], now: string | Date) {
  return period === 'week' ? weekKey(now) : `${dayKey(now).slice(0, 7)}-01`
}

function advancePeriod(period: Pledge['period'], key: string) {
  const date = new Date(`${key}T12:00:00Z`)
  if (period === 'week') date.setUTCDate(date.getUTCDate() + 7)
  else date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 10)
}

export function nextPeriodStart(period: Pledge['period'], now: string | Date) {
  return advancePeriod(period, periodStart(period, now))
}

function lastDayBefore(day: string) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export function latestPledges(diary: Diary): Pledge[] {
  const latest = new Map<string, Pledge>()
  for (const pledge of diary.pledges ?? []) {
    if (pledge.version > (latest.get(pledge.id)?.version ?? 0))
      latest.set(pledge.id, pledge)
  }
  return [...latest.values()]
}

// Il costo dei premi non incide sulla quota; i dati non confermati non decidono un pegno.
export function pledgePoints(
  diary: Diary,
  period: Pledge['period'],
  key: string,
) {
  return diary.entries.reduce(
    (total, entry) =>
      !entry.voidedAt &&
      !entry.sync &&
      periodStart(period, entry.occurredAt) === key
        ? total + entry.points
        : total,
    0,
  )
}

export function pledgeOccurrences(diary: Diary, now: Date): PledgeOccurrence[] {
  const result: PledgeOccurrence[] = []
  for (const latest of latestPledges(diary)) {
    const versions = (diary.pledges ?? [])
      .filter((pledge) => pledge.id === latest.id)
      .sort(
        (a, b) =>
          a.effectiveFrom.localeCompare(b.effectiveFrom) || a.version - b.version,
      )
    const current = periodStart(latest.period, now)
    const last =
      versions[versions.length - 1].effectiveFrom > current
        ? versions[versions.length - 1].effectiveFrom
        : current
    for (
      let key = versions[0].effectiveFrom;
      key <= last;
      key = advancePeriod(latest.period, key)
    ) {
      const pledge = versions
        .filter((version) => version.effectiveFrom <= key)
        .at(-1)
      if (!pledge || pledge.archived) continue
      const points = pledgePoints(diary, pledge.period, key)
      const claim = diary.pledgeClaims?.find(
        (item) => item.pledgeId === pledge.id && item.periodKey === key,
      )
      result.push({
        pledge,
        periodKey: key,
        endDay: lastDayBefore(advancePeriod(pledge.period, key)),
        points,
        remaining: Math.max(0, pledge.target - points),
        percent: Math.min(100, Math.max(0, (points / pledge.target) * 100)),
        status: claim
          ? 'collected'
          : key > current
            ? 'upcoming'
            : key === current
              ? 'active'
              : points >= pledge.target
                ? 'avoided'
                : 'due',
        claim,
        needsReview: Boolean(claim && points >= claim.target),
      })
    }
  }
  return result.sort(
    (a, b) =>
      a.periodKey.localeCompare(b.periodKey) ||
      a.pledge.name.localeCompare(b.pledge.name),
  )
}

export function withPledgeReviews(diary: Diary): Diary {
  if (!diary.pledgeClaims) return diary
  return {
    ...diary,
    pledgeClaims: diary.pledgeClaims.map((claim) => ({
      ...claim,
      needsReview:
        pledgePoints(diary, claim.period, claim.periodKey) >= claim.target,
    })),
  }
}

export function applyPledgeCommand(
  diary: Diary,
  command: PledgeCommand & { expectedVersion?: number },
): Diary {
  if (command.type === 'redeem-pledge') {
    if (!command.id.trim() || command.id.length > 100)
      throw new Error('Identificativo della riscossione non valido.')
    if (!validDate(command.at) || !validDay(command.periodKey))
      throw new Error('La data non è valida.')
    const existing = diary.pledgeClaims?.find((claim) => claim.id === command.id)
    if (existing) {
      if (
        existing.pledgeId !== command.pledgeId ||
        existing.periodKey !== command.periodKey ||
        existing.pledgeVersion !== command.expectedVersion
      )
        throw new Error('Identificativo già usato con dati diversi.')
      return diary
    }
    const occurrence = pledgeOccurrences(diary, new Date(command.at)).find(
      (item) =>
        item.pledge.id === command.pledgeId &&
        item.periodKey === command.periodKey,
    )
    if (!occurrence) throw new Error('Pegno non trovato per questo periodo.')
    if (occurrence.status === 'collected')
      throw new Error('Pegno già riscosso per questo periodo.')
    if (occurrence.pledge.version !== command.expectedVersion)
      throw new Error('Il pegno è cambiato. Ricarica prima di riscuotere.')
    if (occurrence.status !== 'due')
      throw new Error(
        'Puoi riscuotere il pegno solo a periodo concluso e quota non raggiunta.',
      )
    const { pledge } = occurrence
    return {
      ...diary,
      pledgeClaims: [
        ...(diary.pledgeClaims ?? []),
        {
          id: command.id,
          pledgeId: pledge.id,
          pledgeVersion: pledge.version,
          name: pledge.name,
          description: pledge.description,
          target: pledge.target,
          period: pledge.period,
          periodKey: command.periodKey,
          points: occurrence.points,
          redeemedAt: command.at,
          needsReview: false,
        },
      ],
    }
  }
  const id = command.type === 'save-pledge' ? command.value.id : command.id
  const previous = latestPledges(diary).find((pledge) => pledge.id === id)
  if (command.expectedVersion !== (previous?.version ?? 0))
    throw new Error('Il pegno è cambiato. Ricarica prima di salvare.')
  if (previous?.archived)
    throw new Error('Un pegno archiviato non può essere modificato.')
  if (command.type === 'archive-pledge' && !previous)
    throw new Error('Pegno non trovato.')
  const value = command.type === 'save-pledge' ? command.value : previous!
  if (
    !value.id.trim() ||
    value.id.length > 100 ||
    !value.name.trim() ||
    value.name.length > 60 ||
    value.description.length > 180
  )
    throw new Error('Controlla la lunghezza dei campi.')
  if (
    !Number.isSafeInteger(value.target) ||
    value.target < 1 ||
    value.target > 100000
  )
    throw new Error('Inserisci un numero intero tra 1 e 100000.')
  if (!['week', 'month'].includes(value.period))
    throw new Error('Periodo non valido.')
  if (previous && previous.period !== value.period)
    throw new Error('La periodicità non può cambiare. Crea un nuovo pegno.')
  const pledge: Pledge = {
    id: value.id,
    name: value.name.trim(),
    description: value.description.trim(),
    target: value.target,
    period: value.period,
    version: (previous?.version ?? 0) + 1,
    archived: command.type === 'archive-pledge',
    effectiveFrom: nextPeriodStart(value.period, new Date()),
  }
  return { ...diary, pledges: [...(diary.pledges ?? []), pledge] }
}

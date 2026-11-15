import type { Diary, Reward } from './model'
import { activeEntries, sumPoints, weekKey } from './stats'

// La spesa non cambia i punteggi degli episodi né i record personali.
export function pointBalance(diary: Diary) {
  const earned = sumPoints(activeEntries(diary))
  const spent = (diary.awards ?? []).reduce(
    (total, award) => total + (award.pointsSpent ?? 0),
    0,
  )
  return {
    current: earned - spent,
    maximum: Math.max(0, diary.pointBalance?.maximum ?? 0, earned),
  }
}

export function withPointBalance(diary: Diary): Diary {
  const balance = pointBalance(diary)
  return {
    ...diary,
    pointBalance: balance,
    awards: diary.awards?.map((award) =>
      award.redeemedAt ? { ...award, needsReview: balance.current < 0 } : award,
    ),
  }
}

export function redemptionProgress(diary: Diary, reward: Reward, now: Date) {
  const balance = pointBalance(diary)
  const periodKey = reward.period === 'week' ? weekKey(now) : 'all'
  const claimed = (diary.awards ?? []).some(
    (award) =>
      award.rewardId === reward.id &&
      award.periodKey === periodKey &&
      Boolean(award.redeemedAt || award.deliveredAt),
  )
  // Il saldo è unico. Un premio settimanale richiede anche punti maturati questa settimana.
  const weekly = sumPoints(
    activeEntries(diary).filter(
      (entry) => weekKey(entry.occurredAt) === periodKey,
    ),
  )
  const points =
    reward.period === 'week'
      ? Math.min(balance.current, weekly)
      : balance.current
  return {
    periodKey,
    claimed,
    points,
    available: !reward.archived && !claimed && points >= reward.target,
    remaining: Math.max(0, reward.target - points),
    percent: Math.min(100, Math.max(0, (points / reward.target) * 100)),
  }
}

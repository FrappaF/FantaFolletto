import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import {
  CoffeeIcon,
  GiftIcon,
  NameIcon,
  PawIcon,
  RainIcon,
  RecordIcon,
  SmileIcon,
  SparkleIcon,
} from './DiaryIcons'
import type { Diary, Reward } from '../domain/model'
import { rewardProgress } from '../domain/stats'

export function EventIcon({
  id,
  categoryId,
}: {
  id: string
  categoryId?: string
}) {
  const eventIcons: Record<string, typeof SparkleIcon> = {
    coffee: CoffeeIcon,
    pet: PawIcon,
    laugh: SmileIcon,
    rain: RainIcon,
    name: NameIcon,
  }
  const categoryIcons: Record<string, typeof SparkleIcon> = {
    encounters: CoffeeIcon,
    animals: PawIcon,
    wins: RecordIcon,
    mishaps: SmileIcon,
    challenges: RecordIcon,
  }
  const Icon = eventIcons[id] ?? categoryIcons[categoryId ?? ''] ?? SparkleIcon
  return (
    <span className={`event-icon event-icon-${id}`}>
      <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
    </span>
  )
}

export function EmptyState({
  title,
  children,
  icon = 'sparkles',
}: {
  title: string
  children: ReactNode
  icon?: 'sparkles' | 'gift'
}) {
  const Icon = icon === 'gift' ? GiftIcon : SparkleIcon
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={27} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">FantaFolletto</span>
          <h2 id={headingId}>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Chiudi"
          onClick={onClose}
          disabled={busy}
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

export function RewardCard({
  diary,
  reward,
  now,
  compact = false,
  busy = false,
  onRedeem,
}: {
  diary: Diary
  reward: Reward
  now: Date
  compact?: boolean
  busy?: boolean
  onRedeem?: () => void
}) {
  const progress = rewardProgress(diary, reward, now)
  return (
    <article
      className={`reward-card ${compact ? 'compact' : ''} ${progress.reached ? 'reached' : ''}`}
    >
      <div className="reward-top">
        <span className="reward-icon">
          <GiftIcon size={23} />
        </span>
        <span className="badge">
          {reward.period === 'week' ? 'Questa settimana' : 'Senza scadenza'}
        </span>
      </div>
      <h3>{reward.name}</h3>
      {reward.description && <p>{reward.description}</p>}
      <div className="progress-meta">
        <span>
          {progress.claimed
            ? 'Già riscattato'
            : progress.available
              ? 'Disponibile da riscattare'
              : `${progress.remaining} punti al traguardo`}
        </span>
        <span>
          {progress.points} / {reward.target}
        </span>
      </div>
      <progress
        value={progress.percent}
        max={100}
        aria-label={`Progresso per ${reward.name}`}
      />
      {!compact && onRedeem && (
        <button
          className="primary-button"
          disabled={busy || !progress.available}
          onClick={onRedeem}
        >
          {progress.claimed
            ? 'Già riscattato'
            : `Riscatta · ${reward.target} punti`}
        </button>
      )}
      {!compact && (
        <p className="reward-note">
          {progress.claimed
            ? 'Trovi il premio nel tuo storico.'
            : reward.period === 'week'
              ? 'Usa i punti disponibili: devi averne maturati abbastanza anche questa settimana.'
              : 'Scegli tu quando riscattarlo: il costo verrà scalato dai punti attuali.'}
        </p>
      )}
    </article>
  )
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

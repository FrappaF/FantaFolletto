import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import {
  CoffeeIcon,
  GiftIcon,
  NameIcon,
  PawIcon,
  RainIcon,
  SmileIcon,
  SparkleIcon,
} from './DiaryIcons'
import type { Diary, Reward } from '../domain/model'
import { rewardProgress } from '../domain/stats'

export function EventIcon({ id }: { id: string }) {
  const Icon =
    id === 'coffee'
      ? CoffeeIcon
      : id === 'pet'
        ? PawIcon
        : id === 'laugh'
          ? SmileIcon
          : id === 'rain'
            ? RainIcon
            : id === 'name'
              ? NameIcon
              : SparkleIcon
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
}: {
  diary: Diary
  reward: Reward
  now: Date
  compact?: boolean
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
          {progress.reached
            ? diary.awards
              ? 'Soglia raggiunta · verifica i premi conquistati'
              : 'Obiettivo raggiunto!'
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
      {!compact && (
        <p className="reward-note">
          {progress.reached
            ? diary.awards
              ? 'I premi conquistati compaiono sotto dopo la conferma del diario condiviso.'
              : 'Che bella conquista. Nella demo il progresso si ricalcola se annulli un episodio.'
            : 'Un episodio alla volta, ci sei sempre più vicina.'}
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

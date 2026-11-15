import { useState } from 'react'
import type { Command, Diary, Reward } from '../domain/model'
import { pointBalance, redemptionProgress } from '../domain/rewards'
import { newId } from '../domain/ids'
import { Awards } from './Awards'
import { EmptyState, Modal, RewardCard, SectionHeading } from './ui'

export function PointBalance({
  diary,
  confirmed = false,
}: {
  diary: Diary
  confirmed?: boolean
}) {
  const balance =
    confirmed && diary.pointBalance ? diary.pointBalance : pointBalance(diary)
  return (
    <section className="panel points-balance" aria-label="Saldo punti">
      <div>
        <span>Punti attuali</span>
        <strong>{balance.current}</strong>
        <small>Disponibili per i premi</small>
      </div>
      <div>
        <span>Massimale punti</span>
        <strong>{balance.maximum}</strong>
        <small>Massimo storico accumulato</small>
      </div>
    </section>
  )
}

export function Rewards({
  diary,
  now,
  busy,
  error,
  execute,
  canRedeem,
  shared,
  waiting,
}: {
  diary: Diary
  now: Date
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  canRedeem: boolean
  shared: boolean
  waiting: boolean
}) {
  const [selected, setSelected] = useState<Reward>()
  const [message, setMessage] = useState('')
  const rewards = diary.rewards.filter((reward) => !reward.archived)
  const progress = selected && redemptionProgress(diary, selected, now)
  const blocked = busy || waiting || (shared && !diary.pointBalance)
  async function redeem() {
    if (!selected || !progress || !progress.available || blocked) return
    if (
      await execute({
        type: 'redeem-reward',
        id: newId(),
        rewardId: selected.id,
        expectedVersion: selected.version ?? 1,
        periodKey: progress.periodKey,
        at: new Date().toISOString(),
      })
    ) {
      setSelected(undefined)
      setMessage(
        shared
          ? 'Richiesta salvata. Il riscatto e il saldo si aggiorneranno dopo la conferma.'
          : 'Premio riscattato. I punti attuali sono aggiornati.',
      )
    }
  }
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Un pensiero, tutto per te</span>
        <h1>
          Le cose belle
          <br />
          che ti aspettano<span className="green-dot">.</span>
        </h1>
        <p>Scegli i tuoi premi e usa i punti che hai raccolto.</p>
      </div>
      <div className="rewards-content">
        <PointBalance diary={diary} confirmed={shared} />
        {waiting && (
          <p className="section-description" role="status">
            Attendi la conferma delle operazioni prima di riscattare un altro
            premio.
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {rewards.length ? (
          <div className="reward-list">
            {rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                diary={diary}
                reward={reward}
                now={now}
                busy={blocked}
                onRedeem={
                  canRedeem
                    ? () => {
                        setSelected(reward)
                        setMessage('')
                      }
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <section className="panel">
            <EmptyState title="Le sorprese sono in preparazione" icon="gift">
              Qui troverai i premi scelti per te.
            </EmptyState>
          </section>
        )}
        <section className="panel awards-panel">
          <SectionHeading title="I premi riscattati" />
          <Awards
            awards={(diary.awards ?? []).filter(
              (award) => award.redeemedAt || award.deliveredAt,
            )}
          />
        </section>
        {(diary.awards ?? []).some(
          (award) => !award.redeemedAt && !award.deliveredAt,
        ) && (
          <section className="panel">
            <SectionHeading title="Traguardi precedenti" />
            <p className="section-description">
              Questi premi erano stati assegnati automaticamente. Nessun punto è
              stato scalato: scegli dal catalogo cosa riscattare.
            </p>
            <Awards
              awards={(diary.awards ?? []).filter(
                (award) => !award.redeemedAt && !award.deliveredAt,
              )}
            />
          </section>
        )}
        {!shared && (
          <p className="demo-footnote">
            Premi di esempio. Riscatti e punti sono salvati solo in questo
            browser.
          </p>
        )}
      </div>
      {selected && (
        <Modal
          title={`Riscattare ${selected.name}?`}
          busy={busy}
          onClose={() => setSelected(undefined)}
        >
          <p className="modal-description">
            Userai {selected.target} punti. Dopo il riscatto avrai{' '}
            {pointBalance(diary).current - selected.target} punti attuali. Il
            massimale resta salvato.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setSelected(undefined)}
            >
              Torna indietro
            </button>
            <button
              className="primary-button"
              disabled={blocked || !progress?.available}
              onClick={() => void redeem()}
            >
              Conferma riscatto
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

import { useState, type FormEvent } from 'react'
import { Archive, CalendarClock, Check, Pencil, Plus } from 'lucide-react'
import type { Command, Diary, Pledge } from '../domain/model'
import { newId } from '../domain/ids'
import {
  latestPledges,
  nextPeriodStart,
  pledgeOccurrences,
  type PledgeOccurrence,
} from '../domain/pledges'
import { dayKey, formatDay } from '../domain/stats'
import { EmptyState, Modal, SectionHeading } from './ui'

const dateLabel = (day: string) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00Z`))

function occurrenceLabel(item: PledgeOccurrence) {
  if (item.status === 'upcoming') return 'In arrivo'
  if (item.status === 'due') return 'Da onorare'
  if (item.status === 'collected')
    return item.needsReview ? 'Riscosso · da verificare' : 'Riscosso'
  if (item.status === 'avoided') return 'Pegno evitato'
  return item.remaining === 0 ? 'Quota raggiunta' : 'In corso'
}

export function PledgeNotice({
  diary,
  now,
  onOpen,
}: {
  diary: Diary
  now: Date
  onOpen: () => void
}) {
  const occurrences = pledgeOccurrences(diary, now)
  const due = occurrences.filter((item) => item.status === 'due')
  const review = occurrences.filter((item) => item.needsReview)
  const next = occurrences
    .filter((item) => item.status === 'active' || item.status === 'upcoming')
    .sort((a, b) => a.endDay.localeCompare(b.endDay))[0]
  if (!due.length && !review.length && !next) return null
  return (
    <aside
      className={`pledge-notice ${due.length ? 'pledge-notice-due' : ''}`}
      aria-label="Avviso pegni"
    >
      <CalendarClock size={22} aria-hidden="true" />
      <div>
        <strong>
          {due.length
            ? `${due.length} ${due.length === 1 ? 'pegno da onorare' : 'pegni da onorare'}`
            : review.length
              ? 'Un pegno da verificare'
              : 'Un occhio alle scadenze'}
        </strong>
        <p>
          {due.length
            ? 'Il periodo si è chiuso sotto quota. La riscossione spetta all’admin.'
            : review.length
              ? 'I punti sono cambiati dopo la riscossione: controllate lo storico.'
              : next?.status === 'upcoming'
                ? `${next.pledge.name} · dal ${formatDay(next.periodKey)}`
                : next?.remaining === 0
                  ? `${next.pledge.name} · quota raggiunta, chiusura il ${formatDay(next.endDay)}.`
                  : `${next?.pledge.name} · ancora ${next?.remaining} punti entro il ${formatDay(next!.endDay)}.`}
        </p>
        <button className="text-button" onClick={onOpen}>
          Vedi i pegni
        </button>
      </div>
    </aside>
  )
}

type Props = {
  diary: Diary
  now: Date
  admin?: boolean
  busy?: boolean
  error?: string
  execute?: (command: Command) => Promise<boolean>
  canManage?: boolean
}

export function Pledges({
  diary,
  now,
  admin = false,
  busy = false,
  error = '',
  execute,
  canManage = true,
}: Props) {
  const [editor, setEditor] = useState<{ value?: Pledge }>()
  const [confirmation, setConfirmation] = useState<{
    title: string
    description: string
    action: string
    command: Command
  }>()
  const [message, setMessage] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [dueLimit, setDueLimit] = useState(8)
  const [historyLimit, setHistoryLimit] = useState(8)
  const occurrences = pledgeOccurrences(diary, now)
  const deadlines = occurrences
    .filter((item) => item.status === 'active' || item.status === 'upcoming')
    .sort((a, b) => a.endDay.localeCompare(b.endDay))
  const due = occurrences.filter((item) => item.status === 'due')
  const history = occurrences
    .filter((item) => item.status === 'avoided' || item.status === 'collected')
    .sort(
      (a, b) =>
        Number(b.needsReview) - Number(a.needsReview) ||
        b.periodKey.localeCompare(a.periodKey),
    )
  const definitions = latestPledges(diary)
  const blocked = busy || !canManage || !execute
  const pending = diary.entries.some((entry) => entry.sync)

  function collect(item: PledgeOccurrence) {
    setMessage('')
    setConfirmation({
      title: 'Confermare la riscossione?',
      description: `Confermi di aver ricevuto «${item.pledge.name}» per il periodo ${dateLabel(item.periodKey)} – ${dateLabel(item.endDay)}? Sono stati raccolti ${item.points} punti su ${item.pledge.target}. Nessun punto verrà scalato.`,
      action: 'Conferma riscossione',
      command: {
        type: 'redeem-pledge',
        id: newId(),
        pledgeId: item.pledge.id,
        periodKey: item.periodKey,
        expectedVersion: item.pledge.version,
        operationId: newId(),
        at: now.toISOString(),
      },
    })
  }

  function archive(pledge: Pledge) {
    setMessage('')
    setConfirmation({
      title: 'Archiviare questo pegno?',
      description: `«${pledge.name}» non si ripeterà dal ${dateLabel(nextPeriodStart(pledge.period, now))}. Il periodo in corso e i pegni precedenti restano nello storico.`,
      action: 'Archivia pegno',
      command: {
        type: 'archive-pledge',
        id: pledge.id,
        expectedVersion: pledge.version,
        operationId: newId(),
      },
    })
  }

  return (
    <div className="pledges-content" id="pegni">
      <div className="pledges-intro">
        <span className="eyebrow">Un piccolo patto</span>
        <h2>{admin ? 'Pegni' : 'Scadenze e storico'}</h2>
        <p>
          Se a fine settimana o mese i punti restano sotto quota, il pegno è da
          onorare. L’admin ne conferma la riscossione.
        </p>
        <p>
          Contano i punti guadagnati nel periodo: riscattare premi non cambia
          la quota.
        </p>
      </div>
      {message && <p role="status">{message}</p>}
      {error && !editor && !confirmation && (
        <p className="form-error" role="alert">{error}</p>
      )}
      {pending && (
        <p className="pledge-info" role="status">
          Il conteggio usa i punti confermati. Attendi l’invio degli episodi
          per avere il risultato aggiornato.
        </p>
      )}
      {due.length > 0 && (
        <section className="panel pledge-due-panel">
          <SectionHeading title="Da onorare" />
          <p className="section-description">
            Quota non raggiunta alla chiusura del periodo.{' '}
            {admin
              ? 'Conferma la riscossione quando hai ricevuto il pegno.'
              : 'Sarà l’admin a confermare quando il pegno è stato onorato.'}
          </p>
          <div className="pledge-list">
            {due.slice(0, dueLimit).map((item) => (
              <OccurrenceCard
                key={`${item.pledge.id}-${item.periodKey}`}
                item={item}
                busy={blocked || pending}
                onCollect={admin && execute ? () => collect(item) : undefined}
              />
            ))}
          </div>
          {due.length > dueLimit && (
            <button className="text-button" onClick={() => setDueLimit(dueLimit + 8)}>
              Mostra altri pegni ({due.length - dueLimit})
            </button>
          )}
        </section>
      )}
      <section className="panel">
        <SectionHeading title="Scadenze" />
        {deadlines.length ? (
          <div className="pledge-list">
            {deadlines.map((item) => (
              <OccurrenceCard key={`${item.pledge.id}-${item.periodKey}`} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState title={definitions.length ? 'Nessuna scadenza in corso' : 'I piccoli patti iniziano qui'}>
            {definitions.length
              ? 'Puoi ritrovare i pegni precedenti nello storico.'
              : admin
                ? 'Crea un pegno e scegli una quota settimanale o mensile.'
                : 'Qui troverai i pegni preparati dall’admin, con quota e scadenza.'}
          </EmptyState>
        )}
      </section>
      {history.length > 0 && (
        <details
          className="panel pledge-history"
          open={history.some((item) => item.needsReview) ? true : undefined}
        >
          <summary>Storico dei pegni <span>{history.length}</span></summary>
          <div className="pledge-list">
            {history.slice(0, historyLimit).map((item) => (
              <OccurrenceCard key={`${item.pledge.id}-${item.periodKey}`} item={item} />
            ))}
          </div>
          {history.length > historyLimit && (
            <button className="text-button" onClick={() => setHistoryLimit(historyLimit + 8)}>
              Mostra altro storico ({history.length - historyLimit})
            </button>
          )}
        </details>
      )}
      {admin && (
        <section className="panel pledge-catalog">
          <SectionHeading title="I patti del diario" />
          <button
            className="primary-button"
            disabled={blocked}
            onClick={() => { setEditor({}); setMessage('') }}
          >
            <Plus size={18} aria-hidden="true" />
            Crea pegno
          </button>
          <p className="pledge-info">
            Nuovi pegni, modifiche e archiviazioni valgono dalla prossima
            settimana o dal prossimo mese. I periodi già iniziati conservano
            le loro condizioni.
          </p>
          {definitions.some((item) => item.archived) && (
            <label className="pledge-archive-filter">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Mostra archiviati
            </label>
          )}
          <div className="catalog-list">
            {definitions.filter((item) => showArchived || !item.archived).map((item) => (
              <article className={`catalog-item ${item.archived ? 'archived' : ''}`} key={item.id}>
                <h3>{item.name}</h3>
                <span className="catalog-detail">
                  {item.target} punti · {item.period === 'week' ? 'Ogni settimana' : 'Ogni mese'}
                </span>
                <span className="catalog-detail">
                  {item.archived
                    ? `Archiviato dal ${dateLabel(item.effectiveFrom)}`
                    : `${item.effectiveFrom > dayKey(now) ? 'In partenza' : 'Condizioni in vigore'} dal ${dateLabel(item.effectiveFrom)}`}
                </span>
                {item.description && <p>{item.description}</p>}
                {!item.archived && (
                  <div className="item-actions">
                    <button
                      className="secondary-button"
                      disabled={blocked}
                      onClick={() => { setEditor({ value: item }); setMessage('') }}
                    >
                      <Pencil size={16} aria-hidden="true" />Modifica
                    </button>
                    <button className="text-button" disabled={blocked} onClick={() => archive(item)}>
                      <Archive size={16} aria-hidden="true" />Archivia
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {editor && execute && (
        <PledgeEditor
          value={editor.value}
          now={now}
          busy={busy}
          disabled={blocked}
          error={error}
          execute={execute}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined)
            setMessage('Pegno salvato per il prossimo periodo.')
          }}
        />
      )}
      {confirmation && execute && (
        <Modal title={confirmation.title} busy={busy} onClose={() => setConfirmation(undefined)}>
          <p className="modal-description">{confirmation.description}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="secondary-button" disabled={busy} onClick={() => setConfirmation(undefined)}>
              Torna indietro
            </button>
            <button
              className="primary-button"
              disabled={blocked || (confirmation.command.type === 'redeem-pledge' && pending)}
              onClick={async () => {
                if (await execute(confirmation.command)) {
                  setMessage(
                    confirmation.command.type === 'redeem-pledge'
                      ? 'Riscossione confermata.'
                      : 'Archiviazione salvata per il prossimo periodo.',
                  )
                  setConfirmation(undefined)
                }
              }}
            >
              {busy ? 'Salvataggio…' : confirmation.action}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function OccurrenceCard({
  item,
  busy = false,
  onCollect,
}: {
  item: PledgeOccurrence
  busy?: boolean
  onCollect?: () => void
}) {
  const { pledge } = item
  const running = item.status === 'active'
  return (
    <article className={`pledge-card pledge-${item.status}`}>
      <div className="pledge-card-top">
        <span className="pledge-status">
          {item.status === 'avoided' && <Check size={14} aria-hidden="true" />}
          {occurrenceLabel(item)}
        </span>
        <span>{pledge.period === 'week' ? 'Settimanale' : 'Mensile'}</span>
      </div>
      <h3>{pledge.name}</h3>
      {pledge.description && <p>{pledge.description}</p>}
      <p className="pledge-period">{dateLabel(item.periodKey)} – {dateLabel(item.endDay)}</p>
      {running || item.status === 'upcoming' ? (
        <>
          <div className="progress-meta">
            <span>
              {item.status === 'upcoming'
                ? `Dal ${formatDay(item.periodKey)}`
                : item.remaining === 0
                  ? 'Quota raggiunta'
                  : `${item.remaining} punti per evitare il pegno`}
            </span>
            <span>{item.points} / {pledge.target} punti</span>
          </div>
          <progress value={item.percent} max={100} aria-label={`Quota per ${pledge.name}`} />
        </>
      ) : (
        <p className="pledge-result">{item.points} / {pledge.target} punti nel periodo</p>
      )}
      {item.status === 'upcoming' && <p>Si parte con un periodo completo.</p>}
      {running && (
        <p>Scadenza: {dateLabel(item.endDay)}, entro fine giornata (ora italiana).</p>
      )}
      {item.claim && (
        <p>Riscossione confermata il {dateLabel(dayKey(item.claim.redeemedAt))}.</p>
      )}
      {item.needsReview && (
        <p className="pledge-review" role="status">
          I punti sono cambiati dopo la riscossione e ora raggiungono la quota.
          Il pegno resta nello storico: da verificare insieme.
        </p>
      )}
      {onCollect && (
        <button className="primary-button" disabled={busy} onClick={onCollect}>
          Riscuoti pegno
        </button>
      )}
    </article>
  )
}

function PledgeEditor({
  value,
  now,
  busy,
  disabled,
  error,
  execute,
  onClose,
  onSaved,
}: {
  value?: Pledge
  now: Date
  busy: boolean
  disabled: boolean
  error: string
  execute: NonNullable<Props['execute']>
  onClose: () => void
  onSaved: () => void
}) {
  const [id] = useState(() => value?.id ?? newId())
  const [operationId, setOperationId] = useState(newId)
  const [period, setPeriod] = useState<Pledge['period']>(value?.period ?? 'week')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return
    const form = new FormData(event.currentTarget)
    if (await execute({
      type: 'save-pledge',
      value: {
        id,
        name: String(form.get('name')),
        description: String(form.get('description')),
        target: Number(form.get('target')),
        period,
      },
      expectedVersion: value?.version ?? 0,
      operationId,
    })) onSaved()
  }
  return (
    <Modal title={value ? 'Modifica pegno' : 'Crea pegno'} busy={busy} onClose={onClose}>
      <form className="collection-form" onSubmit={submit} onChange={() => setOperationId(newId())}>
        <fieldset disabled={disabled}>
          <label>
            Nome
            <input
              name="name"
              defaultValue={value?.name}
              maxLength={60}
              required
              autoComplete="off"
              placeholder="Una colazione offerta da te…"
            />
          </label>
          <label>
            Descrizione <span className="optional">facoltativa</span>
            <textarea name="description" defaultValue={value?.description} maxLength={180} rows={3} />
          </label>
          <label>
            Quota da raggiungere
            <input
              name="target"
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              step={1}
              defaultValue={value?.target ?? 100}
              required
            />
            <span className="field-hint">Punti da guadagnare nel periodo per evitare il pegno.</span>
          </label>
          <label>
            Periodo
            <select
              name="period"
              value={period}
              disabled={Boolean(value)}
              onChange={(event) => setPeriod(event.target.value as Pledge['period'])}
            >
              <option value="week">Ogni settimana · da lunedì a domenica</option>
              <option value="month">Ogni mese · dal primo all’ultimo giorno</option>
            </select>
            {value && (
              <span className="field-hint">
                Per cambiare periodo, archivia questo pegno e creane uno nuovo.
              </span>
            )}
          </label>
          <p className="pledge-info">
            {value ? 'Le nuove condizioni valgono' : 'Il pegno parte'} dal{' '}
            {dateLabel(nextPeriodStart(period, now))}. Non cambia i periodi già iniziati.
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
              Torna indietro
            </button>
            <button className="primary-button" type="submit">
              {busy ? 'Salvataggio…' : 'Salva pegno'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}

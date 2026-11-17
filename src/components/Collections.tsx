import { useState } from 'react'
import { ArrowLeft, ArrowRight, Images, NotebookPen, Smile } from 'lucide-react'
import type { Command, Diary } from '../domain/model'
import { Combos } from './Combos'
import { DailyNotes } from './DailyNotes'
import { Doormats } from './Doormats'
import { usePhotos } from '../photos/PhotoProvider'

export function Collections(props: {
  diary: Diary
  now: Date
  busy: boolean
  error: string
  execute: (command: Command) => Promise<boolean>
  shared: boolean
}) {
  const [page, setPage] = useState<'combos' | 'notes' | 'doormats'>()
  const photos = usePhotos()
  if (page)
    return (
      <>
        <button
          className="text-button back-link"
          onClick={() => {
            setPage(undefined)
            window.scrollTo({ top: 0 })
          }}
        >
          <ArrowLeft size={17} /> Torna alle raccolte
        </button>
        {page === 'combos' ? (
          <Combos {...props} />
        ) : page === 'notes' ? (
          <DailyNotes {...props} />
        ) : (
          <Doormats now={props.now} />
        )}
      </>
    )
  return (
    <section className="diary-collection">
      <div className="page-title">
        <span className="eyebrow">Le cose da tenere con sé</span>
        <h1>
          Le tue raccolte<span className="green-dot">.</span>
        </h1>
        <p>Piccoli ricordi che fanno sorridere, anche a fine giornata.</p>
      </div>
      <div className="collection-index">
        {(
          [
            {
              id: 'combos',
              title: 'Cognomi',
              description: 'Incontri che sembrano fatti apposta per sorridere.',
              icon: Smile,
              count:
                props.diary.combos?.filter((p) => !p.removedAt).length ?? 0,
            },
            {
              id: 'notes',
              title: 'Note',
              description: 'Una pagina per le storie delle tue giornate.',
              icon: NotebookPen,
              count: props.diary.notes?.filter((p) => !p.removedAt).length ?? 0,
            },
            {
              id: 'doormats',
              title: 'Zerbini',
              description:
                'I benvenuti più divertenti, da fotografare e conservare.',
              icon: Images,
              count: photos.items.filter((p) => p.status !== 'removed').length,
            },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            className="panel collection-link"
            onClick={() => setPage(item.id)}
            aria-label={`Apri ${item.title}`}
          >
            <span className="collection-symbol">
              <item.icon size={26} strokeWidth={1.5} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
              <span className="collection-count">
                {item.count} {item.count === 1 ? 'ricordo' : 'ricordi'}
              </span>
            </span>
            <ArrowRight size={19} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  )
}

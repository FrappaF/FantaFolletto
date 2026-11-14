import type { Diary, EventDefinition } from '../domain/model'
import { categoriesFor, rarityLabels } from '../domain/scoring'

export function EventMeta({
  event,
  diary,
}: {
  event: EventDefinition
  diary: Diary
}) {
  const category = categoriesFor(diary).find(
    (item) => item.id === event.categoryId,
  )
  return (
    <span className="event-meta">
      {category && (
        <span>
          {category.icon} {category.name}
        </span>
      )}
      {event.rarity && event.rarity !== 'normal' && (
        <span className={`rarity rarity-${event.rarity}`}>
          {rarityLabels[event.rarity]}
        </span>
      )}
      {event.repeat === 'daily' && <span>Una volta al giorno</span>}
    </span>
  )
}
export function CategoryFilters({
  diary,
  value,
  onChange,
}: {
  diary: Diary
  value: string
  onChange: (value: string) => void
}) {
  const short: Record<string, string> = {
    encounters: 'Incontri',
    animals: 'Animali',
    wins: 'Vittorie',
    mishaps: 'Imprevisti',
    incredible: 'Incredibili',
    challenges: 'Sfide',
  }
  return (
    <div
      className="category-filters"
      role="group"
      aria-label="Filtra per categoria"
    >
      <button
        type="button"
        aria-pressed={value === ''}
        onClick={() => onChange('')}
      >
        Tutti
      </button>
      {categoriesFor(diary)
        .filter(
          (category) =>
            category.id === value ||
            diary.events.some(
              (event) => !event.archived && event.categoryId === category.id,
            ),
        )
        .sort((a, b) => a.order - b.order)
        .map((category) => (
          <button
            type="button"
            key={category.id}
            aria-pressed={value === category.id}
            onClick={() => onChange(category.id)}
          >
            {category.icon} {short[category.id] ?? category.name}
          </button>
        ))}
    </div>
  )
}

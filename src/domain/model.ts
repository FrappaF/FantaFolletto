import { validDay } from './validation'

import {
  previewEvent,
  recalculateCombos,
  nextRomeDay,
  defaultCategories,
} from './scoring'
export type EventCategory = {
  id: string
  name: string
  icon: string
  order: number
}
export type ScoringRule = {
  version: number
  effectiveDay: string
  incrementPercent: number
  maxMultiplier: number
}
export type EventDefinition = {
  id: string
  name: string
  description: string
  points: number
  version: number
  archived: boolean
  categoryId?: string
  rarity?: 'normal' | 'rare' | 'legendary'
  repeat?: 'unlimited' | 'daily'
}

export type Reward = {
  id: string
  name: string
  description: string
  target: number
  period: 'week' | 'all'
  archived: boolean
  version?: number
}

export type Entry = {
  id: string
  eventId: string
  eventVersion: number
  name: string
  points: number
  occurredAt: string
  voidedAt?: string
  receivedAt?: string
  basePoints?: number
  comboIndex?: number
  bonusPoints?: number
  scoringVersion?: number
  sync?: 'pending' | 'error'
}

export type Award = {
  id: string
  rewardId: string
  name: string
  description: string
  target: number
  period: 'week' | 'all'
  periodKey: string
  achievedAt: string
  revokedAt?: string
  deliveredAt?: string
  needsReview: boolean
}

export type SurnameCombo = {
  id: string
  firstSurname: string
  secondSurname: string
  note: string
  createdAt: string
  removedAt?: string
  sync?: 'pending' | 'error'
}

export type ComboCommand =
  | { type: 'add-combo'; value: SurnameCombo }
  | { type: 'remove-combo'; id: string; at: string }

export type DailyNote = {
  id: string
  day: string
  text: string
  createdAt: string
  removedAt?: string
  sync?: 'pending' | 'error'
}

export type NoteCommand =
  | { type: 'add-note'; value: DailyNote }
  | { type: 'remove-note'; id: string; at: string }

export type Diary = {
  schemaVersion: 1
  categories?: EventCategory[]
  scoringRules?: ScoringRule[]
  events: EventDefinition[]
  rewards: Reward[]
  entries: Entry[]
  awards?: Award[]
  combos?: SurnameCombo[]
  notes?: DailyNote[]
}

export type Command = (
  | ComboCommand
  | NoteCommand
  | {
      type: 'record'
      id: string
      eventId: string
      at: string
      version?: number
      snapshot?: { name: string; points: number }
    }
  | { type: 'void'; id: string; at: string }
  | {
      type: 'save-event'
      value: Pick<
        EventDefinition,
        | 'id'
        | 'name'
        | 'description'
        | 'points'
        | 'categoryId'
        | 'rarity'
        | 'repeat'
      >
    }
  | { type: 'archive-event'; id: string }
  | {
      type: 'save-reward'
      value: Pick<Reward, 'id' | 'name' | 'description' | 'target' | 'period'>
    }
  | { type: 'archive-reward'; id: string }
  | { type: 'deliver-award'; id: string }
  | {
      type: 'save-scoring'
      value: { incrementPercent: number; maxMultiplier: number }
    }
) & { operationId?: string; expectedVersion?: number }

export type AdminCommand = Exclude<
  Command,
  { type: 'record' | 'void' } | ComboCommand | NoteCommand
> & {
  operationId?: string
  expectedVersion?: number
}

export function initialDiary(): Diary {
  return {
    schemaVersion: 1,
    categories: defaultCategories,
    scoringRules: [
      {
        version: 1,
        effectiveDay: '1970-01-01',
        incrementPercent: 20,
        maxMultiplier: 3,
      },
    ],
    events: [
      {
        id: 'coffee',
        categoryId: 'encounters',
        rarity: 'normal',
        repeat: 'unlimited',
        name: 'Un caffè offerto',
        description: 'Una pausa gentile, tra una porta e l’altra.',
        points: 10,
        version: 1,
        archived: false,
      },
      {
        id: 'pet',
        categoryId: 'animals',
        rarity: 'normal',
        repeat: 'unlimited',
        name: 'Assistente a quattro zampe',
        description: 'Un animale si unisce alla dimostrazione.',
        points: 15,
        version: 1,
        archived: false,
      },
      {
        id: 'laugh',
        categoryId: 'encounters',
        rarity: 'normal',
        repeat: 'unlimited',
        name: 'Una risata contagiosa',
        description: 'Quella chiacchierata che migliora la giornata.',
        points: 10,
        version: 1,
        archived: false,
      },
      {
        id: 'demo',
        categoryId: 'wins',
        rarity: 'normal',
        repeat: 'unlimited',
        name: 'Dimostrazione da applausi',
        description: 'Tutto fila liscio. Che soddisfazione!',
        points: 25,
        version: 1,
        archived: false,
      },
      {
        id: 'name',
        categoryId: 'mishaps',
        rarity: 'normal',
        repeat: 'unlimited',
        name: 'Oggi mi chiamo…',
        description: 'Ti chiamano con un nome tutto nuovo.',
        points: 5,
        version: 1,
        archived: false,
      },
      {
        id: 'rain',
        categoryId: 'mishaps',
        rarity: 'normal',
        repeat: 'unlimited',
        name: 'Anche sotto la pioggia',
        description: 'Il meteo non ferma il tuo buonumore.',
        points: 15,
        version: 1,
        archived: false,
      },
    ],
    rewards: [
      {
        id: 'breakfast',
        name: 'Colazione con calma',
        description: 'Cappuccino, qualcosa di buono e zero fretta.',
        target: 100,
        period: 'week',
        archived: false,
      },
      {
        id: 'dinner',
        name: 'Una cena per due',
        description: 'Scegli tu il posto. Al resto ci penso io.',
        target: 300,
        period: 'all',
        archived: false,
      },
    ],
    entries: [],
  }
}

function checkText(value: string, max: number, required = true) {
  if ((required && !value.trim()) || value.length > max)
    throw new Error('Controlla la lunghezza dei campi.')
}

function checkInteger(value: number, min: number, max: number) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Inserisci un numero intero tra ${min} e ${max}.`)
}

export function applyCommand(state: Diary, command: Command): Diary {
  switch (command.type) {
    case 'add-note': {
      const { id, day, text, createdAt } = command.value
      checkText(id, 100)
      checkText(text, 2000)
      if (!validDay(day) || !Number.isFinite(Date.parse(createdAt)))
        throw new Error('La data della nota non è valida.')
      const note: DailyNote = { id, day, text: text.trim(), createdAt }
      const existing = state.notes?.find((item) => item.id === id)
      if (existing) {
        if (
          existing.day !== day ||
          existing.text !== note.text ||
          existing.createdAt !== createdAt
        )
          throw new Error('Identificativo già usato con dati diversi.')
        return state
      }
      return { ...state, notes: [...(state.notes ?? []), note] }
    }
    case 'remove-note': {
      if (!state.notes?.some((item) => item.id === command.id))
        throw new Error('Nota non trovata.')
      if (!Number.isFinite(Date.parse(command.at)))
        throw new Error('La data non è valida.')
      return {
        ...state,
        notes: state.notes.map((item) =>
          item.id === command.id && !item.removedAt
            ? { ...item, removedAt: command.at }
            : item,
        ),
      }
    }
    case 'add-combo': {
      const { id, firstSurname, secondSurname, note, createdAt } = command.value
      checkText(id, 100)
      checkText(firstSurname, 60)
      checkText(secondSurname, 60, false)
      checkText(note, 180, false)
      if (!Number.isFinite(Date.parse(createdAt)))
        throw new Error('La data non è valida.')
      const combo: SurnameCombo = {
        id,
        firstSurname: firstSurname.trim(),
        secondSurname: secondSurname.trim(),
        note: note.trim(),
        createdAt,
      }
      const existing = state.combos?.find((item) => item.id === id)
      if (existing) {
        if (
          existing.firstSurname !== combo.firstSurname ||
          existing.secondSurname !== combo.secondSurname ||
          existing.note !== combo.note ||
          existing.createdAt !== createdAt
        )
          throw new Error('Identificativo già usato con dati diversi.')
        return state
      }
      return { ...state, combos: [...(state.combos ?? []), combo] }
    }
    case 'remove-combo': {
      if (!state.combos?.some((item) => item.id === command.id))
        throw new Error('Combo non trovata.')
      if (!Number.isFinite(Date.parse(command.at)))
        throw new Error('La data non è valida.')
      return {
        ...state,
        combos: state.combos.map((item) =>
          item.id === command.id && !item.removedAt
            ? { ...item, removedAt: command.at }
            : item,
        ),
      }
    }
    case 'record': {
      const existing = state.entries.find((entry) => entry.id === command.id)
      if (existing) {
        if (
          existing.eventId !== command.eventId ||
          existing.occurredAt !== command.at
        )
          throw new Error('Identificativo già usato per un altro episodio.')
        return state
      }
      const event = state.events.find(
        (item) => item.id === command.eventId && !item.archived,
      )
      if (!event)
        throw new Error(
          'Questo evento non è più disponibile. Scegline un altro.',
        )
      if (!Number.isFinite(Date.parse(command.at)))
        throw new Error('La data non è valida.')
      const score = previewEvent(state, event, command.at)
      if (!score.available)
        throw new Error('Questa sfida è già stata segnata oggi.')
      return recalculateCombos({
        ...state,
        entries: [
          ...state.entries,
          {
            id: command.id,
            eventId: event.id,
            eventVersion: event.version,
            name: event.name,
            ...score.entry,
            occurredAt: command.at,
          },
        ],
      })
    }
    case 'void': {
      if (!state.entries.some((entry) => entry.id === command.id))
        throw new Error('Episodio non trovato.')
      if (!Number.isFinite(Date.parse(command.at)))
        throw new Error('La data non è valida.')
      return recalculateCombos({
        ...state,
        entries: state.entries.map((entry) =>
          entry.id === command.id && !entry.voidedAt
            ? { ...entry, voidedAt: command.at }
            : entry,
        ),
      })
    }
    case 'save-scoring': {
      const { incrementPercent, maxMultiplier } = command.value
      checkInteger(incrementPercent, 0, 1000)
      if (
        !Number.isFinite(maxMultiplier) ||
        maxMultiplier < 1 ||
        maxMultiplier > 20 ||
        Math.abs(maxMultiplier * 10 - Math.round(maxMultiplier * 10)) > 1e-8
      )
        throw new Error(
          'Il tetto deve essere tra ×1 e ×20, con un decimale al massimo.',
        )
      const version =
        Math.max(0, ...(state.scoringRules ?? []).map((rule) => rule.version)) +
        1
      if (
        command.expectedVersion !== undefined &&
        command.expectedVersion !== version - 1
      )
        throw new Error('Le regole sono cambiate. Ricarica prima di salvare.')
      return {
        ...state,
        scoringRules: [
          ...(state.scoringRules ?? []),
          { ...command.value, version, effectiveDay: nextRomeDay(new Date()) },
        ],
      }
    }
    case 'save-event': {
      const value = command.value
      checkText(value.name, 60)
      checkText(value.description, 180, false)
      checkInteger(value.points, -1000, 1000)
      if (
        value.categoryId &&
        !(state.categories ?? defaultCategories).some(
          (category) => category.id === value.categoryId,
        )
      )
        throw new Error('Categoria non valida.')
      if (
        value.rarity &&
        !['normal', 'rare', 'legendary'].includes(value.rarity)
      )
        throw new Error('Rarità non valida.')
      if (value.repeat && !['unlimited', 'daily'].includes(value.repeat))
        throw new Error('Ripetizione non valida.')
      const previous = state.events.find((event) => event.id === value.id)
      if (previous?.archived)
        throw new Error('Un evento archiviato non può essere modificato.')
      const event: EventDefinition = {
        ...previous,
        ...value,
        name: value.name.trim(),
        description: value.description.trim(),
        version: (previous?.version ?? 0) + 1,
        archived: false,
      }
      return {
        ...state,
        events: previous
          ? state.events.map((item) => (item.id === value.id ? event : item))
          : [...state.events, event],
      }
    }
    case 'archive-event': {
      if (!state.events.some((event) => event.id === command.id))
        throw new Error('Evento non trovato.')
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === command.id ? { ...event, archived: true } : event,
        ),
      }
    }
    case 'save-reward': {
      const value = command.value
      checkText(value.name, 60)
      checkText(value.description, 180, false)
      checkInteger(value.target, 1, 100000)
      if (!['week', 'all'].includes(value.period))
        throw new Error('Periodo non valido.')
      const previous = state.rewards.find((reward) => reward.id === value.id)
      if (previous?.archived)
        throw new Error('Un premio archiviato non può essere modificato.')
      const reward: Reward = {
        ...value,
        name: value.name.trim(),
        description: value.description.trim(),
        archived: false,
      }
      return {
        ...state,
        rewards: previous
          ? state.rewards.map((item) => (item.id === value.id ? reward : item))
          : [...state.rewards, reward],
      }
    }
    case 'archive-reward': {
      if (!state.rewards.some((reward) => reward.id === command.id))
        throw new Error('Premio non trovato.')
      return {
        ...state,
        rewards: state.rewards.map((reward) =>
          reward.id === command.id ? { ...reward, archived: true } : reward,
        ),
      }
    }
    case 'deliver-award':
      throw new Error(
        'La consegna dei premi è disponibile solo nel diario condiviso.',
      )
  }
}

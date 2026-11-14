export type EventDefinition = {
  id: string
  name: string
  description: string
  points: number
  version: number
  archived: boolean
}

export type Reward = {
  id: string
  name: string
  description: string
  target: number
  period: 'week' | 'all'
  archived: boolean
}

export type Entry = {
  id: string
  eventId: string
  eventVersion: number
  name: string
  points: number
  occurredAt: string
  voidedAt?: string
}

export type Diary = {
  schemaVersion: 1
  events: EventDefinition[]
  rewards: Reward[]
  entries: Entry[]
}

export type Command =
  | { type: 'record'; id: string; eventId: string; at: string }
  | { type: 'void'; id: string; at: string }
  | {
      type: 'save-event'
      value: Pick<EventDefinition, 'id' | 'name' | 'description' | 'points'>
    }
  | { type: 'archive-event'; id: string }
  | {
      type: 'save-reward'
      value: Pick<Reward, 'id' | 'name' | 'description' | 'target' | 'period'>
    }
  | { type: 'archive-reward'; id: string }

export function initialDiary(): Diary {
  return {
    schemaVersion: 1,
    events: [
      {
        id: 'coffee',
        name: 'Un caffè offerto',
        description: 'Una pausa gentile, tra una porta e l’altra.',
        points: 10,
        version: 1,
        archived: false,
      },
      {
        id: 'pet',
        name: 'Assistente a quattro zampe',
        description: 'Un animale si unisce alla dimostrazione.',
        points: 15,
        version: 1,
        archived: false,
      },
      {
        id: 'laugh',
        name: 'Una risata contagiosa',
        description: 'Quella chiacchierata che migliora la giornata.',
        points: 10,
        version: 1,
        archived: false,
      },
      {
        id: 'demo',
        name: 'Dimostrazione da applausi',
        description: 'Tutto fila liscio. Che soddisfazione!',
        points: 25,
        version: 1,
        archived: false,
      },
      {
        id: 'name',
        name: 'Oggi mi chiamo…',
        description: 'Ti chiamano con un nome tutto nuovo.',
        points: 5,
        version: 1,
        archived: false,
      },
      {
        id: 'rain',
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
      return {
        ...state,
        entries: [
          ...state.entries,
          {
            id: command.id,
            eventId: event.id,
            eventVersion: event.version,
            name: event.name,
            points: event.points,
            occurredAt: command.at,
          },
        ],
      }
    }
    case 'void': {
      if (!state.entries.some((entry) => entry.id === command.id))
        throw new Error('Episodio non trovato.')
      if (!Number.isFinite(Date.parse(command.at)))
        throw new Error('La data non è valida.')
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.id === command.id && !entry.voidedAt
            ? { ...entry, voidedAt: command.at }
            : entry,
        ),
      }
    }
    case 'save-event': {
      const value = command.value
      checkText(value.name, 60)
      checkText(value.description, 180, false)
      checkInteger(value.points, -1000, 1000)
      const previous = state.events.find((event) => event.id === value.id)
      if (previous?.archived)
        throw new Error('Un evento archiviato non può essere modificato.')
      const event: EventDefinition = {
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
  }
}

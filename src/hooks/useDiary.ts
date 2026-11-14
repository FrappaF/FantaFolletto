import { useCallback, useEffect, useRef, useState } from 'react'
import { readDiary, saveCommand } from '../data/diary-store'
import type { Command, Diary } from '../domain/model'

export function useDiary() {
  const [diary, setDiary] = useState<Diary>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const channel = useRef<BroadcastChannel | null>(null)
  const lock = useRef(false)
  const sequence = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++sequence.current
    try {
      const value = await readDiary()
      if (current === sequence.current) {
        setDiary(value)
        setError('')
      }
    } catch (error) {
      if (current === sequence.current)
        setError(
          error instanceof Error
            ? error.message
            : 'Non riesco ad aprire il diario.',
        )
    }
  }, [])

  useEffect(() => {
    void refresh()
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('fantafolletto-demo')
      channel.current.onmessage = () => {
        void refresh()
      }
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      channel.current?.close()
      channel.current = null
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [refresh])

  const execute = async (command: Command) => {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setError('')
    ++sequence.current
    try {
      const value = await saveCommand(command)
      // A focus refresh may have started while the transaction was pending.
      ++sequence.current
      setDiary(value)
      channel.current?.postMessage('changed')
      return true
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Salvataggio non riuscito. Riprova.',
      )
      return false
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return { diary, busy, error, execute, refresh }
}

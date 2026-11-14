// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it('senza configurazione la modalità reale non ripiega sul falso admin della demo', () => {
  vi.stubEnv('VITE_APP_MODE', 'remote')
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
  render(<App />)
  expect(
    screen.getByRole('heading', { name: 'Il diario è quasi pronto' }),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: /admin/ })).toBeNull()
  expect(screen.queryByText('Versione demo')).toBeNull()
})

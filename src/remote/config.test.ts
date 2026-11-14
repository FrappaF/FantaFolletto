import { afterEach, expect, it, vi } from 'vitest'
import { readConfig } from './config'

afterEach(() => vi.unstubAllEnvs())

it('richiede URL HTTPS e una chiave publishable, rifiuta segreti e configurazioni parziali', () => {
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
  expect(readConfig()).toBeUndefined()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_never_allowed')
  expect(readConfig()).toBeUndefined()
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  expect(readConfig()?.url).toBe('https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_URL', 'http://example.supabase.co')
  expect(readConfig()).toBeUndefined()
})

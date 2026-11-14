// Operator-only utility. Never import into the frontend. Password arrives through stdin.
import { createClient } from '@supabase/supabase-js'

const url = process.env.FF_SUPABASE_URL
const key = process.env.FF_SUPABASE_SECRET_KEY
const userId = process.argv[2]
if (
  !url?.startsWith('https://') ||
  !key?.startsWith('sb_secret_') ||
  !/^[0-9a-f-]{36}$/i.test(userId ?? '')
) {
  console.error(
    'Servono FF_SUPABASE_URL, FF_SUPABASE_SECRET_KEY e UUID dell’utente. Non usare variabili VITE_*.',
  )
  process.exit(1)
}
if (process.stdin.isTTY) {
  console.error(
    'Passa la nuova password tramite stdin nascosto, come indicato in docs/SETUP.md.',
  )
  process.exit(1)
}
let password = ''
for await (const chunk of process.stdin) password += chunk.toString()
password = password.replace(/\r?\n$/, '')
if (password.length < 12 || password.length > 128) {
  console.error('Usa una password di almeno 12 e non oltre 128 caratteri.')
  process.exit(1)
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
try {
  const { error } = await client.auth.admin.updateUserById(userId, { password })
  password = ''
  if (error) {
    console.error(
      'Aggiornamento non riuscito. Controlla progetto, UUID, connessione e permessi della chiave.',
    )
    process.exitCode = 1
  } else console.log('Password aggiornata. Accedi di nuovo con il tuo account.')
} catch {
  console.error(
    'Servizio non raggiungibile. Nessuna conferma di modifica: riprova.',
  )
  process.exitCode = 1
}

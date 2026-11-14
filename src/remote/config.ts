export type RemoteConfig = { url: string; key: string }

export function readConfig(): RemoteConfig | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return undefined
  try {
    if (
      new URL(url).protocol !== 'https:' ||
      !key.startsWith('sb_publishable_')
    )
      return undefined
    return { url, key }
  } catch {
    return undefined
  }
}

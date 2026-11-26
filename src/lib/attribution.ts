const STORAGE_KEY = 'attribution'

const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
] as const

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>

/** Legge UTM/click id dalla query e li salva in sessionStorage se presenti. */
export function captureAttribution() {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  const next: Attribution = {}

  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key)?.trim()
    if (value) next[key] = value
  }

  if (Object.keys(next).length === 0) return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Attribution
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

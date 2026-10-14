declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

/** Webhook Apps Script: stesso foglio Google "consulenza" + Relatia pipeline YES GROUP */
const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbwFMck9uhTMXCWz0cIYbOiL2e1cJTnMlmYiJxhJqjV8SYBYYDYg48vfKjXl9-EZgsXk/exec'

/**
 * Invia il lead al webhook Google Apps Script, che:
 * - salva sul foglio "consulenza" (invariato)
 * - crea il contatto in Relatia nella pipeline YES GROUP
 * Usa text/plain per evitare preflight CORS con Apps Script.
 */
export async function submitLead(data: Record<string, unknown>) {
  // Sempre il webhook Sheets+Relatia. Non usare VITE_WEBHOOK_URL in prod:
  // su Vercel può restare un vecchio URL solo-Sheets che bypassa Relatia.
  const url = DEFAULT_WEBHOOK_URL

  const res = await fetch(url, {
    method: 'POST',
    // text/plain evita il preflight CORS con Google Apps Script
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
  })

  // Apps Script può rispondere 200 dopo redirect; se il body non è leggibile
  // ma lo status è ok, consideriamo successo.
  if (!res.ok) {
    throw new Error('submit_failed')
  }

  try {
    const payload = (await res.json()) as { ok?: boolean }
    if (payload && payload.ok === false) {
      throw new Error('submit_failed')
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'submit_failed') throw err
    // JSON non parseabile ma HTTP ok → ok (comportamento tipico GAS)
  }

  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead')
  }
}

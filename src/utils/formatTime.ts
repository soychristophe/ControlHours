/**
 * utils/formatTime.ts
 * Central time-formatting helpers.
 * All UI time displays should go through here so the 24h/12h
 * setting in SettingsPage is respected everywhere.
 */

export type TimeFormat = '24h' | '12h'

/**
 * Format a Date (or ISO string) to HH:MM or H:MM AM/PM.
 * Use the hook version `useFormatTime()` inside React components.
 */
export function formatTime(date: Date | string, fmt: TimeFormat): string {
  const d = new Date(date)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')

  if (fmt === '24h') {
    return `${String(h).padStart(2, '0')}:${m}`
  }
  const h12 = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${h12}:${m} ${ampm}`
}

/**
 * Format a datetime-local input value (YYYY-MM-DDTHH:mm) to a
 * human-readable date+time string.
 */
export function formatDatetime(date: Date | string, fmt: TimeFormat): string {
  const d = new Date(date)
  const day = d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day}, ${formatTime(d, fmt)}`
}

/**
 * Convert a Date to the value expected by <input type="datetime-local">.
 * Output: "YYYY-MM-DDTHH:mm"
 */
export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/**
 * Human-readable duration between two dates.
 * Returns "—" if end ≤ start.
 */
export function formatDuration(start: Date | string, end: Date | string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  if (diffMs <= 0) return '—'
  const totalMin = Math.floor(diffMs / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

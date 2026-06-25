/**
 * Formats a date relative to the current time (e.g. "5 minutes ago" / "hace 5 minutos").
 */
export function formatRelativeTime(dateStr: string | Date | undefined | null, locale: string = 'es'): string {
  if (!dateStr) return ''
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHr = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHr / 24)

  const localeTag = locale.startsWith('es') ? 'es' : 'en'
  const rtf = new Intl.RelativeTimeFormat(localeTag, { numeric: 'auto' })

  if (Math.abs(diffSec) < 60) {
    return localeTag === 'es' ? 'hace un momento' : 'just now'
  } else if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, 'minute')
  } else if (Math.abs(diffHr) < 24) {
    return rtf.format(diffHr, 'hour')
  } else {
    return rtf.format(diffDay, 'day')
  }
}

/**
 * Formats a date into a clean absolute localized string (e.g. "Jun 25, 1:54 PM" / "25 de jun., 1:54 PM").
 */
export function formatAbsoluteTime(dateStr: string | Date | undefined | null, locale: string = 'es'): string {
  if (!dateStr) return ''
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  if (isNaN(date.getTime())) return ''

  const localeTag = locale.startsWith('es') ? 'es' : 'en'
  return new Intl.DateTimeFormat(localeTag, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

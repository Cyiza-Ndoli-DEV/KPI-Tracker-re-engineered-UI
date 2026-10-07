// Small shared helpers: ids, dates, number formatting.

let counter = 0
export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

// ---- Dates (always ISO 'YYYY-MM-DD' strings in state) ----
export function todayISO() {
  const d = new Date()
  return toISO(d)
}
export function nowISO() {
  return new Date().toISOString()
}
export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function parseISO(s) {
  if (!s) return null
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
/** Inclusive number of days between two ISO dates. */
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000) + 1
}
export const minISO = (...xs) => xs.filter(Boolean).sort()[0]
export const maxISO = (...xs) => xs.filter(Boolean).sort().slice(-1)[0]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtDate(iso) {
  if (!iso) return '—'
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export function fmtShortDate(iso) {
  if (!iso) return '—'
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
export function fmtRange(a, b) {
  if (!a || !b) return '—'
  const da = parseISO(a)
  const db = parseISO(b)
  if (da.getFullYear() === db.getFullYear()) return `${fmtShortDate(a)} – ${fmtDate(b)}`
  return `${fmtDate(a)} – ${fmtDate(b)}`
}
export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${fmtDate(toISO(d))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} day${d > 1 ? 's' : ''} ago`
}

// ---- Numbers ----
export const round = (n, dp = 2) => {
  const f = 10 ** dp
  return Math.round((Number(n) || 0) * f) / f
}
export function fmtNum(n, dp = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })
}
export function fmtCompact(n) {
  const a = Math.abs(n)
  if (a >= 1e9) return `${round(n / 1e9, 2)}B`
  if (a >= 1e6) return `${round(n / 1e6, 2)}M`
  if (a >= 1e3) return `${round(n / 1e3, 1)}K`
  return fmtNum(n, 2)
}
export function fmtPct(n, dp = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${round(n, dp)}%`
}

export const UNITS = ['UGX', 'USD', '%', 'Users', 'Customers', 'Clients', 'Deals', 'Tickets', 'Hours', 'Days', 'Score', 'Count']

/** Format a KPI value with its unit. compact=true gives 300M instead of 300,000,000. */
export function fmtValue(unit, v, compact = true) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  if (unit === 'UGX' || unit === 'USD') return `${unit} ${compact ? fmtCompact(v) : fmtNum(v)}`
  if (unit === '%') return `${round(v, 1)}%`
  return `${compact ? fmtCompact(v) : fmtNum(v, 2)} ${unit || ''}`.trim()
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
export const sum = (xs) => xs.reduce((a, b) => a + (Number(b) || 0), 0)
export const initials = (name = '') =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

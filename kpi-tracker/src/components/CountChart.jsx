import { parseISO, fmtDate } from '../lib/utils'

/** Line chart of counts over dates (e.g. results recorded per day or week). */
export default function CountChart({ points, start, end, height = 200, label = 'results' }) {
  const W = 760
  const H = height
  const pad = { l: 36, r: 16, t: 16, b: 28 }
  const t0 = parseISO(start).getTime()
  const t1 = Math.max(t0 + 86400000, parseISO(end).getTime())
  const maxY = Math.max(2, ...points.map((p) => p.count))
  const x = (d) => pad.l + ((parseISO(d).getTime() - t0) / (t1 - t0)) * (W - pad.l - pad.r)
  const y = (v) => H - pad.b - (v / maxY) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ')
  const ticks = [...new Set([0, Math.round(maxY / 2), maxY])]
  const months = []
  const d = parseISO(start)
  d.setDate(1)
  while (d.getTime() <= t1) {
    if (d.getTime() >= t0) months.push(new Date(d))
    d.setMonth(d.getMonth() + 1)
  }
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e7edf7" />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6b7a94">{v}</text>
        </g>
      ))}
      {months.map((m) => {
        const iso = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
        return <text key={iso} x={x(iso)} y={H - 8} fontSize="11" fill="#6b7a94" textAnchor="middle">{M[m.getMonth()]}</text>
      })}
      {points.length > 1 && <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinejoin="round" />}
      {points.map((p) => (
        <g key={p.date}>
          <line x1={x(p.date)} x2={x(p.date)} y1={y(0)} y2={y(p.count)} stroke="#bfd3fb" strokeWidth="1" />
          <circle cx={x(p.date)} cy={y(p.count)} r="4" fill="white" stroke="#2563eb" strokeWidth="2">
            <title>{`${fmtDate(p.date)}: ${p.count} ${label}${p.people ? ` by ${p.people} ${p.people === 1 ? 'person' : 'people'}` : ''}`}</title>
          </circle>
        </g>
      ))}
      {points.length === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="#6b7a94">No results in this range</text>}
    </svg>
  )
}

import { useStore } from '../store'
import { Badge } from './ui'
import { bandsOf } from '../lib/calc'

const TONE_COLOR = { green: '#86efac', blue: '#93c5fd', amber: '#fcd34d', red: '#fca5a5', violet: '#c4b5fd', gray: '#cbd5e1' }

/** The performance bands from Admin Settings → Set up, as a bar (or as badges with compact). */
export default function BandScale({ compact = false, max = 110 }) {
  const { state } = useStore()
  const bands = [...bandsOf(state)].sort((a, b) => a.min - b.min)
  if (compact)
    return (
      <div className="row wrap gap-6">
        {[...bands].reverse().map((b) => <Badge key={b.key} tone={b.tone}>{b.label} {b.min}%+</Badge>)}
      </div>
    )
  return (
    <div>
      <div className="stack-bar" style={{ height: 8 }}>
        {bands.map((b, i) => {
          const end = i < bands.length - 1 ? bands[i + 1].min : max
          return <span key={b.key} title={`${b.label} ${b.min}%+`} style={{ width: `${((Math.min(end, max) - b.min) / max) * 100}%`, background: TONE_COLOR[b.tone] || '#cbd5e1' }} />
        })}
      </div>
      <div className="row tiny muted mt-4" style={{ justifyContent: 'space-between' }}>
        {bands.map((b) => <span key={b.key}>{b.label} {b.min}%+</span>)}
      </div>
    </div>
  )
}

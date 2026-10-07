import { useState } from 'react'
import { ChevronRight, ChevronDown, Target, Building2, UsersRound, User, Gauge } from 'lucide-react'
import { useStore } from '../store'
import { Avatar, Progress, navigate, toneFor, ScoreDot } from './ui'
import { byId, childAllocations, nodeStats, unitName } from '../lib/calc'
import { fmtPct, fmtShortDate, round, sum } from '../lib/utils'
import { valueLabel } from './KpiWidgets'

const LVL_ICON = { organization: Target, department: Building2, team: UsersRound, individual: User }
const LVL_LABEL = { department: 'Department', team: 'Team', individual: 'Person' }

/** Open/closed state for hierarchy rows; `defaults(id)` says whether a row starts open. */
export function useOpenState(defaults) {
  const [open, setOpen] = useState({})
  const isOpen = (id) => open[id] ?? defaults(id)
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !isOpen(id) }))
  const setAll = (ids, v) => setOpen((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, v])) }))
  return { isOpen, toggle, setAll }
}

export function Toggle({ open, onClick, disabled }) {
  if (disabled) return <span className="tree-toggle" style={{ visibility: 'hidden' }} />
  return (
    <button className="tree-toggle" onClick={(e) => { e.stopPropagation(); onClick() }} aria-label={open ? 'Collapse' : 'Expand'}>
      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
    </button>
  )
}

export function KpiIcon() {
  return <span className="lvl kpi"><Gauge size={14} /></span>
}

/**
 * Rows for a KPI's allocation hierarchy (department → team → person) in the current period.
 * Uses the shared 8-column layout: name | level | – | joined | share | achieved / target | progress | –
 */
export function AllocRows({ kpi, period, indent, state: st, maxLevel = 'individual' }) {
  const { state: s0 } = useStore()
  const state = st || s0
  const MAXR = { department: 2, team: 3, individual: 4 }[maxLevel] ?? 4
  const R = { department: 2, team: 3, individual: 4 }
  const { isOpen, toggle } = useOpenState(() => true)
  if (!period) return null
  const rows = []
  const walk = (parentId, depth) => {
    for (const a of childAllocations(state, period.id, parentId)) {
      if (R[a.level] > MAXR) continue
      const kids = childAllocations(state, period.id, a.id).filter((k) => R[k.level] <= MAXR)
      rows.push({ a, depth, kids })
      if (isOpen(a.id)) walk(a.id, depth + 1)
    }
  }
  walk(null, 0)
  if (!rows.length)
    return (
      <tr className="alloc-row">
        <td colSpan={8}><div className="small muted" style={{ paddingLeft: indent }}>Not shared with any department yet.</div></td>
      </tr>
    )
  return rows.map(({ a, depth, kids }) => {
    const stats = nodeStats(state, kpi, period, a)
    const person = a.level === 'individual' ? byId(state.staff, a.unitId) : null
    const Icon = LVL_ICON[a.level]
    const allocated = kpi.type === 'sum' && kids.length ? sum(kids.map((k) => k.percent || 0)) : null
    const late = a.joinedDate && a.joinedDate > period.startDate
    return (
      <tr key={a.id} className={`alloc-row lvl-${a.level}`} onClick={() => navigate(`/kpis/${kpi.id}`)}>
        <td>
          <div className="row gap-6" style={{ paddingLeft: indent + depth * 22 }}>
            <Toggle open={isOpen(a.id)} onClick={() => toggle(a.id)} disabled={!kids.length} />
            {person ? <Avatar name={person.name} size="sm" /> : <span className={`lvl ${a.level}`}><Icon size={13} /></span>}
            <div style={{ minWidth: 0 }}>
              <div className="semi small nowrap">{unitName(state, a)}</div>
              {allocated !== null && allocated < 99.99 && <div className="tiny" style={{ color: 'var(--amber)' }}>{round(100 - allocated, 2)}% not shared down</div>}
            </div>
          </div>
        </td>
        <td className="tiny muted">{LVL_LABEL[a.level]}</td>
        <td />
        <td className="tiny muted nowrap">{late ? `joined ${fmtShortDate(a.joinedDate)}` : ''}</td>
        <td className="right small mono nowrap">{kpi.type === 'sum' ? fmtPct(a.percent, 2) : <span className="muted">same</span>}</td>
        <td className="right small mono nowrap">{valueLabel(kpi, stats.current)} / {kpi.type === 'completion' ? '100%' : valueLabel(kpi, stats.target)}</td>
        <td><ScoreDot value={stats.progress} /></td>
        <td />
      </tr>
    )
  })
}

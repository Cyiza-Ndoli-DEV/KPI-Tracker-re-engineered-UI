// Tabs for a KPI (or a department / team share of it): the hierarchy, then one table per level below.
import { useState } from 'react'
import { GitBranch, Building2, UsersRound, User } from 'lucide-react'
import { Tabs, Empty, Avatar, Badge, Progress, toneFor, navigate, ScoreDot } from './ui'
import { valueLabel } from './KpiWidgets'
import { nodeFor, ancestors } from '../lib/hierarchy'
import { LEVEL_ICON, RoleBadge, nodeLink } from '../pages/Kpis'
import { fmtPct, fmtDate } from '../lib/utils'

const LEVEL_TABS = [
  ['department', 'Departments', Building2],
  ['team', 'Teams', UsersRound],
  ['individual', 'Individuals', User],
]

/** root = null for the organization KPI, or a department / team allocation. tree = the hierarchy view to show first. */
export default function LevelTabs({ state, kpi, period, root = null, tree, includeLeft = false }) {
  const [tab, setTab] = useState('tree')
  const below = state.allocations.filter((a) => a.periodId === period.id && (includeLeft || !a.leftDate) && (!root || ancestors(state, a).some((x) => x.id === root.id)))
  const levels = LEVEL_TABS.filter(([l]) => below.some((a) => a.level === l))
  const rows = tab === 'tree' ? [] : below.filter((a) => a.level === tab)
  return (
    <div>
      <div style={{ padding: '0 20px' }}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[{ key: 'tree', label: 'Hierarchy', icon: <GitBranch size={15} /> }, ...levels.map(([l, label, I]) => ({ key: l, label, icon: <I size={15} />, count: below.filter((a) => a.level === l).length }))]}
        />
      </div>
      {tab === 'tree' ? tree : <NodeTable state={state} kpi={kpi} rows={rows} showParent title={`${rows.length} ${LEVEL_TABS.find(([l]) => l === tab)[1].toLowerCase()} holding a share of ${kpi.name}`} />}
    </div>
  )
}

export function NodeTable({ state, kpi, rows, highlight, title, parentTarget, showParent = false }) {
  if (!rows.length) return <Empty title="Nothing below this KPI" />
  const isSum = kpi.type === 'sum'
  return (
    <div className="scroll-x">
      <div className="small muted" style={{ padding: '10px 20px 0' }}>{title}{isSum && parentTarget ? ` · sharing ${valueLabel(kpi, parentTarget)}` : ''}</div>
      <table className="table">
        <thead><tr><th>Owner</th>{showParent && <th>Part of</th>}<th>Level</th><th className="right">Share</th><th className="right">Target</th><th className="right">Achieved</th><th style={{ width: 90 }}>Progress</th><th className="right">Last result</th></tr></thead>
        <tbody>
          {rows.map((a) => {
            const cn = nodeFor(state, kpi, a)
            const I = LEVEL_ICON[cn.level]
            return (
              <tr key={a.id} className="clickable" style={a.id === highlight ? { background: 'var(--blue-50)' } : a.leftDate ? { opacity: 0.6 } : undefined} onClick={() => navigate(nodeLink(cn))}>
                <td><div className="row gap-6">{cn.owner.person ? <Avatar name={cn.owner.name} size="sm" /> : <span className={`lvl ${cn.level}`}><I size={13} /></span>}<div><div className="semi small">{cn.owner.name} {a.id === highlight && <Badge tone="blue">this</Badge>}{a.leftDate && <Badge tone="red">left {fmtDate(a.leftDate)}</Badge>}</div><div className="tiny muted">{cn.owner.sub}</div></div></div></td>
                {showParent && <td className="small">{cn.parentName}</td>}
                <td><RoleBadge node={cn} /></td>
                <td className="right mono small">{isSum ? fmtPct(a.percent, 2) : 'same'}</td>
                <td className="right mono small">{kpi.type === 'completion' ? 'Full' : valueLabel(kpi, a.leftDate && a.targetBeforeLeave ? a.targetBeforeLeave : cn.stats.target)}</td>
                <td className="right mono small bold">{valueLabel(kpi, cn.stats.current)}</td>
                <td>{a.leftDate ? <span className="tiny muted">closed</span> : <ScoreDot value={cn.stats.progress} />}</td>
                <td className="right tiny">{cn.lastUpdate ? fmtDate(cn.lastUpdate) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

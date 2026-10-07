import { useMemo, useState } from 'react'
import { Gauge, Search, Target, Wand2, Building2, UsersRound, User, ChevronRight, ChevronDown, X } from 'lucide-react'
import { useStore } from '../store'
import { Link, Empty, Progress, Avatar, Badge, navigate, toneFor, ScoreDot } from '../components/ui'
import { byId, cycleGoals, KPI_TYPES } from '../lib/calc'
import { fmtPct, fmtShortDate } from '../lib/utils'
import { valueLabel } from '../components/KpiWidgets'
import { kpiNodes, LEVELS, LEVEL_NAME } from '../lib/hierarchy'
import DepthControl, { RANK } from '../components/DepthControl'

export const LEVEL_ICON = { organization: Target, department: Building2, team: UsersRound, individual: User }

/** The level of a KPI (organization, department, team, individual) — shown wherever a KPI appears. */
export function RoleBadge({ node }) {
  return <span className={`lvl-badge ${node.level}`}>{LEVEL_NAME[node.level]}</span>
}

export const nodeLink = (n) => (n.alloc ? `/kpis/${n.kpi.id}/${n.alloc.id}` : `/kpis/${n.kpi.id}`)

export default function Kpis() {
  const { state } = useStore()
  const cycle = byId(state.cycles, state.viewCycleId)
  const goals = cycleGoals(state, cycle.id)
  const [q, setQ] = useState('')
  const [goalId, setGoalId] = useState('all')
  const [type, setType] = useState('all')
  const [level, setLevel] = useState('all')
  const [owner, setOwner] = useState('all')
  const [showLeft, setShowLeft] = useState(false)
  const [collapsed, setCollapsed] = useState({})
  const [depthTo, setDepthTo] = useState('individual')
  const isAdmin = state.role === 'admin'

  const all = useMemo(() => kpiNodes(state, cycle.id), [state, cycle.id])
  const base = all.filter((n) => (goalId === 'all' || n.goal.id === goalId) && (type === 'all' || n.kpi.type === type) && (showLeft || !n.alloc?.leftDate))
  const counts = Object.fromEntries(LEVELS.map((l) => [l, base.filter((n) => n.level === l).length]))

  // owner options: every unit / person that holds at least one KPI share, grouped by level
  const owners = LEVELS.slice(1).map((l) => ({
    level: l,
    list: [...new Map(base.filter((n) => n.level === l).map((n) => [n.owner.id, n.owner])).values()].sort((a, b) => a.name.localeCompare(b.name)),
  }))
  const ownerLevel = owner === 'all' ? null : owners.find((g) => g.list.some((o) => o.id === owner))?.level

  const s = q.trim().toLowerCase()
  const rows = base.filter((n) => (level === 'all' || n.level === level) && (owner === 'all' || (n.owner.id === owner && n.level === ownerLevel)) && (!s || `${n.kpi.name} ${n.owner.name} ${n.goal.name}`.toLowerCase().includes(s)))
  const treeMode = level === 'all' && owner === 'all' && !s
  // in tree mode hide everything under a collapsed node
  const visible = treeMode
    ? rows.filter((n) => {
        if (RANK[n.level] > RANK[depthTo]) return false
        if (!n.alloc) return true
        if (collapsed[`org-${n.kpi.id}`]) return false
        let p = n.parentAlloc
        while (p) {
          if (collapsed[p.id]) return false
          p = p.parentId ? byId(state.allocations, p.parentId) : null
        }
        return true
      })
    : rows
  const toggle = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))
  const clear = () => { setLevel('all'); setOwner('all'); setQ(''); setGoalId('all'); setType('all') }
  const filtered = level !== 'all' || owner !== 'all' || s || goalId !== 'all' || type !== 'all'
  const ownerObj = owner !== 'all' && owners.flatMap((g) => g.list).find((o) => o.id === owner)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>KPIs</h1>
          <div className="sub">Every KPI in {cycle.name} and every share of it, from the organization down to each person.</div>
        </div>
        <div className="spacer" />
        {isAdmin && cycle.status !== 'ended' && <Link to="/wizard" className="btn primary"><Wand2 size={16} /> Set up a goal with KPIs</Link>}
      </div>

      <div className="grid g-4 mb-16">
        {LEVELS.map((l) => {
          const Icon = LEVEL_ICON[l]
          const on = level === l
          return (
            <button key={l} className={`card stat level-card ${on ? 'on' : ''}`} onClick={() => { setLevel(on ? 'all' : l); setOwner('all') }}>
              <div className={`icon lvl-ic ${l}`}><Icon size={19} /></div>
              <div style={{ textAlign: 'left' }}>
                <div className="v">{counts[l]}</div>
                <div className="small semi">{l === 'organization' ? 'Organization KPIs' : `${LEVEL_NAME[l]} KPI shares`}</div>
                <div className="tiny muted">{l === 'organization' ? 'set once on the goal' : l === 'individual' ? 'where results are recorded' : 'shares of the level above'}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="row wrap table-toolbar">
          <div className="input-group" style={{ width: 230 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 32 }} placeholder="Search KPI, owner or goal" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label className="filter-field">Level
            <select className="select" value={level} onChange={(e) => { setLevel(e.target.value); setOwner('all') }}>
              <option value="all">All levels</option>
              {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_NAME[l]}</option>)}
            </select>
          </label>
          <label className="filter-field">Owner
            <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)} disabled={level === 'organization'}>
              <option value="all">{level === 'all' ? 'All owners' : level === 'organization' ? state.settings.orgName : level === 'individual' ? 'All people' : `All ${LEVEL_NAME[level].toLowerCase()}s`}</option>
              {owners.filter((g) => level === 'all' || g.level === level).map((g) => (
                <optgroup key={g.level} label={LEVEL_NAME[g.level] === 'Individual' ? 'People' : `${LEVEL_NAME[g.level]}s`}>
                  {g.list.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="filter-field">Goal
            <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="all">All goals</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="filter-field">Type
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types</option>
              {Object.entries(KPI_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </label>
          <label className="check small"><input type="checkbox" checked={showLeft} onChange={(e) => setShowLeft(e.target.checked)} /> Include people who left</label>
          <div className="spacer" />
          {filtered && <button className="btn ghost sm" onClick={clear}><X size={14} /> Clear filters</button>}
        </div>
        <div className="row small muted" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
          {treeMode && <><DepthControl value={depthTo} onChange={(v) => { setDepthTo(v); setCollapsed({}) }} levels={['organization', 'department', 'team', 'individual']} /><span className="spacer" /></>}
          {treeMode ? <>Showing the hierarchy: organization KPI → department → team → person. Click any row for its details.</> : <>{rows.length} KPI{rows.length === 1 ? '' : 's'}{ownerObj ? <> held by <b>{ownerObj.name}</b></> : level !== 'all' ? <> at <b>{LEVEL_NAME[level].toLowerCase()}</b> level</> : ''}. The <b>Hierarchy</b> column shows where each one sits.</>}
        </div>

        {visible.length === 0 ? (
          <Empty icon={<Gauge />} title="No KPIs match these filters" action={<button className="btn secondary" onClick={clear}>Clear filters</button>} />
        ) : (
          <table className="table kpi-nodes">
            <thead>
              <tr>
                <th>{treeMode ? 'KPI / owner' : 'KPI'}</th>
                {!treeMode && <th>Owner</th>}
                <th>Level</th>
                <th>{treeMode ? 'Goal' : 'Hierarchy (parent chain)'}</th>
                <th className="right">Share of parent</th>
                <th className="right">Target</th>
                <th className="right">Achieved</th>
                <th style={{ width: 90 }}>Progress</th>
                <th className="right">Last result</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((n) => {
                const Icon = LEVEL_ICON[n.level]
                const left = n.alloc?.leftDate
                const isCollapsed = collapsed[n.alloc ? n.alloc.id : `org-${n.kpi.id}`]
                const ownerCell = (
                  <div className="row gap-6">
                    {n.owner.person ? <Avatar name={n.owner.name} size="sm" /> : <span className={`lvl ${n.level}`}><Icon size={13} /></span>}
                    <div style={{ minWidth: 0 }}>
                      <div className="semi small nowrap">{n.owner.name}{left && <Badge tone="red">left {fmtShortDate(left)}</Badge>}</div>
                      <div className="tiny muted nowrap">{n.owner.sub}</div>
                    </div>
                  </div>
                )
                return (
                  <tr key={n.key} className={`clickable node-${n.level} ${left ? 'is-left' : ''}`} onClick={() => navigate(nodeLink(n))}>
                    <td>
                      {treeMode ? (
                        <div className="row gap-6" style={{ paddingLeft: n.depth * 24 }}>
                          {n.children.length ? (
                            <button className="tree-toggle" onClick={(e) => { e.stopPropagation(); toggle(n.alloc ? n.alloc.id : `org-${n.kpi.id}`) }}>{isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
                          ) : <span style={{ width: 22 }} />}
                          {n.alloc ? ownerCell : (
                            <div className="row gap-6">
                              <span className="lvl kpi"><Gauge size={14} /></span>
                              <div><div className="bold">{n.kpi.name}</div><div className="tiny muted">{KPI_TYPES[n.kpi.type].label} · contributes {n.kpi.weight}% to goal</div></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div><div className="semi">{n.kpi.name}</div><div className="tiny muted">{KPI_TYPES[n.kpi.type].label}</div></div>
                      )}
                    </td>
                    {!treeMode && <td>{n.alloc ? ownerCell : <span className="small semi">{state.settings.orgName}</span>}</td>}
                    <td><RoleBadge node={n} /></td>
                    <td className="tiny">
                      {treeMode ? (n.alloc ? '' : <Link to={`/goals/${n.goal.id}`} className="goal-chip" onClick={(e) => e.stopPropagation()}>{n.goal.name}</Link>) : (
                        <div className="path">
                          <Link to={`/goals/${n.goal.id}`} className="goal-chip" onClick={(e) => e.stopPropagation()}>{n.goal.name}</Link>
                          <div className="mt-4 muted">{[...n.path, n.alloc ? n.owner.name : null].filter(Boolean).map((p, i, arr) => <span key={i}>{i === arr.length - 1 ? <b style={{ color: 'var(--text)' }}>{p}</b> : p}{i < arr.length - 1 ? ' › ' : ''}</span>)}{!n.alloc && <b style={{ color: 'var(--text)' }}>{state.settings.orgName}</b>}</div>
                        </div>
                      )}
                    </td>
                    <td className="right small nowrap">{n.alloc ? (n.kpi.type === 'sum' ? <><b>{fmtPct(n.alloc.percent, 2)}</b><div className="tiny muted">of {n.parentName}</div></> : <span className="muted">same target</span>) : <span className="muted">—</span>}</td>
                    <td className="right mono small nowrap">{n.kpi.type === 'completion' ? 'Full' : valueLabel(n.kpi, left && n.alloc.targetBeforeLeave ? n.alloc.targetBeforeLeave : n.stats.target)}</td>
                    <td className="right mono small bold nowrap">{valueLabel(n.kpi, n.stats.current)}</td>
                    <td>{left ? <span className="tiny muted">closed</span> : <ScoreDot value={n.stats.progress} />}</td>
                    <td className="right tiny nowrap">{n.lastUpdate ? fmtShortDate(n.lastUpdate) : <span className="muted">—</span>}<div className="muted">{n.updates} result{n.updates === 1 ? '' : 's'}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="small muted mt-12">
        The organization KPI is set once on the goal; departments, teams and people hold shares of it. Progress always rolls up from the people at the bottom.
      </div>
    </div>
  )
}


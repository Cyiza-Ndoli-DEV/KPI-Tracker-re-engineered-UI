// Goal tracking: as KPI results come in, the goal progresses — over time, per KPI, and for every department, team and person.
import { useState } from 'react'
import { TrendingUp, Building2, UsersRound, User, Target } from 'lucide-react'
import { Tabs, Progress, Badge, Avatar, Empty, toneFor, navigate, ScoreDot } from './ui'
import { LineChart, valueLabel } from './KpiWidgets'
import { goalKpis, goalProgress, kpiProgress, currentPeriod, nodeStats, unitName, band, KPI_TYPES } from '../lib/calc'
import { ownerOf } from '../lib/hierarchy'
import { fmtPct, fmtDate, todayISO, minISO, sum } from '../lib/utils'

const LEVELS = [
  ['department', 'Departments', Building2],
  ['team', 'Teams', UsersRound],
  ['individual', 'People', User],
]

export default function GoalTracking({ state, goal }) {
  const [tab, setTab] = useState('department')
  const kpis = goalKpis(state, goal.id)
  const periods = kpis.map((k) => currentPeriod(state, k.id)).filter(Boolean)
  const end = minISO(todayISO(), goal.endDate)
  const kpiIds = new Set(kpis.map((k) => k.id))
  const dates = [...new Set(state.updates.filter((u) => kpiIds.has(u.kpiId) && u.date <= end).map((u) => u.date))].sort()
  const points = [{ date: goal.startDate, value: 0 }, ...dates.map((d) => ({ date: d, value: goalProgress(state, goal, d) }))]
  const now = goalProgress(state, goal)
  const last30 = goalProgress(state, goal, minISO(end, new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)))

  // goal progress for each unit = its KPI shares in this goal, weighted by each KPI's contribution to the goal
  const units = {}
  for (const k of kpis) {
    const p = currentPeriod(state, k.id)
    if (!p) continue
    for (const a of state.allocations.filter((x) => x.periodId === p.id && !x.leftDate)) {
      const key = `${a.level}:${a.unitId}`
      units[key] ??= { level: a.level, unitId: a.unitId, name: unitName(state, a), items: [] }
      units[key].items.push({ kpi: k, alloc: a, stats: nodeStats(state, k, p, a) })
    }
  }
  const rows = Object.values(units)
    .filter((u) => u.level === tab)
    .map((u) => {
      const w = sum(u.items.map((it) => it.kpi.weight || 0)) || 1
      return { ...u, score: sum(u.items.map((it) => it.stats.progress * (it.kpi.weight || 0))) / w, covers: sum(u.items.map((it) => it.kpi.weight || 0)) }
    })
    .sort((a, b) => b.score - a.score)

  return (
    <div className="card">
      <div className="card-head"><TrendingUp size={18} color="var(--blue-600)" /><h3>Goal tracking</h3><span className="small muted">every KPI result moves the goal: progress and achievement over time and at every level</span></div>
      <div className="card-body">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(260px,1fr)', alignItems: 'start' }}>
          <div>
            <div className="row small muted mb-8"><span className="spacer">Goal progress over time</span><span>{dates.length} result dates</span></div>
            <LineChart points={points} start={goal.startDate} end={goal.endDate} height={190} />
          </div>
          <div className="col gap-10">
            <div className="kv-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              <div><div className="k">Goal progress</div><div className="v" style={{ fontSize: 20, color: 'var(--blue-700)' }}>{fmtPct(now, 1)}</div></div>
              <div><div className="k">Last 30 days</div><div className="v" style={{ color: now - last30 > 0 ? 'var(--green)' : 'inherit' }}>{now - last30 >= 0 ? '+' : ''}{fmtPct(now - last30, 1)}</div></div>
              <div><div className="k">Band</div><div className="v"><Badge tone={band(state, now).tone}>{band(state, now).label}</Badge></div></div>
              <div><div className="k">Last result</div><div className="v">{dates.length ? fmtDate(dates[dates.length - 1]) : '—'}</div></div>
            </div>
            <div className="small semi mt-8">Achievement per KPI</div>
            {kpis.map((k) => {
              const kp = kpiProgress(state, k)
              return (
                <div key={k.id} className="row gap-10">
                  <ScoreDot value={kp.progress} />
                  <div className="spacer">
                  <div className="row small"><span className="spacer semi">{k.name}</span><span className="muted">{valueLabel(k, kp.current)} / {k.type === 'completion' ? '100%' : valueLabel(k, kp.target)}</span></div>
                  <div className="tiny muted">{fmtPct(kp.progress, 1)} achieved × contributes {k.weight}% = <b style={{ color: 'var(--text)' }}>+{fmtPct((kp.progress * k.weight) / 100, 1)}</b> to the goal</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <Tabs value={tab} onChange={setTab} tabs={LEVELS.map(([l, label, I]) => ({ key: l, label: `Goal progress by ${label.toLowerCase()}`, icon: <I size={15} />, count: Object.values(units).filter((u) => u.level === l).length }))} />
      </div>
      {rows.length === 0 ? (
        <Empty icon={<Target />} title="No one at this level holds a KPI of this goal yet" />
      ) : (
        <table className="table">
          <thead><tr><th>Owner</th><th>KPIs held</th><th className="right">Share of goal covered</th><th style={{ width: 90 }}>Goal progress</th><th>Band</th></tr></thead>
          <tbody>
            {rows.map((u) => {
              const o = ownerOf(state, u.level, u.unitId)
              const I = LEVELS.find(([l]) => l === u.level)[2]
              return (
                <tr key={u.unitId} className="clickable" onClick={() => navigate(`/kpis/${u.items[0].kpi.id}/${u.items[0].alloc.id}`)}>
                  <td><div className="row gap-6">{o.person ? <Avatar name={o.name} size="sm" /> : <span className={`lvl ${u.level}`}><I size={13} /></span>}<div><div className="semi small">{o.name}</div><div className="tiny muted">{o.sub}</div></div></div></td>
                  <td className="small">{u.items.map((it) => <div key={it.kpi.id}>{it.kpi.name} <span className="muted">{fmtPct(it.stats.progress, 0)}</span></div>)}</td>
                  <td className="right mono small">{u.covers}%<div className="tiny muted">{u.items.length} of {kpis.length} KPI{kpis.length > 1 ? 's' : ''}</div></td>
                  <td><ScoreDot value={u.score} /></td>
                  <td><Badge tone={band(state, u.score).tone}>{band(state, u.score).label}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="card-pad tiny muted" style={{ borderTop: '1px solid var(--border)' }}>
        Goal progress = Σ (KPI progress × the KPI's contribution to the goal). For a department, team or person it uses only the KPIs they hold. {KPI_TYPES[goal.type].label} goal · {periods.length} running KPI period{periods.length === 1 ? '' : 's'}.
      </div>
    </div>
  )
}

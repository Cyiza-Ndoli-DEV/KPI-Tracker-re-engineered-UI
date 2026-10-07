import { Fragment } from 'react'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { useStore } from '../store'
import { GoalStatus, Badge, Progress, navigate, toneFor, ScoreDot } from './ui'
import { goalKpis, goalProgress, kpiProgress, currentPeriod, KPI_TYPES } from '../lib/calc'
import { fmtRange, fmtPct } from '../lib/utils'
import { valueLabel } from './KpiWidgets'
import { AllocRows, KpiIcon, Toggle, useOpenState } from './Hierarchy'
import DepthControl, { RANK } from './DepthControl'
import { useState } from 'react'

/**
 * Organization goals as a table: each goal is tracked on its own (100%).
 * Expand a goal to see the KPIs attached to it, and a KPI to see who contributes (department → team → person).
 */
export default function GoalsTable({ goals, deep = true }) {
  const { state } = useStore()
  // goals start open (their KPIs visible); KPI hierarchies start closed
  const { isOpen, toggle, setAll } = useOpenState((id) => id.startsWith('g:'))
  const [depthTo, setDepthTo] = useState('kpi')
  const kpiIds = goals.flatMap((g) => goalKpis(state, g.id).map((k) => `k:${k.id}`))
  const goalIds = goals.map((g) => `g:${g.id}`)
  const showTo = (v) => {
    setDepthTo(v)
    setAll(goalIds, RANK[v] >= RANK.kpi)
    setAll(kpiIds, RANK[v] >= RANK.department)
  }
  const allOpen = deep && kpiIds.length > 0 && kpiIds.every(isOpen) && goalIds.every(isOpen)
  return (
    <>
      <div className="row table-toolbar">
        {deep ? <DepthControl value={depthTo} onChange={showTo} /> : <span className="small muted">Goal → KPIs</span>}
        <div className="spacer" />
        <button className="btn ghost sm" onClick={() => (allOpen ? setAll([...goalIds, ...kpiIds], false) : setAll([...goalIds, ...(deep ? kpiIds : [])], true))}>
          {allOpen ? <><ChevronsDownUp size={14} /> Collapse all</> : <><ChevronsUpDown size={14} /> Expand all</>}
        </button>
      </div>
      <table className="table goals-table">
        <thead>
          <tr>
            <th>Goal / KPI / contributor</th>
            <th>Type</th>
            <th>Status</th>
            <th>Period</th>
            <th className="right">Contribution / share</th>
            <th className="right">Achieved / target</th>
            <th style={{ width: 90 }}>Progress</th>
            <th className="right">Adds to goal</th>
          </tr>
        </thead>
        {goals.map((g, i) => {
          const p = goalProgress(state, g)
          const ks = goalKpis(state, g.id)
          const gOpen = isOpen(`g:${g.id}`)
          return (
            <tbody key={g.id} className="goal-group">
              <tr className="clickable goal-row" onClick={() => navigate(`/goals/${g.id}`)}>
                <td>
                  <div className="row gap-6">
                    <Toggle open={gOpen} onClick={() => toggle(`g:${g.id}`)} disabled={!ks.length} />
                    <span className="goal-no">{i + 1}</span>
                    <div className="bold">{g.name}</div>
                  </div>
                  {g.description && <div className="tiny muted" style={{ maxWidth: 380, marginLeft: 58 }}>{g.description}</div>}
                </td>
                <td><Badge tone="blue">{KPI_TYPES[g.type].label}</Badge></td>
                <td><GoalStatus status={g.status} /></td>
                <td className="small muted nowrap">{fmtRange(g.startDate, g.endDate)}</td>
                <td className="right"><span className="badge navy">100%</span></td>
                <td className="right small muted nowrap">{ks.length} KPI{ks.length === 1 ? '' : 's'}</td>
                <td><ScoreDot value={p} /></td>
                <td className="right small muted">goal total</td>
              </tr>
              {gOpen && ks.length === 0 && (
                <tr><td colSpan={8}><div className="small muted" style={{ paddingLeft: 58 }}>No KPIs attached to this goal yet.</div></td></tr>
              )}
              {gOpen &&
                ks.map((k) => {
                  const kp = kpiProgress(state, k)
                  const per = currentPeriod(state, k.id)
                  const kOpen = deep && isOpen(`k:${k.id}`)
                  return (
                    <Fragment key={k.id}>
                      <tr className="clickable kpi-row" onClick={() => navigate(`/kpis/${k.id}`)}>
                        <td>
                          <div className="row gap-6" style={{ paddingLeft: 26 }}>
                            <Toggle open={kOpen} onClick={() => toggle(`k:${k.id}`)} disabled={!deep} />
                            <KpiIcon />
                            <span className="semi">{k.name}</span>
                          </div>
                        </td>
                        <td className="small muted">KPI · {KPI_TYPES[k.type].label}</td>
                        <td />
                        <td className="tiny muted">{per ? <>{fmtRange(per.startDate, per.endDate)}<div>period {per.index}</div></> : '—'}</td>
                        <td className="right small nowrap"><b>{k.weight}%</b> <span className="muted">to goal</span></td>
                        <td className="right mono small nowrap">{valueLabel(k, kp.current)} / {k.type === 'completion' ? '100%' : valueLabel(k, kp.target)}</td>
                        <td><ScoreDot value={kp.progress} /></td>
                        <td className="right mono small bold">+{fmtPct((kp.progress * k.weight) / 100, 1)}</td>
                      </tr>
                      {kOpen && <AllocRows key={depthTo} kpi={k} period={per} indent={56} maxLevel={RANK[depthTo] > RANK.kpi ? depthTo : 'individual'} />}
                    </Fragment>
                  )
                })}
            </tbody>
          )
        })}
      </table>
    </>
  )
}

import { useMemo, useState } from 'react'
import { Trophy, Info } from 'lucide-react'
import { useStore } from '../store'
import { Field, Avatar, Badge, Empty, ScoreDot } from '../components/ui'
import { byId, cycleGoals, goalKpis, unitAllocations, personScore, band } from '../lib/calc'
import { fmtPct } from '../lib/utils'

/** Member ranking: KPI score, Org Fit score and final score. */
export default function Rankings({ embedded = false, deptFilter }) {
  const { state } = useStore()
  const cycle = byId(state.cycles, state.viewCycleId)
  const kpis = cycleGoals(state, cycle.id).flatMap((g) => goalKpis(state, g.id))
  const [kpiId, setKpiId] = useState('all')
  const [dept, setDept] = useState(deptFilter || 'all')
  const w = state.settings.scoring || { kpiWeight: 70, orgFitWeight: 30 }

  const rows = useMemo(() => {
    const filter = kpiId === 'all' ? {} : { kpiId }
    const out = []
    for (const p of state.staff) {
      if (p.active === false || !p.departmentId) continue
      if (dept !== 'all' && p.departmentId !== dept) continue
      let items = unitAllocations(state, 'individual', p.id, cycle.id)
      if (kpiId !== 'all') items = items.filter((it) => it.kpi.id === kpiId)
      const sc = personScore(state, p.id, cycle.id, filter)
      if (!items.length && !sc.isLead) continue
      if (sc.final === null) continue
      out.push({ p, ...sc, count: items.length })
    }
    return out.sort((a, b) => b.final - a.final)
  }, [state, cycle.id, kpiId, dept])

  return (
    <div className="col gap-20">
      {!embedded && (
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <h1>Rankings</h1>
            <div className="sub">{cycle.name} · staff ranked by final score (KPI score + Org Fit score).</div>
          </div>
        </div>
      )}

      <div className="card card-pad row wrap gap-16" style={{ alignItems: 'flex-end' }}>
        <Field label="KPI" style={{ minWidth: 260 }}>
          <select className="select" value={kpiId} onChange={(e) => setKpiId(e.target.value)}>
            <option value="all">All KPIs</option>
            {kpis.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </Field>
        <Field label="Department" style={{ minWidth: 200 }}>
          <select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">All departments</option>
            {state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <div className="spacer" />
        <div className="formula small">Final score = KPI score × {w.kpiWeight}% + Org Fit score × {w.orgFitWeight}%</div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><Empty icon={<Trophy />} title="Nobody to rank with these filters" /></div>
      ) : (
        <>
          <div className="grid g-3">
            {rows.slice(0, 3).map((r, i) => (
              <div key={r.p.id} className="card card-pad row gap-12" style={i === 0 ? { background: 'linear-gradient(135deg,#fffbeb,#fff)', borderColor: '#fde68a' } : undefined}>
                <span className={`medal m${i + 1}`}>{i + 1}</span>
                <Avatar name={r.p.name} size="lg" />
                <div className="spacer" style={{ minWidth: 0 }}>
                  <div className="bold">{r.p.name}</div>
                  <div className="tiny muted">{r.p.title} · {byId(state.departments, r.p.departmentId)?.name}</div>
                  <div className="tiny muted mt-4">KPI {fmtPct(r.kpiPart, 0)} · Org Fit {r.orgFit === null ? '—' : `${r.orgFit}%`}</div>
                </div>
                <ScoreDot value={r.final} size="lg" />
              </div>
            ))}
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Rank</th>
                  <th>Staff</th>
                  <th>Department / team</th>
                  <th className="right">KPIs</th>
                  <th className="center">KPI score</th>
                  <th className="center">Org Fit score</th>
                  <th className="center">Final score</th>
                  <th>Band</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const b = band(state, r.final)
                  return (
                    <tr key={r.p.id}>
                      <td><span className={`medal ${i < 3 ? `m${i + 1}` : ''}`}>{i + 1}</span></td>
                      <td><div className="row gap-6"><Avatar name={r.p.name} size="sm" /><div><div className="semi nowrap">{r.p.name} {r.isLead && <Badge tone="violet">team lead</Badge>}</div><div className="tiny muted">{r.p.title}</div></div></div></td>
                      <td className="small">{byId(state.departments, r.p.departmentId)?.name}{r.p.teamId ? ` · ${byId(state.teams, r.p.teamId).name}` : ''}</td>
                      <td className="right mono">{r.count}</td>
                      <td className="center"><ScoreDot value={r.kpiPart} title={r.isLead ? `Average of ${r.members} team members` : 'Average of own KPIs'} />{r.isLead && <div className="tiny muted">team avg</div>}</td>
                      <td className="center">{r.orgFit === null ? <span className="tiny muted">—</span> : <ScoreDot value={r.orgFit} muted />}</td>
                      <td className="center"><ScoreDot value={r.final} size="lg" /></td>
                      <td><Badge tone={b.tone}>{b.label}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="small muted row gap-6"><Info size={14} /> KPI score = the average of the person's KPI achievements (a team lead: the average of their team members' KPI scores). Org Fit score comes from supervisor and peer ratings.</div>
        </>
      )}
    </div>
  )
}

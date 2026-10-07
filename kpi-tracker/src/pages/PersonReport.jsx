// Individual performance report: one person's KPIs, how they performed, and how often they update.
import { useState } from 'react'
import { Download, ListChecks, LineChart as LineIcon, Users, Gauge, CalendarClock, LifeBuoy } from 'lucide-react'
import { useStore } from '../store'
import { BackLink, Badge, Avatar, Ring, Progress, Empty, Link, Seg, toneFor, useFeedback, navigate, ScoreDot } from '../components/ui'
import { valueLabel, LineChart } from '../components/KpiWidgets'
import CountChart from '../components/CountChart'
import { byId, band, progressSeries, teamMembersOf, personScore, KPI_TYPES } from '../lib/calc'
import { personReport, reportDefaultAsOf } from '../lib/reports'
import { exportPersonReport } from '../lib/reportExports'
import { fmtPct, fmtDate, fmtShortDate, round, todayISO } from '../lib/utils'

export default function PersonReport({ id }) {
  const { state } = useStore()
  const { toast } = useFeedback()
  const person = byId(state.staff, id)
  const cycle = byId(state.cycles, state.viewCycleId)
  const asOf = reportDefaultAsOf(cycle, todayISO())
  const [kpiSel, setKpiSel] = useState('')
  const [freqBy, setFreqBy] = useState('week')
  if (!person) return <Empty title="Person not found" action={<Link to="/reports?tab=individuals" className="btn primary">Back to reports</Link>} />

  const rep = personReport(state, cycle, id, asOf)
  const sc = rep.score
  const b = sc.final === null ? null : band(state, sc.final)
  const pip = sc.final !== null && sc.final < (state.settings.pipBelow ?? 50)
  const sel = rep.items.find((it) => it.alloc.id === kpiSel) || rep.items[0]
  const allUps = rep.items.flatMap((it) => it.updates)
  const lastAll = allUps.map((u) => u.date).sort().slice(-1)[0]
  const members = sc.isLead ? teamMembersOf(state, id, cycle.id) : []
  // update frequency points (per day or week)
  const freq = {}
  for (const u of allUps) {
    let k = u.date
    if (freqBy === 'week') {
      const dt = new Date(`${u.date}T00:00:00`)
      dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
      k = dt.toISOString().slice(0, 10)
    }
    freq[k] = (freq[k] || 0) + 1
  }
  const freqPoints = Object.entries(freq).sort(([a], [c]) => a.localeCompare(c)).map(([date, count]) => ({ date, count }))
  const gaps = rep.items.map((it) => it.avgGap).filter((x) => x !== null)

  return (
    <div className="col gap-16">
      <div>
        <BackLink to="/reports?tab=individuals" label="Reports · Individuals" />
        <div className="card card-pad">
          <div className="row top wrap gap-20">
            <Ring value={sc.final ?? 0} size={76} stroke={7} sub="final score" />
            <div style={{ flex: 1, minWidth: 320 }}>
              <div className="row wrap gap-6 mb-8">
                <Badge tone="blue">Individual performance report</Badge>
                {sc.isLead && <Badge tone="violet">Team lead</Badge>}
                {b && <Badge tone={b.tone}>{b.label}</Badge>}
                {pip && <Badge tone="red"><LifeBuoy size={11} /> Available for PIP</Badge>}
              </div>
              <div className="row gap-10">
                <Avatar name={person.name} />
                <div><h1 style={{ fontSize: 22 }}>{person.name}</h1><div className="small muted">{person.title} · {byId(state.departments, person.departmentId)?.name}{person.teamId ? ` · ${byId(state.teams, person.teamId)?.name}` : ' · no team'} · {cycle.name}, as of {fmtDate(asOf)}</div></div>
              </div>
              <div className="kv-grid mt-16">
                <div><div className="k">{sc.isLead ? "KPI part (team members' average)" : 'KPI score (average)'}</div><div className="v">{fmtPct(sc.kpiPart, 1)}</div></div>
                {sc.isLead && <div><div className="k">Own KPIs average</div><div className="v">{fmtPct(sc.own, 1)}</div></div>}
                <div><div className="k">Org Fit score</div><div className="v">{sc.orgFit === null ? 'pending' : `${sc.orgFit}%`}</div></div>
                <div><div className="k">Final score</div><div className="v" style={{ color: 'var(--blue-700)' }}>{fmtPct(sc.final, 1)}</div></div>
                <div><div className="k">KPIs held</div><div className="v">{rep.items.length}</div></div>
                <div><div className="k">Results recorded</div><div className="v">{allUps.length}</div></div>
                <div><div className="k">Last result</div><div className="v">{lastAll ? fmtDate(lastAll) : 'never'}</div></div>
                <div><div className="k">Updates every</div><div className="v">{gaps.length ? `${round(gaps.reduce((a, c) => a + c, 0) / gaps.length, 0)} days on average` : '—'}</div></div>
              </div>
              <div className="tiny muted mt-8">Final = {sc.isLead ? "team members' KPI average" : 'KPI average'} × {sc.weights.kpiWeight}% + Org Fit × {sc.weights.orgFitWeight}%</div>
            </div>
            <button className="btn primary" onClick={() => { exportPersonReport(state, cycle, person, asOf); toast(`Report for ${person.name} exported.`) }}><Download size={16} /> Export report</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><Gauge size={18} color="var(--blue-600)" /><h3>KPIs and how they performed</h3><span className="small muted">weakest first</span></div>
        {rep.items.length === 0 ? <Empty title={`${person.name} holds no KPI in ${cycle.name}`} /> : (
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Goal → KPI</th><th className="right">Target</th><th className="right">Actual</th><th>Achieved</th><th className="right">Results</th><th className="right">Updates every</th><th className="right">Last result</th></tr></thead>
              <tbody>
                {[...rep.items].sort((a, c) => a.stats.progress - c.stats.progress).map((it, i) => (
                  <tr key={it.alloc.id} className="clickable" onClick={() => navigate(`/kpis/${it.kpi.id}/${it.alloc.id}`)}>
                    <td><div className="tiny muted">{it.goal.name}</div><div className="semi small">{it.kpi.name} <span className="tiny muted">· {KPI_TYPES[it.kpi.type].label}</span> {i === 0 && rep.items.length > 1 && <Badge tone="red">weakest</Badge>}</div></td>
                    <td className="right mono small">{it.kpi.type === 'completion' ? 'Full' : valueLabel(it.kpi, it.stats.target)}</td>
                    <td className="right mono small bold">{valueLabel(it.kpi, it.stats.current)}</td>
                    <td><ScoreDot value={it.stats.progress} /></td>
                    <td className="right mono small">{it.count}</td>
                    <td className="right small">{it.avgGap === null ? '—' : `${round(it.avgGap, 0)} days`}</td>
                    <td className="right small">{it.last ? fmtShortDate(it.last) : <span className="badge red">never</span>}{it.since !== null && it.since > (state.settings.staleDays ?? 30) && <div><span className="badge amber" style={{ padding: '0 6px' }}>{it.since}d ago</span></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rep.items.length > 0 && (
        <div className="grid g-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-head wrap"><LineIcon size={18} color="var(--blue-600)" /><h3>Progress over time</h3><div className="spacer" />
              <select className="select sm" style={{ width: 'auto' }} value={sel.alloc.id} onChange={(e) => setKpiSel(e.target.value)}>{rep.items.map((it) => <option key={it.alloc.id} value={it.alloc.id}>{it.kpi.name}</option>)}</select>
            </div>
            <div className="card-body"><LineChart points={progressSeries(state, sel.kpi, sel.period, sel.alloc)} start={sel.period.startDate} end={sel.period.endDate} height={200} /></div>
          </div>
          <div className="card">
            <div className="card-head wrap"><CalendarClock size={18} color="var(--blue-600)" /><h3>Update frequency</h3><div className="spacer" /><Seg value={freqBy} onChange={setFreqBy} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} /></div>
            <div className="card-body"><CountChart points={freqPoints} start={cycle.startDate} end={asOf} label="results" /></div>
          </div>
        </div>
      )}

      {sc.isLead && (
        <div className="card">
          <div className="card-head"><Users size={18} color="var(--blue-600)" /><h3>Team members (make up {person.name.split(' ')[0]}'s KPI part)</h3></div>
          <table className="table">
            <thead><tr><th>Member</th><th className="right">KPI score (average)</th><th className="right">Org Fit</th><th className="right">Final</th><th /></tr></thead>
            <tbody>
              {members.map((m) => {
                const ms = personScore(state, m.id, cycle.id)
                return (
                  <tr key={m.id} className="clickable" onClick={() => navigate(`/reports/person/${m.id}`)}>
                    <td><div className="row gap-6"><Avatar name={m.name} size="sm" /><div><div className="semi small">{m.name}</div><div className="tiny muted">{m.title}</div></div></div></td>
                    <td className="right mono small">{fmtPct(ms.own, 1)}</td>
                    <td className="right mono small">{ms.orgFit === null ? '—' : `${ms.orgFit}%`}</td>
                    <td className="right mono small bold">{fmtPct(ms.final, 1)}</td>
                    <td className="right"><span className="tiny muted">report →</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-head"><ListChecks size={18} color="var(--blue-600)" /><h3>Performance records</h3><span className="small muted">every result entered, newest first</span></div>
        {rep.records.length === 0 ? <Empty title="No results recorded yet" /> : (
          <div className="scroll-x">
            <table className="table compact">
              <thead><tr><th>Result date</th><th>KPI</th><th className="right">Entered</th><th className="right">Running total / value</th><th>Submitted</th><th>Edited</th></tr></thead>
              <tbody>
                {rep.records.map((r) => (
                  <tr key={r.u.id}>
                    <td className="small nowrap">{fmtDate(r.u.date)}</td>
                    <td className="small">{r.kpi.name}</td>
                    <td className="right mono small">{r.kpi.type === 'completion' ? (r.u.completion === 'full' ? 'Fully achieved' : r.u.completion === 'none' ? 'Not achieved' : `Partially ${r.u.value}%`) : `${r.kpi.type === 'sum' ? '+' : ''}${valueLabel(r.kpi, r.u.value)}`}</td>
                    <td className="right mono small bold">{valueLabel(r.kpi, r.total)}</td>
                    <td className="small muted nowrap">{fmtDate(r.u.submittedAt.slice(0, 10))}</td>
                    <td className="small">{r.u.editedAt ? <Badge tone="violet">edited {fmtShortDate(r.u.editedAt.slice(0, 10))}</Badge> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

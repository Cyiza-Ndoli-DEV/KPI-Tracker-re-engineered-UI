import { useState } from 'react'
import { PencilLine, UserCheck, Building2, UsersRound, ArrowRight, CalendarClock } from 'lucide-react'
import { useStore, useCurrentUser } from '../store'
import { Ring, Progress, Badge, Empty, Link, Avatar, toneFor, ScoreDot } from '../components/ui'
import { UpdateModal, valueLabel } from '../components/KpiWidgets'
import { UpdateTable, RequestEditModal } from './KpiDetail'
import { byId, updateBlock, unitAllocations, nodeStats, weightedScore, personScore, allocationUpdates, band, KPI_TYPES, unitName } from '../lib/calc'
import { fmtRange, fmtPct, fmtDate } from '../lib/utils'

export default function MyKpis() {
  const { state } = useStore()
  const user = useCurrentUser()
  const cycle = byId(state.cycles, state.viewCycleId)
  const items = unitAllocations(state, 'individual', user.id, cycle.id)
  const ps = personScore(state, user.id, cycle.id)
  const score = ps.final
  const [updating, setUpdating] = useState(null)
  const [requesting, setRequesting] = useState(null)
  const isAdmin = state.role === 'admin'

  const led = [
    ...state.departments.filter((d) => d.headId === user.id).flatMap((d) => unitAllocations(state, 'department', d.id, cycle.id)),
    ...state.teams.filter((t) => t.leadId === user.id).flatMap((t) => unitAllocations(state, 'team', t.id, cycle.id)),
  ]
  const myUpdates = state.updates
    .filter((u) => items.some((it) => it.alloc.id === u.allocationId))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="col gap-20">
      <div className="card card-pad row wrap gap-20">
        <Avatar name={user.name} size="lg" />
        <div style={{ flex: 1 }}>
          <h1>My KPIs</h1>
          <div className="muted">{user.name} · {user.title}{user.departmentId ? ` · ${byId(state.departments, user.departmentId).name}` : ''}{user.teamId ? ` · ${byId(state.teams, user.teamId).name}` : ''}</div>
          <div className="small muted mt-4">No weekly or monthly schedule — update whenever you have a new result. Progress rolls up to your team, department and {state.settings.orgName} immediately.</div>
        </div>
        {score !== null && (
          <div className="row gap-12">
            <Ring value={ps.final} size={72} stroke={7} sub="final score" />
            <div className="col gap-4">
              <Badge tone={band(state, ps.final).tone}>{band(state, ps.final).label}</Badge>
              <div className="tiny muted">{ps.isLead ? `Team members' average ${fmtPct(ps.kpiPart, 1)}` : `KPI average ${fmtPct(ps.kpiPart, 1)}`} · Org Fit {ps.orgFit === null ? 'pending' : `${ps.orgFit}%`}</div>
            </div>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card">
          <Empty icon={<UserCheck />} title="No KPIs allocated to you in this cycle">
            {isAdmin ? 'Switch View as to an Employee (Sarah Nakato or Ronald Kintu) or the Team Lead to see this view with data.' : 'When a KPI is shared with you, it appears here with an Update button.'}
          </Empty>
        </div>
      ) : (
        <div className="grid g-2">
          {items.map((it) => {
            const s = nodeStats(state, it.kpi, it.period, it.alloc)
            const ups = allocationUpdates(state, it.alloc.id)
            const last = ups[ups.length - 1]
            const block = updateBlock(state, it.alloc)
            const live = !block
            const parent = it.alloc.parentId && byId(state.allocations, it.alloc.parentId)
            return (
              <div key={it.alloc.id} className="card">
                <div className="goal-card-top" />
                <div className="card-pad">
                  <div className="row top">
                    <div style={{ flex: 1 }}>
                      <div className="tiny muted">{it.goal.name} · contributes to {parent ? unitName(state, parent) : state.settings.orgName}</div>
                      <h3 style={{ fontSize: 16, marginTop: 2 }}>{it.kpi.name}</h3>
                      <div className="row gap-6 mt-8">
                        <Badge tone="blue">{KPI_TYPES[it.kpi.type].label}</Badge>
                        {it.kpi.type === 'sum' && <Badge>{fmtPct(it.alloc.percent, 2)} of {parent ? unitName(state, parent) : 'org'}</Badge>}
                        {it.alloc.joinedDate > it.period.startDate && <Badge tone="violet">joined {fmtDate(it.alloc.joinedDate)}</Badge>}
                      </div>
                    </div>
                    <ScoreDot value={s.progress} size="lg" />
                  </div>
                  <div className="grid g-3 mt-16">
                    <div><div className="tiny muted">My target</div><div className="bold">{it.kpi.type === 'completion' ? 'Fully achieved' : valueLabel(it.kpi, s.target)}</div></div>
                    <div><div className="tiny muted">Achieved</div><div className="bold">{s.hasData || it.kpi.type === 'sum' ? valueLabel(it.kpi, s.current) : '—'}</div></div>
                    <div><div className="tiny muted">Last update</div><div className="bold">{last ? fmtDate(last.date) : '—'}</div></div>
                  </div>
                  <div className="row mt-16">
                    <span className="small muted row gap-4"><CalendarClock size={13} /> {fmtRange(it.alloc.startDate, it.alloc.endDate)}</span>
                    <div className="spacer" />
                    <Link to={`/kpis/${it.kpi.id}/${it.alloc.id}`} className="btn ghost sm">Details</Link>
                    <button className="btn primary sm" disabled={!live} title={block || ''} onClick={() => setUpdating({ alloc: it.alloc })}><PencilLine size={14} /> Update</button>
                  </div>
                  {block && <div className="tiny update-block mt-8">{block}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {led.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Units you lead</h3><span className="small muted">progress is calculated from your members' results</span></div>
          <table className="table">
            <thead><tr><th>Unit</th><th>KPI</th><th className="right">Achieved / target</th><th style={{ width: 90 }}>Progress</th><th /></tr></thead>
            <tbody>
              {led.map((it) => {
                const s = nodeStats(state, it.kpi, it.period, it.alloc)
                return (
                  <tr key={it.alloc.id}>
                    <td><div className="row gap-6"><span className={`lvl ${it.alloc.level}`}>{it.alloc.level === 'team' ? <UsersRound size={13} /> : <Building2 size={13} />}</span><b>{unitName(state, it.alloc)}</b></div></td>
                    <td className="small">{it.kpi.name}<div className="tiny muted">{it.goal.name}</div></td>
                    <td className="right mono small">{valueLabel(it.kpi, s.current)} / {it.kpi.type === 'completion' ? '100%' : valueLabel(it.kpi, s.target)}</td>
                    <td><ScoreDot value={s.progress} /></td>
                    <td className="right"><Link to={`/kpis/${it.kpi.id}/${it.alloc.id}`} className="btn ghost sm">Open <ArrowRight size={13} /></Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>My update history</h3><span className="small muted">Updates can be edited for {state.settings.editWindowDays} days, then they lock</span></div>
          <UpdateTable state={state} updates={myUpdates} user={user} isAdmin={false} live showKpi onEdit={(u) => setUpdating({ alloc: byId(state.allocations, u.allocationId), update: u })} onRequest={setRequesting} />
        </div>
      )}

      {updating && <UpdateModal alloc={updating.alloc} update={updating.update} onClose={() => setUpdating(null)} />}
      {requesting && <RequestEditModal update={requesting} onClose={() => setRequesting(null)} />}
    </div>
  )
}

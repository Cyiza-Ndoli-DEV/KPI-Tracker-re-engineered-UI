import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { currentUserId, useStore } from '../store'
import { Field, Avatar, Badge, Empty, PctBar, ScoreTile, SearchField } from '../components/ui'
import { byId, unitAllocations, personScore, band } from '../lib/calc'
import { fmtPct } from '../lib/utils'

/** Member ranking: KPI score, Org Fit score and final score. */
export default function Rankings({ deptFilter = 'all', onDepartmentChange, reportFilter = {}, asOf }) {
  const { state } = useStore()
  const cycle = byId(state.cycles, state.viewCycleId)
  const [teamId, setTeamId] = useState('all')
  const [memberId, setMemberId] = useState('all')
  const [search, setSearch] = useState('')
  const viewerId = currentUserId(state)
  const departmentIds = new Set(state.departments.filter((d) => d.headId === viewerId).map((d) => d.id))
  const ledTeamIds = new Set(state.teams.filter((t) => t.leadId === viewerId).map((t) => t.id))
  const rankingDepartments = state.departments.filter((department) =>
    state.role === 'admin' || (state.role === 'dept_head' && departmentIds.has(department.id)) ||
    (state.role === 'team_lead' && state.teams.some((team) => team.departmentId === department.id && ledTeamIds.has(team.id))))
  const teams = state.teams.filter((team) =>
    (deptFilter === 'all' || team.departmentId === deptFilter) &&
    (state.role !== 'dept_head' || departmentIds.has(team.departmentId)) &&
    (state.role !== 'team_lead' || ledTeamIds.has(team.id)))
  const selectedTeam = teams.some((team) => team.id === teamId) ? teamId : 'all'
  const members = state.staff.filter((p) => {
    if (p.active === false) return false
    if (!p.departmentId || (deptFilter !== 'all' && p.departmentId !== deptFilter)) return false
    if (state.role === 'dept_head' && !departmentIds.has(p.departmentId)) return false
    if (state.role === 'team_lead' && !ledTeamIds.has(p.teamId)) return false
    return selectedTeam === 'all' || p.teamId === selectedTeam
  }).sort((a, b) => a.name.localeCompare(b.name))
  const selectedMember = members.some((p) => p.id === memberId) ? memberId : 'all'

  const rows = (() => {
    const filter = reportFilter
    const term = search.trim().toLowerCase()
    const out = []
    for (const p of members) {
      const items = unitAllocations(state, 'individual', p.id, cycle.id).filter((it) =>
        (!filter.goalId || it.goal.id === filter.goalId) && (!filter.kpiId || it.kpi.id === filter.kpiId))
      const sc = personScore(state, p.id, cycle.id, filter, asOf)
      if ((filter.goalId || filter.kpiId) && !items.length && !sc.isLead) continue
      out.push({ p, ...sc, count: items.length })
    }
    return out.sort((a, b) => b.final - a.final)
      .map((row, index) => ({ ...row, rank: index + 1 }))
      .filter(({ p }) => (selectedMember === 'all' || p.id === selectedMember) &&
        [p.name, p.title].some((value) => value?.toLowerCase().includes(term)))
  })()

  return (
    <div className="col gap-20">
      <div className="card ranking-filters no-print" role="group" aria-label="Ranking filters">
        {onDepartmentChange && <Field label="Department" htmlFor="ranking-department">
          <select id="ranking-department" className="select"
            value={state.role !== 'admin' && rankingDepartments.length === 1 ? rankingDepartments[0].id : deptFilter}
            disabled={state.role !== 'admin' && rankingDepartments.length <= 1}
            onChange={(e) => onDepartmentChange(e.target.value)}>
            {(state.role === 'admin' || rankingDepartments.length !== 1) && <option value="all">{rankingDepartments.length ? 'All departments' : 'No departments'}</option>}
            {rankingDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>}
        <Field label="Team" htmlFor="ranking-team">
          <select id="ranking-team" className="select" value={selectedTeam} onChange={(e) => { setTeamId(e.target.value); setMemberId('all') }}>
            <option value="all">All teams</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </Field>
        <Field label="Member" htmlFor="ranking-member">
          <select id="ranking-member" className="select" value={selectedMember} onChange={(e) => setMemberId(e.target.value)}>
            <option value="all">All members</option>
            {members.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <SearchField label="Search members" value={search} onChange={setSearch} />
      </div>

      {rows.length === 0 ? (
        <div className="card"><Empty icon={<Trophy />} title="No members match these filters" /></div>
      ) : (
        <>
          <div className="grid g-3">
            {rows.filter((r) => r.rank <= 3).map((r) => (
              <div key={r.p.id} className="card card-pad row gap-12" style={r.rank === 1 ? { background: 'linear-gradient(135deg,#fffbeb,#fff)', borderColor: '#fde68a' } : undefined}>
                <span className={`medal m${r.rank}`}>{r.rank}</span>
                <Avatar name={r.p.name} size="lg" />
                <div className="spacer" style={{ minWidth: 0 }}>
                  <div className="bold">{r.p.name}</div>
                  <div className="tiny muted">{r.p.title} ? {byId(state.departments, r.p.departmentId)?.name}</div>
                  <div className="tiny muted mt-4">KPI {fmtPct(r.kpiPart, 0)} · Org Fit {r.orgFit === null ? '—' : `${r.orgFit}%`}</div>
                </div>
                <ScoreTile value={r.final} label="final score" width={90} />
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
                  <th>KPI score</th>
                  <th>Org Fit score</th>
                  <th>Final score</th>
                  <th>Band</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = band(state, r.final)
                  return (
                    <tr key={r.p.id}>
                      <td><span className={`medal ${r.rank <= 3 ? `m${r.rank}` : ''}`}>{r.rank}</span></td>
                      <td><div className="row gap-6"><Avatar name={r.p.name} size="sm" /><div><div className="semi nowrap">{r.p.name} {r.isLead && <Badge tone="violet">team lead</Badge>}</div><div className="tiny muted">{r.p.title}</div></div></div></td>
                      <td className="small">{byId(state.departments, r.p.departmentId)?.name}{r.p.teamId ? ` · ${byId(state.teams, r.p.teamId)?.name}` : ''}</td>
                      <td className="right mono">{r.count}</td>
                      <td><PctBar value={r.kpiPart} width={70} title={r.isLead ? `Average of ${r.members} team members` : 'Average of own KPIs'} />{r.isLead && <div className="tiny muted">team avg</div>}</td>
                      <td>{r.orgFit === null ? <span className="tiny muted">—</span> : <PctBar value={r.orgFit} width={70} muted />}</td>
                      <td><PctBar value={r.final} width={90} /></td>
                      <td><Badge tone={b.tone}>{b.label}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

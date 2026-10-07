// Excel exports for Reports: full report, one team, one person.
import * as XLSX from 'xlsx'
import { byId, cycleGoals, goalProgress, KPI_TYPES } from './calc'
import { levelRows, personReport } from './reports'
import { round } from './utils'

const sheet = (wb, name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No data' }]), name.slice(0, 31))
const pct = (v) => (v === null || v === undefined ? '' : round(v, 1))

const personRow = (r, i) => ({
  Rank: i + 1,
  Person: r.name,
  Title: r.unit.title,
  Department: r.dept?.name || '',
  Team: r.team?.name || '',
  'Team lead': r.isLead ? 'Yes' : '',
  'KPI score % (average)': pct(r.kpiScore),
  'Org Fit %': r.orgFit ?? 'pending',
  'Final score %': pct(r.score),
  Band: r.band.label,
  'Weakest KPI': r.worst ? `${r.worst.kpi.name} (${round(r.worst.stats.progress, 0)}%)` : '',
  Results: r.updates,
  'Last result': r.lastUpdate || 'never',
  'Not updated': r.stale ? 'Yes' : '',
})

const kpiLines = (rows) =>
  rows.flatMap((r) =>
    r.items.map((it) => ({
      Member: r.name,
      Goal: it.goal.name,
      KPI: it.kpi.name,
      Type: KPI_TYPES[it.kpi.type].label,
      Unit: it.kpi.type === 'completion' ? '%' : it.kpi.unit,
      'Share %': it.kpi.type === 'sum' ? round(it.alloc.percent, 2) : 'same',
      Target: it.kpi.type === 'completion' ? 100 : round(it.stats.target, 2),
      Actual: round(it.stats.current, 2),
      'Achieved %': round(it.stats.progress, 1),
    })),
  )

/** Full team report: summary per member + one line per member per KPI (target vs actual). */
export function exportTeamReport(state, cycle, team, asOf, filter = {}) {
  const members = levelRows(state, cycle, 'individual', asOf, 'all', filter).filter((r) => r.unit.teamId === team.id || r.items.some((it) => it.alloc.parentId && byId(state.allocations, it.alloc.parentId)?.unitId === team.id))
  const teamRow = levelRows(state, cycle, 'team', asOf, 'all', filter).find((r) => r.unit.id === team.id)
  const wb = XLSX.utils.book_new()
  sheet(wb, 'Team summary', [
    { Item: 'Team', Value: team.name },
    { Item: 'Department', Value: byId(state.departments, team.departmentId)?.name },
    { Item: 'Team lead', Value: byId(state.staff, team.leadId)?.name || '—' },
    { Item: 'Review cycle', Value: cycle.name },
    { Item: 'As of', Value: asOf },
    { Item: 'Team score %', Value: pct(teamRow?.score) },
    { Item: 'Band', Value: teamRow?.band.label || '' },
    { Item: 'Members with KPIs', Value: members.length },
  ])
  sheet(wb, 'Members', members.map(personRow))
  sheet(wb, 'Target vs actual', kpiLines(members))
  sheet(wb, 'Team KPIs', (teamRow?.items || []).map((it) => ({ Goal: it.goal.name, KPI: it.kpi.name, 'Team target': round(it.stats.target, 2), 'Team actual': round(it.stats.current, 2), 'Achieved %': round(it.stats.progress, 1) })))
  XLSX.writeFile(wb, `Team report ${team.name} ${cycle.name} ${asOf}.xlsx`)
}

/** One person's report: KPIs, results and update frequency. */
export function exportPersonReport(state, cycle, person, asOf) {
  const rep = personReport(state, cycle, person.id, asOf)
  const wb = XLSX.utils.book_new()
  const sc = rep.score
  sheet(wb, 'Summary', [
    { Item: 'Person', Value: person.name },
    { Item: 'Title', Value: person.title },
    { Item: 'Department', Value: byId(state.departments, person.departmentId)?.name },
    { Item: 'Team', Value: byId(state.teams, person.teamId)?.name || '—' },
    { Item: 'Review cycle', Value: cycle.name },
    { Item: 'As of', Value: asOf },
    { Item: sc.isLead ? 'KPI part % (team members average)' : 'KPI score % (average)', Value: pct(sc.kpiPart) },
    { Item: 'Own KPIs average %', Value: pct(sc.own) },
    { Item: 'Org Fit %', Value: sc.orgFit ?? 'pending' },
    { Item: 'Final score %', Value: pct(sc.final) },
  ])
  sheet(wb, 'KPIs', rep.items.map((it) => ({ Goal: it.goal.name, KPI: it.kpi.name, Type: KPI_TYPES[it.kpi.type].label, Target: it.kpi.type === 'completion' ? 100 : round(it.stats.target, 2), Actual: round(it.stats.current, 2), 'Achieved %': round(it.stats.progress, 1), Results: it.count, 'First result': it.first || '', 'Last result': it.last || '', 'Avg days between results': it.avgGap === null ? '' : round(it.avgGap, 1), 'Days since last': it.since ?? '' })))
  sheet(wb, 'Performance records', rep.records.map((r) => ({ Date: r.u.date, KPI: r.kpi.name, Entered: r.kpi.type === 'completion' ? `${r.u.completion} ${r.u.value}%` : r.u.value, 'Running total / value': r.total, Submitted: r.u.submittedAt.slice(0, 16).replace('T', ' '), Edited: r.u.editedAt ? r.u.editedAt.slice(0, 10) : '' })))
  XLSX.writeFile(wb, `Performance report ${person.name} ${cycle.name} ${asOf}.xlsx`)
}

/** The whole report as a workbook. */
export function exportFullReport(state, cycle, asOf, dept, filter, data) {
  const wb = XLSX.utils.book_new()
  const goals = cycleGoals(state, cycle.id).filter((g) => g.status !== 'draft')
  sheet(wb, 'Summary', [
    { Item: 'Organization', Value: state.settings.orgName },
    { Item: 'Review cycle', Value: cycle.name },
    { Item: 'As of', Value: asOf },
    { Item: 'Department', Value: dept === 'all' ? 'All' : byId(state.departments, dept)?.name },
    { Item: 'Goal filter', Value: filter.goalId ? byId(state.goals, filter.goalId)?.name : 'All' },
    { Item: 'KPI filter', Value: filter.kpiId ? byId(state.kpis, filter.kpiId)?.name : 'All' },
    ...goals.map((g) => ({ Item: `Goal: ${g.name}`, Value: `${round(goalProgress(state, g, asOf), 1)}%` })),
  ])
  const unit = (rows) => rows.map((r, i) => ({ Rank: i + 1, Name: r.name, Department: r.dept?.name || '', 'Head / lead': r.lead?.name || '', People: r.people, KPIs: r.items.length, 'Score %': pct(r.score), Band: r.band.label, 'Weakest KPI': r.worst ? `${r.worst.kpi.name} (${round(r.worst.stats.progress, 0)}%)` : '', Results: r.updates, 'Last result': r.lastUpdate || '' }))
  sheet(wb, 'Departments', unit(data.departments))
  sheet(wb, 'Teams', unit(data.teams))
  sheet(wb, 'Individuals', data.people.map(personRow))
  sheet(wb, 'Target vs actual', kpiLines(data.people))
  sheet(wb, 'Available for PIP', data.pip.map(personRow))
  sheet(wb, 'Not updated', data.stale.map((r) => ({ Person: r.name, Department: r.dept?.name, 'Last result': r.lastUpdate || 'never', 'Days since': r.since ?? '' })))
  sheet(wb, 'Without KPIs', data.unassigned.map((s) => ({ Person: s.name, Title: s.title, Department: byId(state.departments, s.departmentId)?.name, Team: byId(state.teams, s.teamId)?.name || '', Joined: s.joinedDate })))
  XLSX.writeFile(wb, `KPI report ${cycle.name} as of ${asOf}.xlsx`)
}

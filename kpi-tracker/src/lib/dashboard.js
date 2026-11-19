import { bandsOf, byId, cycleGoals, goalKpis, hasLeft, kpiPeriods, nodeStats, progressOf, unitName } from './calc'
import { daysBetween, maxISO, minISO, todayISO } from './utils'

const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function dashboardMonths(cycle) {
  if (!cycle) return []
  const today = todayISO()
  const end = today < cycle.startDate ? cycle.startDate : today < cycle.endDate ? today : cycle.endDate
  const cursor = new Date(cycle.startDate.slice(0, 7) + '-01T00:00:00Z')
  const months = []
  while (cursor.toISOString().slice(0, 7) <= end.slice(0, 7)) {
    const first = cursor.toISOString().slice(0, 10)
    const key = cursor.toISOString().slice(0, 7)
    const label = monthLabel.format(cursor)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    const last = new Date(cursor.getTime() - 86400000).toISOString().slice(0, 10)
    months.push({ key, label, short: label.slice(0, 3), start: maxISO(first, cycle.startDate), end: minISO(last, cycle.endDate), date: minISO(last, end) })
  }
  return months
}

export function dashboardData(state, cycle) {
  const goals = cycleGoals(state, cycle.id).filter((goal) => goal.status !== 'draft')
  const kpis = goals.flatMap((goal) => goalKpis(state, goal.id))
  const periods = new Map(kpis.map((kpi) => [kpi.id, kpiPeriods(state, kpi.id)]))
  const allocations = new Map()
  for (const alloc of state.allocations) {
    if (!allocations.has(alloc.periodId)) allocations.set(alloc.periodId, [])
    allocations.get(alloc.periodId).push(alloc)
  }

  function rows(date, level, ids = []) {
    return kpis.flatMap((kpi) => {
      const period = periods.get(kpi.id).findLast((p) => p.startDate <= date)
      if (!period) return []
      const nodes = level
        ? (allocations.get(period.id) || []).filter((a) => a.level === level && ids.includes(a.unitId) && !hasLeft(a, date) && (!a.joinedDate || a.joinedDate <= date))
        : [null]
      return nodes.map((alloc) => {
        const stats = nodeStats(state, kpi, period, alloc, date)
        const to = alloc ? '/kpis/' + kpi.id + '/' + alloc.id : '/kpis/' + kpi.id
        return { kpi, period, alloc, stats, to, id: alloc?.id || kpi.id }
      })
    })
  }

  function goalRows(orgRows) {
    return goals.map((goal) => ({
      ...goal,
      score: performance(orgRows.filter(({ kpi }) => kpi.goalId === goal.id)),
    }))
  }

  function monthRows(month, level, ids = []) {
    const monthState = { ...state, updates: state.updates.filter(({ date }) => date >= month.start && date <= month.date) }
    return kpis.flatMap((kpi) => periods.get(kpi.id)
      .filter((period) => period.startDate <= month.date && period.endDate >= month.start)
      .flatMap((period) => {
        const nodes = level
          ? (allocations.get(period.id) || []).filter((alloc) => alloc.level === level && ids.includes(alloc.unitId))
          : [null]
        return nodes.flatMap((alloc) => {
          const start = maxISO(period.startDate, alloc?.startDate || period.startDate, alloc?.joinedDate || period.startDate)
          const end = minISO(period.endDate, alloc?.endDate || period.endDate)
          const windowStart = maxISO(start, month.start)
          const windowEnd = minISO(end, month.end)
          if (windowStart > month.date || windowStart > windowEnd || hasLeft(alloc, windowStart)) return []
          const stats = nodeStats(monthState, kpi, period, alloc, minISO(windowEnd, month.date))
          const target = kpi.type === 'sum' ? stats.target * daysBetween(windowStart, windowEnd) / daysBetween(start, end) : stats.target
          const current = kpi.type === 'sum' || stats.hasData ? stats.current : null
          return [{ id: alloc?.id || period.id, kpi, scope: ids.length > 1 && alloc ? unitName(state, alloc) : null, stats: { current, target, progress: current == null ? null : progressOf(current, stats.start, target) } }]
        })
      }))
  }

  function revenueAt(kpi, date) {
    return periods.get(kpi.id)
      .filter((period) => period.startDate <= date)
      .reduce((total, period) => total + nodeStats(state, kpi, period, null, date).current, 0)
  }

  function status(score) {
    if (score === null) return 'Unassigned'
    const bands = bandsOf(state)
    if (score >= (bands.find((band) => band.key === 'meets')?.min ?? 70)) return 'On track'
    return score >= (bands.find((band) => band.key === 'needs')?.min ?? 50) ? 'At risk' : 'Behind'
  }

  return { rows, monthRows, goalRows, status, revenueAt }
}

export function performance(rows, weighted = true) {
  rows = rows.filter(({ stats }) => stats.progress != null)
  const weight = ({ kpi }) => weighted ? Number(kpi.weight) || 100 : 1
  const total = rows.reduce((sum, row) => sum + weight(row), 0)
  return total ? rows.reduce((sum, row) => sum + row.stats.progress * weight(row), 0) / total : null
}

export function organisationPerformance(goals) {
  const measured = goals.filter(({ score }) => score !== null)
  return measured.length ? measured.reduce((sum, goal) => sum + goal.score, 0) / measured.length : null
}

export function contributions(state, rows, includeDepartment, date) {
  const groups = new Map()
  for (const row of rows) {
    const parent = byId(state.allocations, row.alloc.parentId)
    const scopes = [{ label: 'Organisation', alloc: null }]
    if (includeDepartment && parent?.level === 'department') scopes.unshift({ label: 'Department', alloc: parent })
    for (const { label, alloc } of scopes) {
      const id = row.kpi.id + ':' + (alloc?.id || label)
      if (!groups.has(id)) {
        groups.set(id, { id, kpi: row.kpi, label, target: nodeStats(state, row.kpi, row.period, alloc, date).target, allocationTarget: 0, rows: [] })
      }
      const group = groups.get(id)
      group.allocationTarget += row.stats.target
      group.rows.push(row)
    }
  }
  return [...groups.values()].map(({ target, allocationTarget, rows, ...group }) => ({
    ...group,
    share: group.kpi.type === 'sum' && target > 0 ? allocationTarget / target * 100 : null,
    score: group.kpi.type === 'sum' ? (allocationTarget > 0 ? rows.reduce((sum, row) => sum + row.stats.current, 0) / allocationTarget * 100 : null) : performance(rows, false),
  }))
}

// Report builders: per-level performance and update compliance.
// Everything is calculated from the same roll-up engine (calc.js) "as of" a chosen date.
import { byId, personScore, cycleGoals, goalKpis, currentPeriod, unitAllocations, nodeStats, weightedScore, allocationUpdates, childAllocations, kpiProgress, goalProgress, band, unitName } from './calc'
import { daysBetween, minISO, maxISO, sum } from './utils'

function itemDetail(state, it, asOf) {
  return { ...it, stats: nodeStats(state, it.kpi, it.period, it.alloc, asOf) }
}

/** Leaf allocations under a node (the people who actually record results). */
function leafAllocs(state, alloc) {
  const kids = childAllocations(state, alloc.periodId, alloc.id)
  return kids.length ? kids.flatMap((k) => leafAllocs(state, k)) : [alloc]
}

function lastUpdateOf(state, allocs, asOf) {
  const ups = allocs.flatMap((a) => allocationUpdates(state, a.id)).filter((u) => u.date <= asOf)
  return { last: ups.map((u) => u.date).sort().slice(-1)[0] || null, count: ups.length }
}

/**
 * One row per department / team / person that holds at least one KPI share in the cycle.
 * level: 'department' | 'team' | 'individual'
 */
export function levelRows(state, cycle, level, asOf, deptId = 'all', filter = {}) {
  const units =
    level === 'department' ? state.departments : level === 'team' ? state.teams : state.staff.filter((s) => s.active !== false)
  const staleDays = state.settings.staleDays ?? 30
  const out = []
  for (const u of units) {
    const dep = level === 'department' ? u.id : u.departmentId
    if (deptId !== 'all' && dep !== deptId) continue
    let items = unitAllocations(state, level, u.id, cycle.id)
    if (filter.goalId) items = items.filter((it) => it.goal.id === filter.goalId)
    if (filter.kpiId) items = items.filter((it) => it.kpi.id === filter.kpiId)
    if (!items.length) continue
    const details = items.map((it) => itemDetail(state, it, asOf))
    const leaves = items.flatMap((it) => leafAllocs(state, it.alloc))
    const { last, count } = lastUpdateOf(state, leaves, asOf)
    const people = new Set(leaves.filter((a) => a.level === 'individual').map((a) => a.unitId))
    // people: KPI score = plain average (team lead: average of members) + Org Fit -> final; units: KPI-contribution weighted
    const ps = level === 'individual' ? personScore(state, u.id, cycle.id, filter, asOf) : null
    const score = ps ? ps.final : weightedScore(state, items, asOf)
    const since = last ? daysBetween(last, asOf) - 1 : null
    out.push({
      unit: u,
      level,
      name: u.name,
      dept: byId(state.departments, dep),
      team: level === 'individual' && u.teamId ? byId(state.teams, u.teamId) : null,
      lead: level === 'department' ? byId(state.staff, u.headId) : level === 'team' ? byId(state.staff, u.leadId) : null,
      items: details,
      score,
      kpiScore: ps ? ps.kpiPart : score,
      ownKpi: ps ? ps.own : score,
      orgFit: ps ? ps.orgFit : null,
      isLead: ps ? ps.isLead : false,
      members: ps ? ps.members : 0,
      band: band(state, score),
      people: people.size,
      lastUpdate: last,
      since,
      stale: since === null || since > staleDays,
      updates: count,
      best: [...details].sort((a, b) => b.stats.progress - a.stats.progress)[0],
      worst: [...details].sort((a, b) => a.stats.progress - b.stats.progress)[0],
    })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** Everything about one person for the individual report: KPIs, results and how often they update. */
export function personReport(state, cycle, staffId, asOf) {
  const items = unitAllocations(state, 'individual', staffId, cycle.id).map((it) => {
    const d = itemDetail(state, it, asOf)
    const ups = allocationUpdates(state, it.alloc.id).filter((u) => u.date <= asOf)
    const dates = ups.map((u) => u.date)
    const gaps = dates.slice(1).map((x, i) => daysBetween(dates[i], x) - 1)
    return { ...d, updates: ups, count: ups.length, first: dates[0] || null, last: dates[dates.length - 1] || null, avgGap: gaps.length ? sum(gaps) / gaps.length : null, since: dates.length ? daysBetween(dates[dates.length - 1], asOf) - 1 : null }
  })
  const records = items.flatMap((it) => {
    let total = 0
    return it.updates.map((u) => {
      total += Number(u.value) || 0
      return { u, kpi: it.kpi, goal: it.goal, total: it.kpi.type === 'sum' ? total : u.value }
    })
  }).sort((a, b) => b.u.date.localeCompare(a.u.date) || b.u.submittedAt.localeCompare(a.u.submittedAt))
  return { items, records, score: personScore(state, staffId, cycle.id, {}, asOf) }
}

/** Every KPI of the cycle with its progress and how much of it is shared down. */
export function kpiRows(state, cycle, asOf) {
  const out = []
  for (const g of cycleGoals(state, cycle.id).filter((x) => x.status !== 'draft')) {
    for (const k of goalKpis(state, g.id)) {
      const period = currentPeriod(state, k.id)
      if (!period) continue
      const stats = kpiProgress(state, k, period.id, asOf)
      const roots = childAllocations(state, period.id, null)
      const allocated = k.type === 'sum' ? sum(roots.map((r) => r.percent || 0)) : roots.length ? 100 : 0
      out.push({ goal: g, kpi: k, period, stats, allocated, goalProgress: goalProgress(state, g, asOf) })
    }
  }
  return out
}

/** People who hold a KPI but have not recorded anything for `days` days (or ever). */
export function staleUpdates(state, cycle, asOf, days = state.settings.staleDays ?? 30, deptId = 'all') {
  return levelRows(state, cycle, 'individual', asOf, deptId)
    .map((r) => ({ ...r, since: r.lastUpdate ? daysBetween(r.lastUpdate, asOf) - 1 : null }))
    .filter((r) => r.since === null || r.since > days)
    .sort((a, b) => (b.since ?? 1e9) - (a.since ?? 1e9))
}

/** Staff in HR who hold no KPI share in the cycle (department heads answer for their department's share, so they are left out). */
export function unassignedStaff(state, cycle, deptId = 'all') {
  const heads = new Set(state.departments.map((d) => d.headId))
  return state.staff.filter((s) => s.active !== false && s.departmentId && !heads.has(s.id) && (deptId === 'all' || s.departmentId === deptId) && unitAllocations(state, 'individual', s.id, cycle.id).length === 0)
}

/** Nodes of Sum KPIs whose children do not use the whole share. */
export function unsharedNodes(state, cycle) {
  const out = []
  for (const r of kpiRows(state, cycle, '9999-12-31')) {
    if (r.kpi.type !== 'sum') continue
    const walk = (alloc) => {
      const kids = childAllocations(state, r.period.id, alloc ? alloc.id : null)
      if (!kids.length) return
      const pct = sum(kids.map((k) => k.percent || 0))
      if (pct < 99.99) out.push({ kpi: r.kpi, goal: r.goal, node: alloc ? unitName(state, alloc) : `${state.settings.orgName} (organization)`, pct: 100 - pct })
      kids.forEach(walk)
    }
    walk(null)
  }
  return out
}

/** Number of result updates per month in the cycle. */
export function monthlyActivity(state, cycle, asOf) {
  const kpiIds = new Set(cycleGoals(state, cycle.id).flatMap((g) => goalKpis(state, g.id).map((k) => k.id)))
  const months = []
  for (let d = cycle.startDate.slice(0, 7); d <= minISO(asOf, cycle.endDate).slice(0, 7); ) {
    months.push(d)
    const [y, m] = d.split('-').map(Number)
    d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  }
  const ups = state.updates.filter((u) => kpiIds.has(u.kpiId) && u.date <= asOf)
  return months.map((m) => ({ month: m, count: ups.filter((u) => u.date.startsWith(m)).length, people: new Set(ups.filter((u) => u.date.startsWith(m)).map((u) => u.submittedBy)).size }))
}

/** Results recorded in the 30 days up to asOf. */
export function recentUpdates(state, cycle, asOf, days = 30) {
  const kpiIds = new Set(cycleGoals(state, cycle.id).flatMap((g) => goalKpis(state, g.id).map((k) => k.id)))
  return state.updates.filter((u) => kpiIds.has(u.kpiId) && u.date <= asOf && daysBetween(u.date, asOf) <= days).length
}

export const bandCounts = (rows) => {
  const c = {}
  for (const r of rows) c[r.band.key] = (c[r.band.key] || 0) + 1
  return c
}

/** Results recorded per day (or week) with optional department / KPI filter — for the updates line chart. */
export function updatesOverTime(state, cycle, asOf, { deptId = 'all', kpiId = 'all', by = 'day', from, to } = {}) {
  const kpiIds = new Set(cycleGoals(state, cycle.id).flatMap((g) => goalKpis(state, g.id).map((k) => k.id)))
  const start = from || cycle.startDate
  const end = minISO(to || asOf, asOf, cycle.endDate)
  const ups = state.updates.filter((u) => {
    if (!kpiIds.has(u.kpiId) || u.date < start || u.date > end) return false
    if (kpiId !== 'all' && u.kpiId !== kpiId) return false
    if (deptId !== 'all' && byId(state.staff, u.submittedBy)?.departmentId !== deptId) return false
    return true
  })
  const key = (d) => {
    if (by === 'day') return d
    const dt = new Date(`${d}T00:00:00`)
    dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
    return dt.toISOString().slice(0, 10)
  }
  const map = {}
  for (const u of ups) {
    const k = key(u.date)
    map[k] ??= { date: k, count: 0, people: new Set() }
    map[k].count += 1
    map[k].people.add(u.submittedBy)
  }
  return { start, end, total: ups.length, points: Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ ...p, people: p.people.size })) }
}

export const reportDefaultAsOf = (cycle, today) => maxISO(cycle.startDate, minISO(today, cycle.endDate))

// The KPI hierarchy as a list of "nodes": the organization KPI (parent of everything) and every share of it
// held by a department, team or person (child KPIs). Used by the KPIs page filters and the KPI-share detail page.
import { byId, cycleGoals, goalKpis, currentPeriod, childAllocations, nodeStats, unitName, allocationUpdates } from './calc'

export const LEVELS = ['organization', 'department', 'team', 'individual']
export const LEVEL_NAME = { organization: 'Organization', department: 'Department', team: 'Team', individual: 'Individual' }

/** Who owns a node: name, a sub-line (head / lead / job title) and the HR object. */
export function ownerOf(state, level, unitId) {
  if (level === 'organization') return { id: 'org', name: state.settings.orgName, sub: 'Whole organization' }
  if (level === 'department') {
    const d = byId(state.departments, unitId)
    return { id: unitId, name: d?.name, sub: `Head: ${byId(state.staff, d?.headId)?.name || '—'}` }
  }
  if (level === 'team') {
    const t = byId(state.teams, unitId)
    return { id: unitId, name: t?.name, sub: `${byId(state.departments, t?.departmentId)?.name} · Lead: ${byId(state.staff, t?.leadId)?.name || '—'}` }
  }
  const p = byId(state.staff, unitId)
  return { id: unitId, name: p?.name, sub: p?.title, person: p }
}

/** Ancestors of an allocation, top first (does not include the organization node). */
export function ancestors(state, alloc) {
  const out = []
  let a = alloc?.parentId ? byId(state.allocations, alloc.parentId) : null
  while (a) {
    out.unshift(a)
    a = a.parentId ? byId(state.allocations, a.parentId) : null
  }
  return out
}

/** Leaf allocations below (or equal to) a node — the people who actually record results. */
export function leavesOf(state, periodId, alloc) {
  const kids = childAllocations(state, periodId, alloc ? alloc.id : null)
  if (!kids.length) return alloc ? [alloc] : []
  return kids.flatMap((k) => leavesOf(state, periodId, k))
}

function makeNode(state, goal, kpi, period, alloc, depth) {
  const level = alloc ? alloc.level : 'organization'
  const stats = nodeStats(state, kpi, period, alloc)
  const kids = childAllocations(state, period.id, alloc ? alloc.id : null)
  const parentAlloc = alloc?.parentId ? byId(state.allocations, alloc.parentId) : null
  const parentStats = alloc ? nodeStats(state, kpi, period, parentAlloc) : null
  const leaves = leavesOf(state, period.id, alloc)
  const ups = leaves.flatMap((l) => allocationUpdates(state, l.id))
  return {
    key: alloc ? alloc.id : `org-${kpi.id}`,
    goal,
    kpi,
    period,
    alloc,
    level,
    depth,
    owner: ownerOf(state, level, alloc ? alloc.unitId : null),
    stats,
    children: kids,
    activeChildren: kids.filter((k) => !k.leftDate),
    parentAlloc,
    parentName: alloc ? (parentAlloc ? unitName(state, parentAlloc) : `${state.settings.orgName} (organization)`) : null,
    parentStats,
    path: alloc ? [`${state.settings.orgName}`, ...ancestors(state, alloc).map((a) => unitName(state, a))] : [],
    role: !alloc ? 'parent' : kids.length ? 'both' : 'child',
    lastUpdate: ups.map((u) => u.date).sort().slice(-1)[0] || null,
    updates: ups.length,
  }
}

/** Every KPI node of the cycle in tree order (organization → department → team → person). */
export function kpiNodes(state, cycleId) {
  const out = []
  for (const goal of cycleGoals(state, cycleId).filter((g) => g.status !== 'draft')) {
    for (const kpi of goalKpis(state, goal.id)) {
      const period = currentPeriod(state, kpi.id)
      if (!period) continue
      const walk = (alloc, depth) => {
        out.push(makeNode(state, goal, kpi, period, alloc, depth))
        for (const c of childAllocations(state, period.id, alloc ? alloc.id : null)) walk(c, depth + 1)
      }
      walk(null, 0)
    }
  }
  return out
}

export function nodeFor(state, kpi, alloc) {
  const goal = byId(state.goals, kpi.goalId)
  const period = alloc ? byId(state.periods, alloc.periodId) : currentPeriod(state, kpi.id)
  return makeNode(state, goal, kpi, period, alloc, alloc ? ancestors(state, alloc).length + 1 : 0)
}

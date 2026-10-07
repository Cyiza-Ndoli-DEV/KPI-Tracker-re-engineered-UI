// Calculation engine: roll-up of KPI results from individuals -> teams -> departments -> organization.
//
// Model recap
//   goal (org level only) -> kpis -> periods -> allocations (tree: department -> team -> individual)
//   updates are recorded on leaf allocations (usually individuals). Everything above is calculated.
//
// KPI types
//   sum         targets are split; results are added up        (e.g. revenue)
//   average     everybody carries the same benchmark; averaged (e.g. satisfaction 84%)
//   completion  Fully (100) / Partially (preset %) / Not achieved (0); averaged

import { todayISO, addDays, daysBetween, maxISO, minISO, sum, fmtDate } from './utils'

export const KPI_TYPES = {
  sum: { label: 'Sum', short: 'Σ', desc: 'Target is divided among units or people and results are added up.', example: 'Revenue, new clients, deals closed' },
  average: { label: 'Average', short: 'x̄', desc: 'Everyone carries the same benchmark and results are averaged.', example: 'Customer satisfaction 84%' },
  completion: { label: 'Completion', short: '✓', desc: 'For work that is not measured in numbers: fully, partially or not achieved.', example: 'Mandatory training, improve client communication' },
}

export const LEVEL_LABEL = { organization: 'Organization', department: 'Department', team: 'Team', individual: 'Individual' }

// ---------- lookups ----------
export const byId = (list, id) => list.find((x) => x.id === id)

export function unitName(state, alloc) {
  if (!alloc) return state.settings.orgName
  if (alloc.level === 'department') return byId(state.departments, alloc.unitId)?.name ?? '?'
  if (alloc.level === 'team') return byId(state.teams, alloc.unitId)?.name ?? '?'
  return byId(state.staff, alloc.unitId)?.name ?? '?'
}

export function kpiPeriods(state, kpiId) {
  return state.periods.filter((p) => p.kpiId === kpiId).sort((a, b) => a.index - b.index)
}
export function currentPeriod(state, kpiId) {
  const ps = kpiPeriods(state, kpiId)
  return ps.find((p) => p.status === 'open') || ps[ps.length - 1]
}
/** A member who left (or was taken off) a KPI on or before the given date. */
export const hasLeft = (alloc, asOf = todayISO()) => !!alloc?.leftDate && alloc.leftDate <= asOf

export function childAllocations(state, periodId, parentId = null) {
  return state.allocations.filter((a) => a.periodId === periodId && (a.parentId ?? null) === parentId)
}
export function allocationUpdates(state, allocId) {
  return state.updates
    .filter((u) => u.allocationId === allocId)
    .sort((a, b) => (a.date === b.date ? a.submittedAt.localeCompare(b.submittedAt) : a.date.localeCompare(b.date)))
}

/** Running total for a Sum allocation up to and including a given update (or all updates). */
export function cumulativeAt(state, allocId, upToUpdate) {
  const ups = allocationUpdates(state, allocId)
  const idx = upToUpdate ? ups.findIndex((u) => u.id === upToUpdate.id) : ups.length - 1
  return sum(ups.slice(0, idx + 1).map((u) => u.value))
}

export function kpiStart(kpi) {
  return kpi.type === 'average' ? Number(kpi.startValue) || 0 : 0
}
export function periodTarget(kpi, period) {
  if (kpi.type === 'completion') return 100
  return Number(period?.target ?? kpi.target)
}

export function progressOf(current, start, target) {
  if (current === null || current === undefined) return 0
  if (target === start) return current >= target ? 100 : 0
  return Math.max(0, ((current - start) / (target - start)) * 100)
}

// ---------- roll-up ----------
/**
 * Stats for a node of the allocation tree. alloc === null means the organization-level KPI.
 * asOf limits which updates are counted (used for rankings by date range and charts).
 */
export function nodeStats(state, kpi, period, alloc, asOf = todayISO()) {
  const start = kpiStart(kpi)
  const target = alloc && kpi.type === 'sum' ? Number(alloc.target) : periodTarget(kpi, period)
  const children = childAllocations(state, period.id, alloc ? alloc.id : null)

  let current
  let hasData = false
  if (children.length === 0) {
    if (!alloc) return { current: kpi.type === 'sum' ? 0 : start, target, start, progress: 0, hasData: false, children: [] }
    const ups = allocationUpdates(state, alloc.id).filter((u) => u.date <= asOf)
    const last = ups[ups.length - 1]
    hasData = !!last
    // Sum: every update is what was achieved since the previous one, so the total is the running sum.
    // Average / Completion: the latest reading is the current value.
    if (kpi.type === 'sum') current = sum(ups.map((u) => u.value))
    else current = last ? Number(last.value) : kpi.type === 'completion' ? 0 : start
  } else {
    // People who left keep their achievement in Sum totals, but no longer count in an average.
    const counted = kpi.type === 'sum' ? children : children.filter((c) => !hasLeft(c, asOf))
    const stats = (counted.length ? counted : children).map((c) => nodeStats(state, kpi, period, c, asOf))
    const withData = stats.filter((s) => s.hasData)
    hasData = withData.length > 0
    if (kpi.type === 'sum') current = sum(stats.map((s) => s.current))
    else if (kpi.type === 'average') current = hasData ? sum(withData.map((s) => s.current)) / withData.length : start
    else current = sum(stats.map((s) => s.current)) / stats.length
  }
  return { current, target, start, progress: progressOf(current, start, target), hasData }
}

export function kpiProgress(state, kpi, periodId, asOf) {
  const period = periodId ? byId(state.periods, periodId) : currentPeriod(state, kpi.id)
  if (!period) return { current: 0, target: kpi.target, start: kpiStart(kpi), progress: 0, hasData: false }
  return nodeStats(state, kpi, period, null, asOf)
}

export function goalKpis(state, goalId) {
  return state.kpis.filter((k) => k.goalId === goalId)
}

export function goalProgress(state, goal, asOf) {
  const kpis = goalKpis(state, goal.id)
  if (!kpis.length) return 0
  const totalW = sum(kpis.map((k) => k.weight)) || kpis.length
  return sum(kpis.map((k) => kpiProgress(state, k, null, asOf).progress * ((k.weight || 100 / kpis.length) / totalW)))
}

export function cycleGoals(state, cycleId) {
  return state.goals.filter((g) => g.cycleId === cycleId)
}

/** Each goal is tracked on its own (100%); this is only the plain average of goal progress, for an at-a-glance view. */
export function cycleScore(state, cycleId) {
  const goals = cycleGoals(state, cycleId).filter((g) => g.status !== 'draft')
  if (!goals.length) return 0
  return sum(goals.map((g) => goalProgress(state, g))) / goals.length
}

// Performance bands come from Admin Settings → Set up (label + minimum score). Highest band first.
export const DEFAULT_BANDS = [
  { key: 'exceeds', label: 'Exceeds expectations', min: 100, tone: 'green' },
  { key: 'meets', label: 'Meets expectations', min: 70, tone: 'blue' },
  { key: 'needs', label: 'Needs improvement', min: 50, tone: 'amber' },
  { key: 'below', label: 'Below expectations', min: 0, tone: 'red' },
]
export const bandsOf = (state) => state?.settings?.bands || DEFAULT_BANDS

/** The performance band for a score. Pass the app state (uses the configured bands). */
export function band(state, pct) {
  const bands = bandsOf(state)
  return bands.find((b) => (pct ?? 0) >= b.min) || bands[bands.length - 1]
}

// ---------- people & units ----------
/** Allocations (current periods, live goals) for a unit/person. */
export function unitAllocations(state, level, unitId, cycleId) {
  const out = []
  for (const goal of state.goals) {
    if (cycleId && goal.cycleId !== cycleId) continue
    if (!['running', 'stopped', 'ready'].includes(goal.status)) continue
    for (const kpi of goalKpis(state, goal.id)) {
      const period = currentPeriod(state, kpi.id)
      if (!period) continue
      for (const a of state.allocations) {
        if (a.periodId === period.id && a.level === level && a.unitId === unitId && !a.leftDate) out.push({ alloc: a, kpi, goal, period })
      }
    }
  }
  return out
}

export function weightedScore(state, items, asOf) {
  if (!items.length) return null
  let w = 0
  let s = 0
  for (const it of items) {
    const kw = (it.kpi.weight || 100) / 100
    const st = nodeStats(state, it.kpi, it.period, it.alloc, asOf)
    s += st.progress * kw
    w += kw
  }
  return w ? s / w : null
}

export function unitScore(state, level, unitId, cycleId) {
  return weightedScore(state, unitAllocations(state, level, unitId, cycleId))
}

// ---------- personal scores ----------
/** A person's KPI score = plain average of the progress on every KPI share they hold (optionally one goal / KPI). */
export function personKpiScore(state, staffId, cycleId, filter = {}, asOf) {
  let items = unitAllocations(state, 'individual', staffId, cycleId)
  if (filter.goalId) items = items.filter((it) => it.goal.id === filter.goalId)
  if (filter.kpiId) items = items.filter((it) => it.kpi.id === filter.kpiId)
  if (!items.length) return null
  return sum(items.map((it) => nodeStats(state, it.kpi, it.period, it.alloc, asOf).progress)) / items.length
}

/** Teams a person leads. */
export const ledTeams = (state, staffId) => state.teams.filter((t) => t.leadId === staffId)

/** The members (not the lead) of the teams a person leads who hold at least one KPI. */
export function teamMembersOf(state, leadId, cycleId) {
  const teamIds = new Set(ledTeams(state, leadId).map((t) => t.id))
  return state.staff.filter((s) => s.id !== leadId && s.active !== false && teamIds.has(s.teamId) && unitAllocations(state, 'individual', s.id, cycleId).length)
}

export const orgFitOf = (state, staffId, cycleId) => {
  const v = state.orgFit?.[cycleId]?.[staffId]
  return v === undefined || v === null || v === '' ? null : Number(v)
}

/**
 * Final score for a person.
 *   Member:    KPI part = average of their own KPIs.
 *   Team lead: KPI part = average of their team members' KPI scores.
 *   Final = KPI part × KPI weight + Org Fit × Org Fit weight (weights from Settings; Org Fit missing → KPI part only).
 */
export function personScore(state, staffId, cycleId, filter = {}, asOf) {
  const own = personKpiScore(state, staffId, cycleId, filter, asOf)
  const members = ledTeams(state, staffId).length ? teamMembersOf(state, staffId, cycleId) : []
  const memberScores = members.map((m) => personKpiScore(state, m.id, cycleId, filter, asOf)).filter((x) => x !== null)
  const isLead = memberScores.length > 0
  const kpiPart = isLead ? sum(memberScores) / memberScores.length : own
  const orgFit = orgFitOf(state, staffId, cycleId)
  const w = state.settings.scoring || { kpiWeight: 70, orgFitWeight: 30 }
  let final = kpiPart
  if (kpiPart !== null && orgFit !== null) final = (kpiPart * w.kpiWeight + orgFit * w.orgFitWeight) / (w.kpiWeight + w.orgFitWeight)
  return { own, kpiPart, isLead, members: members.length, orgFit, final, weights: w }
}

// ---------- can results be recorded? ----------
/** Why a person cannot record a result on this share right now, or null when they can. */
export function updateBlock(state, alloc, today = todayISO()) {
  const kpi = byId(state.kpis, alloc.kpiId)
  const period = byId(state.periods, alloc.periodId)
  const goal = kpi && byId(state.goals, kpi.goalId)
  if (!goal || !period) return 'Not available.'
  if (alloc.leftDate) return `Closed on ${fmtDate(alloc.leftDate)}.`
  const opens = maxISO(alloc.joinedDate, alloc.startDate, period.startDate, goal.startDate)
  if (goal.status === 'stopped') return 'The goal has been stopped.'
  if (period.status !== 'open') return 'This KPI period is closed.'
  if (opens > today) return `Opens on ${fmtDate(opens)}, when the KPI period starts. Results cannot be dated in the future.`
  if (goal.status !== 'running') return 'The goal is set up but not started. An admin must click “Start running” on the goal.'
  return null
}

// ---------- rankings ----------
export function rateForAllocation(state, item, from, to) {
  const { alloc, kpi, period } = item
  const heldFrom = maxISO(from, alloc.joinedDate || alloc.startDate, period.startDate)
  const heldTo = minISO(to, alloc.endDate, period.endDate, period.closedAt)
  if (!heldFrom || !heldTo || heldTo < heldFrom) return null
  const before = nodeStats(state, kpi, period, alloc, addDays(from, -1)).progress
  const after = nodeStats(state, kpi, period, alloc, to).progress
  const days = daysBetween(heldFrom, heldTo)
  return { gained: after - before, days, rate: (after - before) / days }
}

// ---------- edit lock ----------
export function lockInfo(state, update, now = new Date()) {
  const windowDays = state.settings.editWindowDays
  const lockAt = new Date(new Date(update.submittedAt).getTime() + windowDays * 86400000)
  const unlocked = update.unlockedUntil && now <= new Date(update.unlockedUntil)
  return { locked: now > lockAt && !unlocked, lockAt, unlocked: !!unlocked }
}

// ---------- chart series ----------
export function progressSeries(state, kpi, period, alloc = null) {
  const allocIds = new Set()
  const walk = (parentId) => {
    for (const c of childAllocations(state, period.id, parentId)) {
      allocIds.add(c.id)
      walk(c.id)
    }
  }
  if (alloc) allocIds.add(alloc.id)
  walk(alloc ? alloc.id : null)
  const end = minISO(todayISO(), period.closedAt || period.endDate)
  const dates = [...new Set(state.updates.filter((u) => allocIds.has(u.allocationId) && u.date <= end).map((u) => u.date))].sort()
  const pts = [{ date: period.startDate, value: 0 }]
  for (const d of dates) pts.push({ date: d, value: nodeStats(state, kpi, period, alloc, d).progress })
  return pts
}

/** Sum of allocated percentages of the children of a node (Sum KPIs). */
export function allocatedPct(state, periodId, parentId) {
  return sum(childAllocations(state, periodId, parentId).map((a) => a.percent || 0))
}

// Wizard draft helpers: targets, validation, commit (draft -> goal/kpis/allocations) and reuse (goal -> draft).
import { uid, sum, round, addDays, daysBetween, maxISO, minISO, nowISO } from './utils'
import { byId, currentPeriod, childAllocations, goalKpis } from './calc'

export const STEPS = [
  { key: 'goal', label: 'Goal', hint: 'Name, type & period' },
  { key: 'kpis', label: 'KPIs', hint: 'Measurable targets' },
  { key: 'depts', label: 'Departments', hint: 'Share the target' },
  { key: 'teams', label: 'Teams', hint: "Split each department's share" },
  { key: 'people', label: 'Individuals', hint: 'Assign to staff' },
  { key: 'review', label: 'Review & save', hint: 'Check and confirm' },
]

export function emptyDraft(cycle, userId) {
  return {
    id: uid('dr'),
    cycleId: cycle?.id,
    step: 0,
    createdBy: userId,
    savedAt: null,
    goal: { name: '', description: '', type: 'sum', startDate: cycle?.startDate || '', endDate: cycle?.endDate || '' },
    kpis: [],
    depts: {},
    teams: {},
    people: {},
  }
}

export function newKpi(draft) {
  const n = draft.kpis.length + 1
  return {
    key: uid('k'),
    name: '',
    description: '',
    type: draft.goal.type || 'sum', // inherited from the goal, never chosen per KPI
    unit: draft.goal.type === 'completion' ? '%' : draft.goal.type === 'average' ? '%' : 'UGX',
    startValue: draft.goal.type === 'average' ? '' : 0,
    target: draft.goal.type === 'completion' ? 100 : '',
    weight: round(100 / n, 2),
    startDate: draft.goal.startDate,
    endDate: draft.goal.endDate,
  }
}

// ---------- targets inside a draft ----------
export const kpiTarget = (k) => (k.type === 'completion' ? 100 : Number(k.target) || 0)
export const isSum = (k) => k.type === 'sum'

export function deptRow(draft, k, deptId) {
  return draft.depts[k.key]?.rows.find((r) => r.unitId === deptId)
}
export function teamRow(draft, k, deptId, teamId) {
  return draft.teams[k.key]?.[deptId]?.rows.find((r) => r.unitId === teamId)
}
export function deptTarget(draft, k, deptId) {
  const r = deptRow(draft, k, deptId)
  if (!r) return 0
  return isSum(k) ? (kpiTarget(k) * (Number(r.percent) || 0)) / 100 : kpiTarget(k)
}
export function teamTarget(draft, k, deptId, teamId) {
  const r = teamRow(draft, k, deptId, teamId)
  if (!r) return 0
  return isSum(k) ? (deptTarget(draft, k, deptId) * (Number(r.percent) || 0)) / 100 : kpiTarget(k)
}
export const groupRows = (draft, k, groupKey) => draft.people[k.key]?.[groupKey]?.rows || []
export const pctTotal = (rows) => sum(rows.map((r) => Number(r.percent) || 0))

/** % of a department already given to its teams (needed when sharing the rest with direct members). */
export function teamsPctOfDept(draft, k, deptId) {
  return pctTotal(draft.teams[k.key]?.[deptId]?.rows || [])
}
export function directPctOfDept(draft, k, deptId) {
  return pctTotal(groupRows(draft, k, `dept:${deptId}`))
}

// ---------- validation ----------
/**
 * Returns { errors, warnings }. Each item: { step, field, kpiKey?, msg }.
 * `field` matches a data-field attribute in the wizard so we can highlight + scroll to it.
 */
export function validateDraft(state, draft) {
  const errors = []
  const warnings = []
  const E = (step, field, msg, kpiKey) => errors.push({ step, field, msg, kpiKey })
  const W = (step, field, msg, kpiKey) => warnings.push({ step, field, msg, kpiKey })
  const g = draft.goal
  const cycle = byId(state.cycles, draft.cycleId)

  // Step 1 — goal
  if (!g.name?.trim()) E(0, 'goal.name', 'Goal name is required.')
  else if (state.goals.some((x) => x.cycleId === draft.cycleId && x.name.trim().toLowerCase() === g.name.trim().toLowerCase()))
    E(0, 'goal.name', `A goal called "${g.name}" already exists in this cycle.`)
  if (!g.startDate) E(0, 'goal.startDate', 'Start date is required.')
  if (!g.endDate) E(0, 'goal.endDate', 'End date is required.')
  if (g.startDate && g.endDate && g.endDate < g.startDate) E(0, 'goal.endDate', 'End date must be on or after the start date.')
  if (cycle && g.startDate && (g.startDate < cycle.startDate || g.startDate > cycle.endDate)) E(0, 'goal.startDate', `Start date must fall within ${cycle.name}.`)
  if (cycle && g.endDate && (g.endDate > cycle.endDate || g.endDate < cycle.startDate)) E(0, 'goal.endDate', `End date must fall within ${cycle.name}.`)

  // Step 2 — KPIs
  if (!draft.kpis.length) E(1, 'kpis', 'Add at least one KPI to this goal.')
  for (const k of draft.kpis) {
    const f = (x) => `kpi.${k.key}.${x}`
    if (!k.name?.trim()) E(1, f('name'), 'KPI name is required.', k.key)
    if (!k.unit) E(1, f('unit'), 'Unit of measure is required.', k.key)
    if (k.type !== 'completion') {
      if (k.target === '' || k.target === null || !(Number(k.target) > 0)) E(1, f('target'), 'Target must be a positive number.', k.key)
      if (k.type === 'average') {
        if (k.startValue === '' || k.startValue === null) E(1, f('startValue'), 'Starting value is required for Average KPIs.', k.key)
        else if (Number(k.startValue) === Number(k.target)) E(1, f('target'), 'Target must differ from the starting value.', k.key)
      }
    }
    if (!k.startDate) E(1, f('startDate'), 'Start date is required.', k.key)
    if (!k.endDate) E(1, f('endDate'), 'End date is required.', k.key)
    if (k.startDate && k.endDate && k.endDate < k.startDate) E(1, f('endDate'), 'End date must be on or after the start date.', k.key)
    if (k.startDate && g.startDate && k.startDate < g.startDate) E(1, f('startDate'), "KPI can't start before the goal.", k.key)
    if (k.endDate && g.endDate && k.endDate > g.endDate) E(1, f('endDate'), "KPI can't run past the goal's end date.", k.key)
  }
  if (draft.kpis.length) {
    const tw = sum(draft.kpis.map((k) => Number(k.weight) || 0))
    if (Math.abs(tw - 100) > 0.05) E(1, 'kpis.weight', `KPI contributions to this goal must add up to 100% (now ${round(tw)}%).`)
  }

  // Step 3..5 — allocations
  for (const k of draft.kpis) {
    const label = k.name || 'Untitled KPI'
    const drows = draft.depts[k.key]?.rows || []
    if (!drows.length) W(2, `dept.${k.key}`, `"${label}" is not shared with any department yet.`, k.key)
    checkRows(drows, k, 2, `dept.${k.key}`, `${label} → departments`, 0, k.startDate, k.endDate)
    for (const d of drows) {
      const dName = byId(state.departments, d.unitId)?.name
      const trows = draft.teams[k.key]?.[d.unitId]?.rows || []
      const direct = groupRows(draft, k, `dept:${d.unitId}`)
      const ds = d.startDate || k.startDate
      const de = d.endDate || k.endDate
      checkRows(trows, k, 3, `team.${k.key}.${d.unitId}`, `${label} → ${dName} teams`, pctTotal(direct), ds, de)
      checkRows(direct, k, 4, `people.${k.key}.dept:${d.unitId}`, `${label} → ${dName} direct members`, pctTotal(trows), ds, de)
      for (const t of trows) {
        const tName = byId(state.teams, t.unitId)?.name
        const prows = groupRows(draft, k, `team:${t.unitId}`)
        checkRows(prows, k, 4, `people.${k.key}.team:${t.unitId}`, `${label} → ${tName} members`, 0, t.startDate || ds, t.endDate || de)
      }
    }
  }

  function checkRows(rows, k, step, field, where, otherPct, minD, maxD) {
    if (!rows.length) return
    if (isSum(k)) {
      const total = pctTotal(rows) + (otherPct || 0)
      if (total > 100.0001) E(step, field, `${where}: allocations total ${round(total)}% — they can't go over 100%.`, k.key)
      if (rows.some((r) => !(Number(r.percent) > 0))) E(step, field, `${where}: every selected unit needs a share above 0%.`, k.key)
      else if (total < 99.99 && step > 2) W(step, field, `${where}: ${round(100 - total)}% is still unallocated.`, k.key)
    }
    for (const r of rows) {
      if (r.startDate && r.endDate && r.endDate < r.startDate) E(step, field, `${where}: an end date is before its start date.`, k.key)
      if ((r.startDate && minD && r.startDate < minD) || (r.endDate && maxD && r.endDate > maxD))
        E(step, field, `${where}: periods must stay within the parent's dates (${minD} → ${maxD}).`, k.key)
    }
  }

  return { errors, warnings }
}

// ---------- commit ----------
export function commitDraftToEntities(draft, goalId) {
  const created = nowISO()
  const goal = {
    id: goalId,
    cycleId: draft.cycleId,
    name: draft.goal.name.trim(),
    description: draft.goal.description || '',
    type: draft.goal.type,
    startDate: draft.goal.startDate,
    endDate: draft.goal.endDate,
    status: 'ready',
    createdAt: created,
    createdBy: draft.createdBy,
  }
  const kpis = []
  const periods = []
  const allocations = []
  for (const k of draft.kpis) {
    const kpiId = uid('k')
    const T = kpiTarget(k)
    kpis.push({ id: kpiId, goalId, name: k.name.trim(), description: k.description || '', type: draft.goal.type, unit: k.type === 'completion' ? '%' : k.unit, startValue: k.type === 'average' ? Number(k.startValue) : 0, target: T, weight: Number(k.weight), startDate: k.startDate, endDate: k.endDate })
    const periodId = uid('p')
    periods.push({ id: periodId, kpiId, index: 1, startDate: k.startDate, endDate: k.endDate, target: T, status: 'open' })
    const mk = (parentId, level, unitId, row, parentTarget, ps, pe) => {
      const id = uid('a')
      const startDate = row.startDate || ps
      const endDate = row.endDate || pe
      const percent = isSum(k) ? Number(row.percent) || 0 : null
      allocations.push({ id, kpiId, periodId, parentId, level, unitId, percent, target: isSum(k) ? (parentTarget * percent) / 100 : T, startDate, endDate, joinedDate: startDate, createdAt: created })
      return { id, target: isSum(k) ? (parentTarget * percent) / 100 : T, startDate, endDate }
    }
    for (const d of draft.depts[k.key]?.rows || []) {
      const da = mk(null, 'department', d.unitId, d, T, k.startDate, k.endDate)
      for (const t of draft.teams[k.key]?.[d.unitId]?.rows || []) {
        const ta = mk(da.id, 'team', t.unitId, t, da.target, da.startDate, da.endDate)
        for (const p of groupRows(draft, k, `team:${t.unitId}`)) mk(ta.id, 'individual', p.unitId, p, ta.target, ta.startDate, ta.endDate)
      }
      for (const p of groupRows(draft, k, `dept:${d.unitId}`)) mk(da.id, 'individual', p.unitId, p, da.target, da.startDate, da.endDate)
    }
  }
  return { goal, kpis, periods, allocations }
}

// ---------- reuse: existing goal -> new draft ----------
export function draftFromGoal(state, goalId, targetCycle, userId) {
  const goal = byId(state.goals, goalId)
  const srcCycle = byId(state.cycles, goal.cycleId)
  const offset = srcCycle && targetCycle && srcCycle.id !== targetCycle.id ? daysBetween(srcCycle.startDate, targetCycle.startDate) - 1 : 0
  const shift = (d) => {
    if (!d) return d
    const x = addDays(d, offset)
    return targetCycle ? minISO(maxISO(x, targetCycle.startDate), targetCycle.endDate) : x
  }
  const draft = {
    id: uid('dr'),
    cycleId: targetCycle.id,
    step: 0,
    createdBy: userId,
    savedAt: nowISO(),
    reusedFrom: goal.id,
    goal: { name: goal.name, description: goal.description, type: goal.type, startDate: shift(goal.startDate), endDate: shift(goal.endDate) },
    kpis: [],
    depts: {},
    teams: {},
    people: {},
  }
  if (targetCycle.id === goal.cycleId) draft.goal.name = `${goal.name} (copy)`
  for (const kpi of goalKpis(state, goal.id)) {
    const key = uid('k')
    const period = currentPeriod(state, kpi.id)
    draft.kpis.push({ key, name: kpi.name, description: kpi.description, type: kpi.type, unit: kpi.unit, startValue: kpi.startValue, target: period?.target ?? kpi.target, weight: kpi.weight, startDate: draft.goal.startDate, endDate: draft.goal.endDate })
    if (!period) continue
    // In the new period everybody starts from the beginning (late joiners included); dates stay editable.
    const row = (a) => ({ unitId: a.unitId, percent: a.percent ?? 100, startDate: draft.goal.startDate, endDate: draft.goal.endDate })
    const fixRow = (r) => r
    const method = kpi.type === 'sum' ? 'percent' : 'same'
    const depts = childAllocations(state, period.id, null)
    draft.depts[key] = { method, rows: depts.map((a) => fixRow(row(a))) }
    draft.teams[key] = {}
    draft.people[key] = {}
    for (const d of depts) {
      const kids = childAllocations(state, period.id, d.id)
      const teams = kids.filter((x) => x.level === 'team')
      const direct = kids.filter((x) => x.level === 'individual')
      if (teams.length) draft.teams[key][d.unitId] = { method, rows: teams.map((a) => fixRow(row(a))) }
      if (direct.length) draft.people[key][`dept:${d.unitId}`] = { method, rows: direct.map((a) => fixRow(row(a))) }
      for (const t of teams) {
        const ppl = childAllocations(state, period.id, t.id)
        if (ppl.length) draft.people[key][`team:${t.unitId}`] = { method, rows: ppl.map((a) => fixRow(row(a))) }
      }
    }
  }
  return draft
}

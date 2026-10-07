// In-memory app state (persisted to localStorage so a refresh during a demo loses nothing).
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createSeed, ROLES } from './data/seed'
import { uid, nowISO, todayISO, minISO, addDays, round, sum } from './lib/utils'
import { byId, currentPeriod, childAllocations, allocationUpdates, unitName, kpiPeriods, cumulativeAt } from './lib/calc'
import { commitDraftToEntities, draftFromGoal } from './lib/draft'

const VERSION = 9
const KEY = `pahappa-kpi-prototype-v${VERSION}`
const StoreCtx = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    return s.version === VERSION ? s : null
  } catch {
    return null
  }
}

export const currentUserId = (s) => ROLES[s.role].userId

export function StoreProvider({ children }) {
  const [state, setState] = useState(() => load() || createSeed())

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable — keep working in memory */
    }
  }, [state])

  const actions = useMemo(() => {
    const mutate = (fn) => setState((s) => {
      const n = structuredClone(s)
      fn(n)
      return n
    })
    const log = (n, entry) => n.audit.unshift({ id: uid('au'), at: nowISO(), who: currentUserId(n), ...entry })
    const staffName = (n, id) => byId(n.staff, id)?.name || id

    /** Recalculate absolute targets for every Sum allocation below a node after percentages change. */
    const retarget = (n, kpi, period, parentId, parentTarget) => {
      for (const c of childAllocations(n, period.id, parentId)) {
        if (kpi.type === 'sum') c.target = (parentTarget * (c.percent || 0)) / 100
        else c.target = period.target
        retarget(n, kpi, period, c.id, c.target)
      }
    }

    return {
      setRole: (role) => mutate((n) => { n.role = role }),
      setViewCycle: (id) => mutate((n) => { n.viewCycleId = id }),
      resetDemo: () => setState(createSeed()),
      updateSettings: (patch) => mutate((n) => {
        const before = { ...n.settings }
        Object.assign(n.settings, patch)
        const show = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? `${x.label} ${x.min}%+` : x)).join(', ') : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k} ${x}`).join(', ') : String(v))
        const keys = Object.keys(patch).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(n.settings[k]))
        if (keys.length) log(n, { action: 'Settings changed', subject: 'Admin settings · set up', oldValue: keys.map((k) => `${k}: ${show(before[k])}`).join('; '), newValue: keys.map((k) => `${k}: ${show(n.settings[k])}`).join('; ') })
      }),
      setOrgFit: (cycleId, scores) => mutate((n) => {
        n.orgFit = n.orgFit || {}
        const before = { ...(n.orgFit[cycleId] || {}) }
        n.orgFit[cycleId] = { ...before, ...scores }
        const changed = Object.keys(scores).filter((k) => String(before[k] ?? '') !== String(scores[k] ?? ''))
        if (changed.length) log(n, { action: 'Org Fit scores updated', subject: `${byId(n.cycles, cycleId)?.name}`, oldValue: changed.map((k) => `${staffName(n, k)} ${before[k] ?? '—'}`).join('; '), newValue: changed.map((k) => `${staffName(n, k)} ${scores[k] === '' ? '—' : scores[k]}`).join('; ') })
      }),

      // ---------- cycles ----------
      createCycle: (data, id = uid('c')) => mutate((n) => {
        n.cycles.push({ id, status: 'draft', createdAt: nowISO(), thresholds: { needs: 50, meets: 70, exceeds: 90 }, ...data })
        log(n, { action: 'Cycle created', subject: data.name, oldValue: '—', newValue: 'Draft' })
      }),
      updateCycle: (id, patch) => mutate((n) => { Object.assign(byId(n.cycles, id), patch) }),
      activateCycle: (id) => mutate((n) => {
        const c = byId(n.cycles, id)
        c.status = 'active'
        c.activatedAt = nowISO()
        n.viewCycleId = id
        log(n, { action: 'Cycle activated', subject: c.name, oldValue: 'Draft', newValue: 'Active' })
      }),
      endCycle: (id) => mutate((n) => {
        const c = byId(n.cycles, id)
        c.status = 'ended'
        c.endedAt = nowISO()
        const closeOn = minISO(todayISO(), c.endDate)
        for (const g of n.goals.filter((x) => x.cycleId === id)) {
          if (g.status === 'running') { g.status = 'stopped'; g.stoppedAt = nowISO() }
          for (const k of n.kpis.filter((x) => x.goalId === g.id))
            for (const p of n.periods.filter((x) => x.kpiId === k.id && x.status === 'open')) { p.status = 'closed'; p.closedAt = closeOn; p.closeReason = 'Cycle ended' }
        }
        log(n, { action: 'Cycle ended', subject: c.name, oldValue: 'Active', newValue: 'Ended — all goals frozen, results kept' })
      }),
      /** Delete a cycle with everything in it: goals, KPIs, periods, shares, results, edit requests and drafts. */
      deleteCycle: (id, reason) => mutate((n) => {
        const c = byId(n.cycles, id)
        const goalIds = new Set(n.goals.filter((g) => g.cycleId === id).map((g) => g.id))
        const kpiIds = new Set(n.kpis.filter((k) => goalIds.has(k.goalId)).map((k) => k.id))
        const periodIds = new Set(n.periods.filter((p) => kpiIds.has(p.kpiId)).map((p) => p.id))
        const updIds = new Set(n.updates.filter((u) => kpiIds.has(u.kpiId)).map((u) => u.id))
        const drafts = n.drafts.filter((d) => d.cycleId === id).length
        const shares = n.allocations.filter((a) => periodIds.has(a.periodId)).length
        n.editRequests = n.editRequests.filter((r) => !updIds.has(r.updateId))
        n.updates = n.updates.filter((u) => !updIds.has(u.id))
        n.allocations = n.allocations.filter((a) => !periodIds.has(a.periodId))
        n.periods = n.periods.filter((p) => !periodIds.has(p.id))
        n.kpis = n.kpis.filter((k) => !kpiIds.has(k.id))
        n.goals = n.goals.filter((g) => !goalIds.has(g.id))
        n.drafts = n.drafts.filter((d) => d.cycleId !== id)
        n.cycles = n.cycles.filter((x) => x.id !== id)
        if (n.viewCycleId === id) n.viewCycleId = (n.cycles.find((x) => x.status === 'active') || [...n.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))[0])?.id
        log(n, { action: 'Cycle deleted', subject: c.name, oldValue: `${c.status}; ${goalIds.size} goal(s), ${kpiIds.size} KPI(s), ${shares} share(s), ${updIds.size} result(s), ${drafts} draft(s)`, newValue: 'Deleted', note: reason })
      }),
      /** Start a new cycle (or fill an existing one) from a previous cycle: every goal becomes an editable draft. */
      reuseCycle: (sourceId, target, newCycleId = uid('c')) => mutate((n) => {
        let cycle
        if (target.mode === 'new') {
          cycle = { id: newCycleId, name: target.name, startDate: target.startDate, endDate: target.endDate, status: 'draft', createdAt: nowISO(), thresholds: { ...(byId(n.cycles, sourceId)?.thresholds || { needs: 50, meets: 70, exceeds: 90 }) }, reusedFrom: sourceId }
          n.cycles.push(cycle)
        } else cycle = byId(n.cycles, target.cycleId)
        for (const g of n.goals.filter((x) => x.cycleId === sourceId)) n.drafts.unshift(draftFromGoal(n, g.id, cycle, currentUserId(n)))
        n.viewCycleId = cycle.id
        log(n, { action: 'Cycle reused', subject: `${byId(n.cycles, sourceId).name} → ${cycle.name}`, oldValue: '—', newValue: 'Goals, KPIs and allocations copied into drafts' })
      }),

      // ---------- drafts & goals ----------
      saveDraft: (draft) => mutate((n) => {
        const d = { ...structuredClone(draft), savedAt: nowISO() }
        const i = n.drafts.findIndex((x) => x.id === d.id)
        if (i >= 0) n.drafts[i] = d
        else n.drafts.unshift(d)
      }),
      deleteDraft: (id) => mutate((n) => { n.drafts = n.drafts.filter((d) => d.id !== id) }),
      commitDraft: (draft, goalId) => mutate((n) => {
        const { goal, kpis, periods, allocations } = commitDraftToEntities(draft, goalId)
        n.goals.push(goal)
        n.kpis.push(...kpis)
        n.periods.push(...periods)
        n.allocations.push(...allocations)
        n.drafts = n.drafts.filter((d) => d.id !== draft.id)
        log(n, { action: 'Goal set up', goalId, subject: goal.name, oldValue: '—', newValue: `${kpis.length} KPI(s), ${allocations.length} allocation(s) — status Ready` })
      }),
      reuseGoal: (goalId, cycleId, draftId) => mutate((n) => {
        const d = draftFromGoal(n, goalId, byId(n.cycles, cycleId), currentUserId(n))
        d.id = draftId
        n.drafts.unshift(d)
      }),
      startGoal: (id) => mutate((n) => {
        const g = byId(n.goals, id)
        g.status = 'running'
        g.startedAt = nowISO()
        log(n, { action: 'Goal started', goalId: id, subject: g.name, oldValue: 'Ready', newValue: 'Running' })
      }),
      stopGoal: (id) => mutate((n) => {
        const g = byId(n.goals, id)
        g.status = 'stopped'
        g.stoppedAt = nowISO()
        for (const k of n.kpis.filter((x) => x.goalId === id))
          for (const p of n.periods.filter((x) => x.kpiId === k.id && x.status === 'open')) { p.status = 'closed'; p.closedAt = minISO(todayISO(), p.endDate); p.closeReason = 'Goal stopped' }
        log(n, { action: 'Goal stopped', goalId: id, subject: g.name, oldValue: 'Running', newValue: 'Stopped — progress frozen, history kept' })
      }),

      // ---------- org structure ----------
      createTeam: ({ id = uid('t'), name, departmentId, leadId, memberIds = [], description = '' }) => mutate((n) => {
        n.teams.push({ id, name, departmentId, leadId, description })
        for (const sid of new Set([leadId, ...memberIds].filter(Boolean))) byId(n.staff, sid).teamId = id
        log(n, { action: 'Team created', subject: `${name} (${byId(n.departments, departmentId).name})`, oldValue: '—', newValue: `${memberIds.length + (leadId ? 1 : 0)} member(s)` })
      }),

      // ---------- results ----------
      addUpdate: ({ allocationId, date, value, completion, reason }) => mutate((n) => {
        const a = byId(n.allocations, allocationId)
        const kpi = byId(n.kpis, a.kpiId)
        const prev = allocationUpdates(n, allocationId).slice(-1)[0]
        n.updates.push({ id: uid('u'), allocationId, kpiId: a.kpiId, periodId: a.periodId, date, value: Number(value), completion, reason, submittedAt: nowISO(), submittedBy: currentUserId(n) })
        log(n, { action: 'Result recorded', goalId: kpi.goalId, kpiId: kpi.id, allocationId, subject: unitName(n, a), oldValue: kpi.type === 'sum' ? `Total ${money(kpi, cumulativeAt(n, allocationId))}` : prev ? fmtU(kpi, prev) : '—', newValue: kpi.type === 'sum' ? `${fmtU(kpi, { value })} achieved (as of ${date}) → total ${money(kpi, cumulativeAt(n, allocationId) + Number(value))}` : `${fmtU(kpi, { value, completion })} (as of ${date})` })
      }),
      editUpdate: (updateId, patch) => mutate((n) => {
        const u = byId(n.updates, updateId)
        const kpi = byId(n.kpis, u.kpiId)
        const before = fmtU(kpi, u) + ` (as of ${u.date})`
        const grant = n.editRequests.find((r) => r.updateId === updateId && r.status === 'granted')
        Object.assign(u, patch, { value: Number(patch.value ?? u.value), editedAt: nowISO() })
        log(n, { action: 'Result edited', goalId: kpi.goalId, kpiId: kpi.id, allocationId: u.allocationId, subject: unitName(n, byId(n.allocations, u.allocationId)), oldValue: before, newValue: fmtU(kpi, u) + ` (as of ${u.date})`, grantedBy: grant?.grantedBy })
      }),
      requestEdit: (updateId, reason) => mutate((n) => {
        const u = byId(n.updates, updateId)
        n.editRequests.unshift({ id: uid('er'), updateId, kpiId: u.kpiId, requestedBy: currentUserId(n), reason, requestedAt: nowISO(), status: 'pending' })
        log(n, { action: 'Edit requested', kpiId: u.kpiId, allocationId: u.allocationId, subject: staffName(n, currentUserId(n)), oldValue: '—', newValue: reason })
      }),
      grantEdit: (reqId, days) => mutate((n) => {
        const r = byId(n.editRequests, reqId)
        const u = byId(n.updates, r.updateId)
        const until = new Date(Date.now() + days * 86400000).toISOString()
        u.unlockedUntil = until
        Object.assign(r, { status: 'granted', grantedBy: currentUserId(n), grantedAt: nowISO(), grantedUntil: until })
        log(n, { action: 'Edit window extended', kpiId: r.kpiId, allocationId: u.allocationId, subject: staffName(n, r.requestedBy), oldValue: 'Locked', newValue: `Editable for ${days} day(s)`, grantedBy: currentUserId(n) })
      }),
      revertEdit: (reqId) => mutate((n) => {
        const r = byId(n.editRequests, reqId)
        const u = byId(n.updates, r.updateId)
        u.unlockedUntil = null
        Object.assign(r, { status: 'reverted', revertedAt: nowISO() })
        log(n, { action: 'Edit window reverted', kpiId: r.kpiId, allocationId: u.allocationId, subject: staffName(n, r.requestedBy), oldValue: 'Editable', newValue: 'Locked again', grantedBy: r.grantedBy })
      }),
      rejectEdit: (reqId) => mutate((n) => {
        const r = byId(n.editRequests, reqId)
        r.status = 'rejected'
        r.rejectedAt = nowISO()
        log(n, { action: 'Edit request rejected', kpiId: r.kpiId, subject: staffName(n, r.requestedBy), oldValue: 'Pending', newValue: 'Rejected' })
      }),

      // ---------- add a member to a running KPI ----------
      /**
       * plan = { parentAllocId, staffId, joinedDate, newPercent, percents: {allocId: newPct}, method, summary }
       * Existing achievements are never touched — only percentages / remaining targets change.
       */
      addMember: (plan) => mutate((n) => {
        const parent = byId(n.allocations, plan.parentAllocId)
        const kpi = byId(n.kpis, parent.kpiId)
        const period = byId(n.periods, parent.periodId)
        if (kpi.type === 'sum') for (const [aid, pct] of Object.entries(plan.percents || {})) byId(n.allocations, aid).percent = pct
        const id = uid('a')
        n.allocations.push({ id, kpiId: kpi.id, periodId: period.id, parentId: parent.id, level: 'individual', unitId: plan.staffId, percent: kpi.type === 'sum' ? plan.newPercent : null, target: 0, startDate: plan.joinedDate, endDate: parent.endDate, joinedDate: plan.joinedDate, createdAt: nowISO() })
        retarget(n, kpi, period, parent.id, parent.target)
        log(n, { action: `Member added (${plan.method})`, goalId: kpi.goalId, kpiId: kpi.id, allocationId: id, subject: `${staffName(n, plan.staffId)} → ${unitName(n, parent)}`, oldValue: plan.summary?.before || '—', newValue: plan.summary?.after || '—', note: `Target starts ${plan.joinedDate}. Existing achievements unchanged.` })
      }),

      // ---------- people leaving, moving or taken off a KPI ----------
      /**
       * plan = { staffId, date, reason: 'left' | 'moved' | 'removed', note,
       *          items: [{ allocId, mode: 'equal' | 'handover' | 'unallocated' | 'replace' | 'close', toStaffId }] }
       * What the person achieved stays in every total; only their unfinished target is moved.
       */
      memberLeaves: (plan) => mutate((n) => {
        const why = { left: 'Left Pahappa', moved: 'Moved to another team or role', removed: 'Taken off this KPI' }[plan.reason]
        const who = staffName(n, plan.staffId)
        for (const item of plan.items) {
          const a = byId(n.allocations, item.allocId)
          if (!a || a.leftDate) continue
          const kpi = byId(n.kpis, a.kpiId)
          const period = byId(n.periods, a.periodId)
          const parent = a.parentId ? byId(n.allocations, a.parentId) : null
          const parentTarget = parent ? parent.target : period.target
          const others = childAllocations(n, period.id, a.parentId).filter((s) => s.id !== a.id && s.level === 'individual' && !s.leftDate)
          const achieved = sum(allocationUpdates(n, a.id).filter((u) => u.date <= plan.date).map((u) => u.value))
          const before = kpi.type === 'sum' ? `${who} ${round(a.percent)}% · target ${money(kpi, Math.round(a.target))} · achieved ${money(kpi, Math.round(achieved))}` : `${who} counted in ${unitName(n, parent)}`
          a.leftDate = plan.date
          a.leftReason = plan.reason
          a.targetBeforeLeave = a.target
          a.endDate = plan.date
          const joined = minISO(addDays(plan.date, 1), period.endDate)
          const newMember = (pct, target) => {
            n.allocations.push({ id: uid('a'), kpiId: kpi.id, periodId: period.id, parentId: a.parentId, level: 'individual', unitId: item.toStaffId, percent: pct, target, startDate: joined, endDate: period.endDate, joinedDate: joined, replaces: a.id, createdAt: nowISO() })
          }
          let after
          if (kpi.type === 'sum') {
            const freed = Math.max(0, a.target - achieved)
            const fp = parentTarget ? (freed / parentTarget) * 100 : 0
            a.percent = Math.max(0, (a.percent || 0) - fp)
            let where = 'left unallocated'
            if (item.mode === 'equal' && others.length) {
              others.forEach((s) => { s.percent = (s.percent || 0) + fp / others.length })
              where = `shared equally by ${others.map((s) => staffName(n, s.unitId)).join(', ')}`
            } else if (item.mode === 'handover' && item.toStaffId) {
              const sib = others.find((s) => s.unitId === item.toStaffId)
              if (sib) sib.percent = (sib.percent || 0) + fp
              else newMember(fp, 0)
              where = `handed to ${staffName(n, item.toStaffId)}${sib ? '' : ` (joins ${joined})`}`
            }
            retarget(n, kpi, period, a.parentId, parentTarget)
            after = `${who} closed at ${money(kpi, Math.round(achieved))} (kept in totals). Unfinished ${money(kpi, Math.round(freed))} (${round(fp)}%) ${where}.`
          } else {
            if (item.mode === 'replace' && item.toStaffId) newMember(null, a.target)
            after = `${who} no longer counted from ${plan.date}${item.mode === 'replace' && item.toStaffId ? `; ${staffName(n, item.toStaffId)} takes over from ${joined}` : ''}. Past results kept in history.`
          }
          log(n, { action: `Member ${plan.reason === 'removed' ? 'removed' : plan.reason === 'moved' ? 'moved out' : 'left'}`, goalId: kpi.goalId, kpiId: kpi.id, allocationId: a.id, subject: `${who} → ${unitName(n, parent)}`, oldValue: before, newValue: after, note: [why, plan.note].filter(Boolean).join(' · ') })
        }
        if (plan.reason === 'left') {
          const s = byId(n.staff, plan.staffId)
          s.active = false
          s.leftDate = plan.date
          log(n, { action: 'Staff left', subject: who, oldValue: 'Active', newValue: `Left on ${plan.date}`, note: plan.note || '' })
        }
      }),

      // ---------- edit running goals and KPIs ----------
      editGoal: (id, patch, reason) => mutate((n) => {
        const g = byId(n.goals, id)
        const LBL = { name: 'Name', description: 'Description', startDate: 'Start', endDate: 'End' }
        const olds = []
        const news = []
        for (const k of Object.keys(LBL)) {
          if (patch[k] === undefined || patch[k] === g[k]) continue
          olds.push(`${LBL[k]}: ${g[k] || '—'}`)
          news.push(`${LBL[k]}: ${patch[k] || '—'}`)
          g[k] = patch[k]
        }
        // KPIs, their open periods and allocations never run past the goal
        for (const k of n.kpis.filter((x) => x.goalId === id)) {
          if (k.endDate > g.endDate) k.endDate = g.endDate
          const p = currentPeriod(n, k.id)
          if (p && p.status === 'open' && p.endDate > g.endDate) {
            p.endDate = g.endDate
            n.allocations.filter((a) => a.periodId === p.id && a.endDate > g.endDate).forEach((a) => { a.endDate = g.endDate })
          }
        }
        if (olds.length) log(n, { action: 'Goal edited', goalId: id, subject: g.name, oldValue: olds.join('; '), newValue: news.join('; '), note: reason })
      }),
      /** patch = { name, description, unit, startValue, target, endDate }; weights = { kpiId: weight } for every KPI of the goal */
      editKpi: (id, patch, weights, reason) => mutate((n) => {
        const k = byId(n.kpis, id)
        const p = currentPeriod(n, id)
        const olds = []
        const news = []
        const note = (lbl, o, v) => { olds.push(`${lbl}: ${o}`); news.push(`${lbl}: ${v}`) }
        for (const f of ['name', 'description', 'unit']) {
          if (patch[f] !== undefined && patch[f] !== k[f]) { note(f[0].toUpperCase() + f.slice(1), k[f] || '—', patch[f] || '—'); k[f] = patch[f] }
        }
        if (patch.startValue !== undefined && Number(patch.startValue) !== Number(k.startValue)) { note('Start value', k.startValue, patch.startValue); k.startValue = Number(patch.startValue) }
        if (patch.target !== undefined && k.type !== 'completion' && Number(patch.target) !== Number(p.target)) {
          note('Target', money(k, p.target), money(k, patch.target))
          p.target = Number(patch.target)
          k.target = p.target
          retarget(n, k, p, null, p.target)
        }
        if (patch.endDate && patch.endDate !== p.endDate) {
          note('End', p.endDate, patch.endDate)
          n.allocations.filter((a) => a.periodId === p.id && !a.leftDate && a.endDate === p.endDate).forEach((a) => { a.endDate = patch.endDate })
          p.endDate = patch.endDate
          k.endDate = patch.endDate
        }
        for (const [kid, w] of Object.entries(weights || {})) {
          const x = byId(n.kpis, kid)
          if (Number(w) !== Number(x.weight)) { note(`Contribution of ${x.name}`, `${x.weight}%`, `${w}%`); x.weight = Number(w) }
        }
        if (olds.length) log(n, { action: 'KPI edited', goalId: k.goalId, kpiId: id, subject: k.name, oldValue: olds.join('; '), newValue: news.join('; '), note: reason })
      }),
      /** Re-split the shares under one node of a running KPI, and/or add departments or teams to it. */
      editShares: ({ kpiId, parentAllocId = null, percents = {}, added = [], reason }) => mutate((n) => {
        const k = byId(n.kpis, kpiId)
        const p = currentPeriod(n, kpiId)
        const parent = parentAllocId ? byId(n.allocations, parentAllocId) : null
        const parentTarget = parent ? parent.target : p.target
        const desc = (list) => list.map((a) => `${unitName(n, a)}${k.type === 'sum' ? ` ${round(a.percent)}%` : ''}${a.leftDate ? ' (left)' : ''}`).join('; ') || 'none'
        const before = desc(childAllocations(n, p.id, parentAllocId))
        for (const [aid, pct] of Object.entries(percents)) byId(n.allocations, aid).percent = Number(pct)
        for (const u of added) {
          const d = u.joinedDate || todayISO()
          n.allocations.push({ id: uid('a'), kpiId, periodId: p.id, parentId: parentAllocId, level: u.level, unitId: u.unitId, percent: k.type === 'sum' ? Number(u.percent) : null, target: 0, startDate: d, endDate: p.endDate, joinedDate: d, createdAt: nowISO() })
        }
        retarget(n, k, p, parentAllocId, parentTarget)
        log(n, { action: added.length ? 'Shares changed, units added' : 'Shares changed', goalId: k.goalId, kpiId, subject: `${k.name} → ${parent ? unitName(n, parent) : 'organization level'}`, oldValue: before, newValue: desc(childAllocations(n, p.id, parentAllocId)), note: `${reason}. Achievements unchanged; targets recalculated.` })
      }),
      addKpi: (goalId, data, weights, reason) => mutate((n) => {
        const g = byId(n.goals, goalId)
        const unit = data.type === 'completion' ? '%' : data.unit
        const target = data.type === 'completion' ? 100 : Number(data.target)
        n.kpis.push({ ...data, goalId, unit, target, startValue: data.type === 'average' ? Number(data.startValue) : 0 })
        n.periods.push({ id: uid('p'), kpiId: data.id, index: 1, startDate: data.startDate, endDate: data.endDate, target, status: 'open' })
        for (const [kid, w] of Object.entries(weights)) byId(n.kpis, kid).weight = Number(w)
        log(n, { action: 'KPI added to goal', goalId, kpiId: data.id, subject: `${data.name} → ${g.name}`, oldValue: '—', newValue: `Target ${money({ unit }, target)}; weights ${Object.entries(weights).map(([kid, w]) => `${byId(n.kpis, kid).name} ${w}%`).join(', ')}`, note: reason })
      }),
      deleteKpi: (kpiId, weights, reason) => mutate((n) => {
        const k = byId(n.kpis, kpiId)
        const periodIds = new Set(n.periods.filter((p) => p.kpiId === kpiId).map((p) => p.id))
        n.allocations = n.allocations.filter((a) => !periodIds.has(a.periodId))
        n.periods = n.periods.filter((p) => p.kpiId !== kpiId)
        n.kpis = n.kpis.filter((x) => x.id !== kpiId)
        for (const [kid, w] of Object.entries(weights)) byId(n.kpis, kid).weight = Number(w)
        log(n, { action: 'KPI deleted', goalId: k.goalId, subject: k.name, oldValue: `Contribution ${k.weight}%, no results recorded`, newValue: 'Deleted', note: reason })
      }),

      // ---------- restart / reset ----------
      /** opts = { mode: 'restart' | 'newTarget', closeOn, newStart, newEnd, newTarget } */
      restartKpi: (kpiId, opts) => mutate((n) => {
        const kpi = byId(n.kpis, kpiId)
        const old = currentPeriod(n, kpiId)
        old.status = 'closed'
        old.closedAt = opts.closeOn
        old.closeReason = opts.mode === 'newTarget' ? `Target changed to ${opts.newTarget}` : 'End of KPI period'
        const target = kpi.type === 'completion' ? 100 : Number(opts.mode === 'newTarget' ? opts.newTarget : old.target)
        const np = { id: uid('p'), kpiId, index: kpiPeriods(n, kpiId).length + 1, startDate: opts.newStart, endDate: opts.newEnd, target, status: 'open' }
        n.periods.push(np)
        kpi.target = target
        // clone the allocation tree: same people, same percentages, empty results
        const clone = (oldParentId, newParentId) => {
          for (const a of childAllocations(n, old.id, oldParentId)) {
            const id = uid('a')
            n.allocations.push({ ...a, id, periodId: np.id, parentId: newParentId, startDate: np.startDate, endDate: np.endDate, joinedDate: np.startDate, createdAt: nowISO() })
            clone(a.id, id)
          }
        }
        clone(null, null)
        retarget(n, kpi, np, null, target)
        log(n, { action: opts.mode === 'newTarget' ? 'KPI restarted with new target' : 'KPI restarted', goalId: kpi.goalId, kpiId, subject: kpi.name, oldValue: `Period ${old.index} closed on ${old.closedAt} (target ${old.target})`, newValue: `Period ${np.index}: ${np.startDate} → ${np.endDate}, target ${target}` })
      }),
      resetPeriod: (kpiId) => mutate((n) => {
        const kpi = byId(n.kpis, kpiId)
        const p = currentPeriod(n, kpiId)
        const removed = n.updates.filter((u) => u.periodId === p.id)
        n.updates = n.updates.filter((u) => u.periodId !== p.id)
        log(n, { action: 'Period reset', goalId: kpi.goalId, kpiId, subject: `${kpi.name} — period ${p.index}`, oldValue: `${removed.length} recorded result(s)`, newValue: 'Cleared (period stays open)' })
      }),
    }
  }, [])

  const value = useMemo(() => ({ state, ...actions }), [state, actions])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

function money(kpi, v) {
  if (kpi.unit === 'UGX' || kpi.unit === 'USD') return `${kpi.unit} ${Number(v).toLocaleString()}`
  return `${Number(v).toLocaleString()}${kpi.unit === '%' ? '%' : ' ' + kpi.unit}`
}

function fmtU(kpi, u) {
  if (kpi.type === 'completion') return u.completion === 'full' ? 'Fully achieved' : u.completion === 'none' ? 'Not achieved' : `Partially (${u.value}%)`
  return `${kpi.type === 'sum' ? '+' : ''}${money(kpi, u.value)}`
}

export const useStore = () => useContext(StoreCtx)

export function useCurrentUser() {
  const { state } = useStore()
  return byId(state.staff, currentUserId(state))
}


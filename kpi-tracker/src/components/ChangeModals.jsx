// Changes to running work: a person leaving / moving / taken off a KPI, and editing running goals, KPIs and shares.
import { useMemo, useState } from 'react'
import { UserMinus, PencilLine, Plus, Trash2, Split, Info, ArrowRight } from 'lucide-react'
import { useStore } from '../store'
import { Modal, Field, NumInput, Seg, Alert, Avatar, Badge, useFeedback, navigate } from './ui'
import { valueLabel } from './KpiWidgets'
import { byId, childAllocations, nodeStats, unitName, allocationUpdates, currentPeriod, goalKpis, KPI_TYPES } from '../lib/calc'
import { fmtValue, fmtDate, round, sum, todayISO, minISO, maxISO, uid, UNITS } from '../lib/utils'

const REASONS = [
  { value: 'left', label: 'Left Pahappa', hint: 'Closes every KPI share they hold and marks them inactive.' },
  { value: 'moved', label: 'Moved team / role', hint: 'Closes their current KPI shares; add them to the new team with Add member.' },
  { value: 'removed', label: 'Off this KPI only', hint: 'Closes this one share. They stay on their other KPIs.' },
]

const achievedTo = (state, a, date) => sum(allocationUpdates(state, a.id).filter((u) => u.date <= date).map((u) => u.value))
const lastUpdateDate = (state, a) => allocationUpdates(state, a.id).map((u) => u.date).sort().slice(-1)[0]

// =====================================================================
// A person leaves, moves, or is taken off a KPI
// =====================================================================
export function LeaverModal({ staffId: presetStaff, allocId, onClose }) {
  const { state, memberLeaves } = useStore()
  const { toast } = useFeedback()
  const [staffId, setStaffId] = useState(presetStaff || '')
  const [reason, setReason] = useState(allocId ? 'removed' : 'left')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [modes, setModes] = useState({})
  const [toStaff, setToStaff] = useState({})
  const [tried, setTried] = useState(false)
  const person = byId(state.staff, staffId)

  // every live KPI share the person holds (or just the one picked on the tree)
  const items = useMemo(() => {
    const live = state.allocations.filter((a) => {
      if (a.level !== 'individual' || a.unitId !== staffId || a.leftDate) return false
      const p = byId(state.periods, a.periodId)
      const k = byId(state.kpis, a.kpiId)
      const g = k && byId(state.goals, k.goalId)
      return p?.status === 'open' && g && ['running', 'ready'].includes(g.status)
    })
    return reason === 'removed' && allocId ? live.filter((a) => a.id === allocId) : live
  }, [state, staffId, reason, allocId])

  const people = state.staff.filter((s) => s.active !== false && state.allocations.some((a) => a.unitId === s.id && a.level === 'individual' && !a.leftDate)).sort((a, b) => a.name.localeCompare(b.name))
  const latest = items.map((a) => lastUpdateDate(state, a)).filter(Boolean).sort().slice(-1)[0]
  const errors = []
  if (!person) errors.push('Choose the person.')
  if (!date) errors.push('Enter their last day.')
  if (date > todayISO()) errors.push('The last day cannot be in the future.')
  if (latest && date < latest) errors.push(`They recorded a result on ${fmtDate(latest)}; the last day must be on or after it.`)
  if (person && !items.length) errors.push(`${person.name} holds no running KPI share.`)

  const planFor = (a) => {
    const kpi = byId(state.kpis, a.kpiId)
    const period = byId(state.periods, a.periodId)
    const parent = a.parentId ? byId(state.allocations, a.parentId) : null
    const parentTarget = parent ? parent.target : period.target
    const others = childAllocations(state, period.id, a.parentId).filter((s) => s.id !== a.id && s.level === 'individual' && !s.leftDate)
    const isSum = kpi.type === 'sum'
    const defMode = isSum ? (others.length ? 'equal' : 'unallocated') : 'close'
    const mode = modes[a.id] || defMode
    const to = toStaff[a.id] || ''
    const achieved = achievedTo(state, a, date)
    const freed = isSum ? Math.max(0, a.target - achieved) : 0
    const fp = parentTarget ? (freed / parentTarget) * 100 : 0
    const deptId = parent?.level === 'team' ? byId(state.teams, parent.unitId)?.departmentId : parent?.unitId
    const inKpi = new Set(state.allocations.filter((x) => x.periodId === period.id && x.level === 'individual' && !x.leftDate).map((x) => x.unitId))
    const newcomers = state.staff.filter((s) => s.active !== false && s.id !== a.unitId && s.departmentId === deptId && !inKpi.has(s.id))
    const rows = []
    if (isSum) {
      const after = (s) => (mode === 'equal' && others.length ? (s.percent || 0) + fp / others.length : mode === 'handover' && s.unitId === to ? (s.percent || 0) + fp : s.percent || 0)
      rows.push({ id: a.id, name: person?.name, leaving: true, pct: a.percent, pct2: (a.percent || 0) - fp, achieved })
      for (const s of others) rows.push({ id: s.id, name: unitName(state, s), pct: s.percent, pct2: after(s), achieved: nodeStats(state, kpi, period, s).current })
      if (mode === 'handover' && to && !others.some((s) => s.unitId === to)) rows.push({ id: 'new', name: byId(state.staff, to)?.name, isNew: true, pct: 0, pct2: fp, achieved: 0 })
      rows.forEach((r) => { r.t = (parentTarget * (r.pct || 0)) / 100; r.t2 = (parentTarget * r.pct2) / 100 })
    }
    return { kpi, period, parent, parentTarget, others, newcomers, isSum, mode, to, achieved, freed, fp, rows }
  }
  const plans = items.map((a) => ({ a, ...planFor(a) }))
  for (const p of plans) if ((p.mode === 'handover' || p.mode === 'replace') && !p.to) errors.push(`${p.kpi.name}: choose who takes over.`)

  const save = () => {
    setTried(true)
    if (errors.length) return
    memberLeaves({ staffId, date, reason, note, items: plans.map((p) => ({ allocId: p.a.id, mode: p.mode, toStaffId: p.to || undefined })) })
    toast(reason === 'left' ? `${person.name} recorded as left. Achievements kept; ${plans.length} KPI share${plans.length > 1 ? 's' : ''} closed.` : reason === 'moved' ? `${person.name}'s shares closed. Add them to the new team with Add member.` : `${person.name} taken off ${plans[0].kpi.name}.`)
    onClose()
  }

  return (
    <Modal
      size="xl"
      title={allocId ? 'Remove a member from this KPI' : 'Record a leaver or a move'}
      sub="What they achieved stays in every total. Only the target they had not reached yet is moved."
      icon={<UserMinus size={20} />}
      onClose={onClose}
      footer={
        <>
          {tried && errors.length > 0 && <span className="small" style={{ color: 'var(--red)', marginRight: 'auto' }}>{errors[0]}</span>}
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn danger" onClick={save}><UserMinus size={16} /> {reason === 'left' ? 'Record leaver' : reason === 'moved' ? 'Close shares' : 'Remove from KPI'}</button>
        </>
      }
    >
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,0.8fr)' }}>
        <Field label="Person" required>
          {presetStaff ? (
            <div className="row gap-6" style={{ minHeight: 40 }}><Avatar name={person?.name} size="sm" /><div><div className="semi">{person?.name}</div><div className="tiny muted">{person?.title}</div></div></div>
          ) : (
            <select className="select" value={staffId} onChange={(e) => { setStaffId(e.target.value); setModes({}); setToStaff({}) }}>
              <option value="">Choose a person…</option>
              {people.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.title}</option>)}
            </select>
          )}
        </Field>
        <Field label="What happened" required hint={REASONS.find((r) => r.value === reason).hint}>
          <Seg value={reason} onChange={setReason} options={REASONS.filter((r) => r.value !== 'removed' || allocId).map((r) => ({ value: r.value, label: r.label }))} />
        </Field>
        <Field label="Last day" required hint={latest ? `Last result: ${fmtDate(latest)}` : 'No results yet'}>
          <input type="date" className="input" value={date} min={latest} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Note (optional)" style={{ marginTop: 12 }}>
        <input className="input" placeholder="e.g. Resigned; handover to Mark" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {person && plans.length > 0 && (
        <div className="col gap-12 mt-16">
          <div className="small semi">{plans.length} KPI share{plans.length > 1 ? 's' : ''} to close. Choose what happens to the unfinished part of each:</div>
          {plans.map((p) => (
            <div key={p.a.id} className="card">
              <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div className="spacer">
                  <div className="bold">{p.kpi.name} <span className="tiny muted">· {KPI_TYPES[p.kpi.type].label}</span></div>
                  <div className="tiny muted">{byId(state.goals, p.kpi.goalId)?.name} → {p.parent ? unitName(state, p.parent) : 'organization'}</div>
                </div>
                {p.isSum ? (
                  <div className="row gap-16 small">
                    <span><span className="muted">Target</span> <b>{valueLabel(p.kpi, p.a.target)}</b></span>
                    <span><span className="muted">Achieved by {fmtDate(date)}</span> <b style={{ color: 'var(--green)' }}>{valueLabel(p.kpi, p.achieved)}</b></span>
                    <span><span className="muted">Unfinished</span> <b style={{ color: 'var(--amber)' }}>{valueLabel(p.kpi, p.freed)} ({round(p.fp, 2)}%)</b></span>
                  </div>
                ) : <span className="small muted">Same benchmark for everyone; nothing to re-split.</span>}
              </div>
              <div className="card-body col gap-12">
                <div className="row wrap gap-12">
                  <Seg
                    value={p.mode}
                    onChange={(v) => setModes((m) => ({ ...m, [p.a.id]: v }))}
                    options={p.isSum
                      ? [
                          { value: 'equal', label: `Share equally (${p.others.length})`, disabled: !p.others.length },
                          { value: 'handover', label: 'Hand over to one person' },
                          { value: 'unallocated', label: 'Leave unallocated' },
                        ]
                      : [
                          { value: 'close', label: 'Just stop counting them' },
                          { value: 'replace', label: 'A replacement takes over' },
                        ]}
                  />
                  {(p.mode === 'handover' || p.mode === 'replace') && (
                    <select className={`select ${tried && !p.to ? 'invalid' : ''}`} style={{ width: 'auto', minWidth: 260 }} value={p.to} onChange={(e) => setToStaff((t) => ({ ...t, [p.a.id]: e.target.value }))}>
                      <option value="">Who takes over?</option>
                      {p.mode === 'handover' && p.others.length > 0 && (
                        <optgroup label={`Already in ${p.parent ? unitName(state, p.parent) : 'this KPI'}`}>
                          {p.others.map((s) => <option key={s.id} value={s.unitId}>{unitName(state, s)}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="New to this KPI (joins the next day)">
                        {p.newcomers.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.title}</option>)}
                      </optgroup>
                    </select>
                  )}
                </div>
                {p.isSum && (
                  <table className="table">
                    <thead><tr><th>Member</th><th className="right">Share now</th><th className="right">Share after</th><th className="right">Target after</th><th className="right">Achieved</th><th className="right">Still to do</th></tr></thead>
                    <tbody>
                      {p.rows.map((r) => {
                        const changed = Math.abs(r.pct2 - (r.pct || 0)) > 0.001
                        return (
                          <tr key={r.id} style={r.leaving ? { background: 'var(--red-bg)' } : r.isNew ? { background: 'var(--green-bg)' } : undefined}>
                            <td><div className="row gap-6"><Avatar name={r.name} size="sm" /><span className="semi small">{r.name}</span>{r.leaving && <Badge tone="red">leaving</Badge>}{r.isNew && <Badge tone="green">new</Badge>}</div></td>
                            <td className="right mono small">{round(r.pct || 0, 2)}%</td>
                            <td className="right mono small" style={{ fontWeight: changed ? 700 : 400, color: changed ? (r.pct2 > (r.pct || 0) ? 'var(--blue-700)' : 'var(--red)') : undefined }}>{round(r.pct2, 2)}%</td>
                            <td className="right mono small">{valueLabel(p.kpi, r.t2)}</td>
                            <td className="right mono small">{valueLabel(p.kpi, r.achieved)}</td>
                            <td className="right mono small">{r.leaving ? <span className="muted">closed</span> : valueLabel(p.kpi, Math.max(0, r.t2 - r.achieved))}</td>
                          </tr>
                        )
                      })}
                      {p.mode === 'unallocated' && (
                        <tr><td colSpan={6} className="small" style={{ color: 'var(--amber)' }}>{round(p.fp, 2)}% ({valueLabel(p.kpi, p.freed)}) of {p.parent ? unitName(state, p.parent) : 'the KPI'} becomes unallocated. Use Add member later to give it to someone.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
          <Alert>
            <b>{person.name}</b>'s results stay in the update history and count in the {plans.some((p) => p.isSum) ? 'team totals' : 'history'}. They no longer appear in rankings or scores{reason === 'left' ? ', and are hidden from staff pickers' : ''}. Every change is written to the audit log.
          </Alert>
        </div>
      )}
    </Modal>
  )
}

// =====================================================================
// Edit a running goal
// =====================================================================
export function EditGoalModal({ goal, onClose }) {
  const { state, editGoal } = useStore()
  const { toast } = useFeedback()
  const cycle = byId(state.cycles, goal.cycleId)
  const started = ['running', 'stopped'].includes(goal.status)
  const [f, setF] = useState({ name: goal.name, description: goal.description || '', startDate: goal.startDate, endDate: goal.endDate })
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const kpis = goalKpis(state, goal.id)
  const lastResult = state.updates.filter((u) => kpis.some((k) => k.id === u.kpiId)).map((u) => u.date).sort().slice(-1)[0]
  const minEnd = maxISO(f.startDate, lastResult)
  const shortened = kpis.filter((k) => (currentPeriod(state, k.id)?.endDate || k.endDate) > f.endDate)
  const err = {}
  if (!f.name.trim()) err.name = 'Name is required.'
  else if (state.goals.some((g) => g.id !== goal.id && g.cycleId === goal.cycleId && g.name.trim().toLowerCase() === f.name.trim().toLowerCase())) err.name = 'Another goal in this cycle has this name.'
  if (f.endDate < minEnd) err.endDate = lastResult && f.endDate < lastResult ? `Results exist up to ${fmtDate(lastResult)}.` : 'End must be after the start.'
  if (f.endDate > cycle.endDate || f.startDate < cycle.startDate) err.endDate = `Dates must stay within ${cycle.name}.`
  if (started && !reason.trim()) err.reason = 'Say why the running goal is changing.'
  const save = () => {
    setTried(true)
    if (Object.keys(err).length) return
    editGoal(goal.id, { ...f, name: f.name.trim() }, reason.trim())
    toast('Goal updated. The change is in the audit log.')
    onClose()
  }
  const e = (k) => (tried ? err[k] : undefined)
  return (
    <Modal title="Edit goal" sub={started ? 'The goal is running. Progress and results are not affected.' : undefined} icon={<PencilLine size={20} />} onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save changes</button></>}>
      <div className="col gap-12">
        <Field label="Goal name" required error={e('name')}><input className="input" value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} /></Field>
        <Field label="Description"><textarea className="textarea" value={f.description} onChange={(ev) => setF({ ...f, description: ev.target.value })} /></Field>
        <div className="grid g-2">
          <Field label="Start date" hint={started ? 'Fixed once the goal has started' : undefined}><input type="date" className="input" disabled={started} value={f.startDate} min={cycle.startDate} max={f.endDate} onChange={(ev) => setF({ ...f, startDate: ev.target.value })} /></Field>
          <Field label="End date" error={e('endDate')} hint={lastResult ? `Latest result ${fmtDate(lastResult)}` : undefined}><input type="date" className="input" value={f.endDate} min={minEnd} max={cycle.endDate} onChange={(ev) => setF({ ...f, endDate: ev.target.value })} /></Field>
        </div>
        <Field label="Goal type" hint="Fixed: the KPIs already use it. Each KPI keeps its own type."><input className="input" disabled value={KPI_TYPES[goal.type].label} /></Field>
        {shortened.length > 0 && <Alert tone="warn">{shortened.map((k) => k.name).join(', ')} will also end on {fmtDate(f.endDate)} (KPIs never run past their goal).</Alert>}
        <Field label="Reason for the change" required={started} error={e('reason')}><input className="input" placeholder="e.g. Board extended the goal to Q1" value={reason} onChange={(ev) => setReason(ev.target.value)} /></Field>
      </div>
    </Modal>
  )
}

// shared: KPI weights inside a goal
function WeightsEditor({ rows, weights, setWeights, error }) {
  const total = sum(rows.map((r) => Number(weights[r.id]) || 0))
  return (
    <div>
      <div className="row mb-8"><span className="label spacer">Contribution to the goal (must add up to 100%)</span><Badge tone={Math.abs(total - 100) < 0.05 ? 'green' : 'red'}>Total {round(total, 2)}%</Badge>
        <button className="btn ghost xs" onClick={() => setWeights(Object.fromEntries(rows.map((r) => [r.id, round(100 / rows.length, 2)])))}>Split equally</button></div>
      <div className="col gap-6">
        {rows.map((r) => (
          <div key={r.id} className="row small">
            <span className="spacer">{r.name}{r.isNew && <Badge tone="green">new</Badge>}</span>
            <div className="input-group" style={{ width: 110 }}><NumInput className="input sm pr" value={weights[r.id]} onChange={(v) => setWeights({ ...weights, [r.id]: v })} /><span className="addon">%</span></div>
          </div>
        ))}
      </div>
      {error && <div className="tiny mt-4" style={{ color: 'var(--red)' }}>{error}</div>}
    </div>
  )
}

// =====================================================================
// Edit a running KPI (in the same period — no restart)
// =====================================================================
export function EditKpiModal({ kpi, onClose }) {
  const { state, editKpi, deleteKpi } = useStore()
  const { toast, confirm } = useFeedback()
  const goal = byId(state.goals, kpi.goalId)
  const period = currentPeriod(state, kpi.id)
  const siblings = goalKpis(state, goal.id)
  const hasResults = state.updates.some((u) => u.kpiId === kpi.id)
  const lastResult = state.updates.filter((u) => u.periodId === period.id).map((u) => u.date).sort().slice(-1)[0]
  const running = goal.status === 'running'
  const [f, setF] = useState({ name: kpi.name, description: kpi.description || '', unit: kpi.unit, startValue: kpi.startValue, target: period.target, endDate: period.endDate })
  const [weights, setWeights] = useState(Object.fromEntries(siblings.map((k) => [k.id, k.weight])))
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const newT = Number(f.target) || 0
  const tops = childAllocations(state, period.id, null)
  const err = {}
  if (!f.name.trim()) err.name = 'Name is required.'
  if (kpi.type !== 'completion' && !(newT > 0) && kpi.type === 'sum') err.target = 'Target must be above 0.'
  if (kpi.type === 'average' && Number(f.target) === Number(f.startValue)) err.target = 'Target must differ from the start value.'
  const minEnd = maxISO(period.startDate, lastResult)
  if (f.endDate < minEnd || f.endDate > goal.endDate) err.endDate = `Between ${fmtDate(minEnd)} and the goal end ${fmtDate(goal.endDate)}.`
  if (Math.abs(sum(siblings.map((k) => Number(weights[k.id]) || 0)) - 100) > 0.05) err.weights = 'KPI contributions must add up to 100%.'
  if (running && !reason.trim()) err.reason = 'Say why the running KPI is changing.'
  const targetChanged = kpi.type !== 'completion' && newT !== Number(period.target)

  const save = () => {
    setTried(true)
    if (Object.keys(err).length) return
    editKpi(kpi.id, { ...f, name: f.name.trim() }, weights, reason.trim())
    toast('KPI updated. Targets below were recalculated; achievements unchanged.')
    onClose()
  }
  const doDelete = async () => {
    const rest = siblings.filter((k) => k.id !== kpi.id)
    const tw = sum(rest.map((k) => k.weight)) || rest.length
    const w = Object.fromEntries(rest.map((k) => [k.id, round(((k.weight || 1) / tw) * 100, 2)]))
    if (await confirm({ title: `Delete “${kpi.name}”?`, message: `It has no results. Its shares are removed and the other KPIs' contributions are rebalanced: ${rest.map((k) => `${k.name} ${w[k.id]}%`).join(', ')}.`, okLabel: 'Delete KPI', danger: true })) {
      deleteKpi(kpi.id, w, reason.trim() || 'Deleted before any result was recorded')
      toast('KPI deleted.', 'warn')
      onClose()
      navigate(`/goals/${goal.id}`)
    }
  }
  const e = (k) => (tried ? err[k] : undefined)
  return (
    <Modal size="lg" title="Edit KPI" sub="Changes apply to the current period. Shares (%) are kept, and every target below is recalculated. Achievements never change." icon={<PencilLine size={20} />} onClose={onClose}
      footer={
        <>
          {siblings.length > 1 && <button className="btn ghost" style={{ marginRight: 'auto', color: hasResults ? undefined : 'var(--red)' }} disabled={hasResults} title={hasResults ? 'KPIs with results cannot be deleted. Stop the goal or restart the KPI instead.' : ''} onClick={doDelete}><Trash2 size={15} /> Delete KPI</button>}
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save changes</button>
        </>
      }>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="col gap-12">
          <Field label="KPI name" required error={e('name')}><input className="input" value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} /></Field>
          <Field label="Description"><input className="input" value={f.description} onChange={(ev) => setF({ ...f, description: ev.target.value })} /></Field>
          <div className="grid g-2">
            <Field label="Type" hint="Fixed once created"><input className="input" disabled value={KPI_TYPES[kpi.type].label} /></Field>
            <Field label="Unit" hint={hasResults ? 'Fixed: results are recorded in it' : undefined}>
              <select className="select" disabled={hasResults || kpi.type === 'completion'} value={f.unit} onChange={(ev) => setF({ ...f, unit: ev.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            </Field>
          </div>
          <div className="grid g-2">
            {kpi.type === 'average' && <Field label="Start value"><NumInput className="input" value={f.startValue} onChange={(v) => setF({ ...f, startValue: v })} /></Field>}
            {kpi.type !== 'completion' && <Field label={`Target (${f.unit})`} error={e('target')}><NumInput className="input" value={f.target} onChange={(v) => setF({ ...f, target: v })} /></Field>}
            <Field label="Period end" error={e('endDate')}><input type="date" className="input" value={f.endDate} min={minEnd} max={goal.endDate} onChange={(ev) => setF({ ...f, endDate: ev.target.value })} /></Field>
          </div>
          {targetChanged && kpi.type === 'sum' && (
            <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
              <div className="small semi mb-8">New targets (shares unchanged)</div>
              {tops.map((d) => (
                <div key={d.id} className="row small"><span className="spacer">{unitName(state, d)} · {round(d.percent, 2)}%</span><span className="muted">{valueLabel(kpi, d.target)}</span><ArrowRight size={13} /><b>{fmtValue(f.unit, (newT * d.percent) / 100)}</b></div>
              ))}
              <div className="tiny muted mt-8">Use <b>New target</b> instead if the old period should be closed and kept as history.</div>
            </div>
          )}
          {targetChanged && kpi.type === 'average' && <Alert>Everyone carrying this KPI moves to the new benchmark of {f.target}{f.unit === '%' ? '%' : ` ${f.unit}`}.</Alert>}
        </div>
        <div className="col gap-12">
          <WeightsEditor rows={siblings.map((k) => ({ id: k.id, name: k.name }))} weights={weights} setWeights={setWeights} error={e('weights')} />
          <Field label="Reason for the change" required={running} error={e('reason')}><textarea className="textarea" placeholder="e.g. Target raised after the Q3 review" value={reason} onChange={(ev) => setReason(ev.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  )
}

// =====================================================================
// Add a KPI to a running goal
// =====================================================================
export function AddKpiModal({ goal, onClose }) {
  const { state, addKpi } = useStore()
  const { toast } = useFeedback()
  const siblings = goalKpis(state, goal.id)
  const [id] = useState(uid('k'))
  const [f, setF] = useState({ name: '', description: '', type: goal.type, unit: goal.type === 'sum' ? 'UGX' : '%', startValue: '', target: goal.type === 'completion' ? 100 : '', startDate: maxISO(goal.startDate, minISO(todayISO(), goal.endDate)), endDate: goal.endDate })
  const all = [...siblings.map((k) => ({ id: k.id, name: k.name })), { id, name: f.name || 'New KPI', isNew: true }]
  const [weights, setWeights] = useState(Object.fromEntries(all.map((r) => [r.id, round(100 / all.length, 2)])))
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const err = {}
  if (!f.name.trim()) err.name = 'Name is required.'
  else if (siblings.some((k) => k.name.trim().toLowerCase() === f.name.trim().toLowerCase())) err.name = 'This goal already has a KPI with that name.'
  if (f.type !== 'completion' && !(Number(f.target) > 0) && f.type === 'sum') err.target = 'Enter the organization target.'
  if (f.type === 'average' && (f.startValue === '' || f.target === '' || Number(f.startValue) === Number(f.target))) err.target = 'Enter a start value and a different target.'
  if (!f.startDate || !f.endDate || f.endDate < f.startDate || f.startDate < goal.startDate || f.endDate > goal.endDate) err.dates = `Dates must be within the goal (${fmtDate(goal.startDate)} – ${fmtDate(goal.endDate)}).`
  if (Math.abs(sum(all.map((r) => Number(weights[r.id]) || 0)) - 100) > 0.05) err.weights = 'Contributions must add up to 100%.'
  if (goal.status === 'running' && !reason.trim()) err.reason = 'Say why a KPI is added to a running goal.'
  const save = () => {
    setTried(true)
    if (Object.keys(err).length) return
    addKpi(goal.id, { id, name: f.name.trim(), description: f.description, type: f.type, unit: f.unit, startValue: f.startValue, target: f.target, weight: Number(weights[id]), startDate: f.startDate, endDate: f.endDate }, Object.fromEntries(siblings.map((k) => [k.id, weights[k.id]])), reason.trim())
    toast('KPI added. Now share it: use “Edit shares” on the organization row.')
    onClose()
    navigate(`/kpis/${id}`)
  }
  const e = (k) => (tried ? err[k] : undefined)
  return (
    <Modal size="lg" title={`Add a KPI to “${goal.name}”`} sub="It starts with no shares; share it with departments on the KPI page." icon={<Plus size={20} />} onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Plus size={16} /> Add KPI</button></>}>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="col gap-12">
          <Field label="KPI name" required error={e('name')}><input className="input" autoFocus value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} /></Field>
          <div className="grid g-2">
            <Field label="Type" hint="Set by the goal"><input className="input" disabled value={`🔒 ${KPI_TYPES[goal.type].label}`} /></Field>
            <Field label="Unit"><select className="select" disabled={f.type === 'completion'} value={f.unit} onChange={(ev) => setF({ ...f, unit: ev.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
          </div>
          {f.type !== 'completion' && (
            <div className="grid g-2">
              {f.type === 'average' && <Field label="Start value"><NumInput className="input" value={f.startValue} onChange={(v) => setF({ ...f, startValue: v })} /></Field>}
              <Field label="Organization target" required error={e('target')}><NumInput className="input" value={f.target} onChange={(v) => setF({ ...f, target: v })} /></Field>
            </div>
          )}
          <div className="grid g-2">
            <Field label="Start" error={e('dates')}><input type="date" className="input" value={f.startDate} min={goal.startDate} max={goal.endDate} onChange={(ev) => setF({ ...f, startDate: ev.target.value })} /></Field>
            <Field label="End"><input type="date" className="input" value={f.endDate} min={f.startDate} max={goal.endDate} onChange={(ev) => setF({ ...f, endDate: ev.target.value })} /></Field>
          </div>
        </div>
        <div className="col gap-12">
          <WeightsEditor rows={all} weights={weights} setWeights={setWeights} error={e('weights')} />
          <Field label="Reason" required={goal.status === 'running'} error={e('reason')}><textarea className="textarea" placeholder="e.g. Management added a client-retention measure" value={reason} onChange={(ev) => setReason(ev.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  )
}

// =====================================================================
// Re-split shares under a node of a running KPI, or add departments / teams
// =====================================================================
export function EditSharesModal({ kpi, parent, onClose }) {
  const { state, editShares } = useStore()
  const { toast } = useFeedback()
  const period = currentPeriod(state, kpi.id)
  const isSum = kpi.type === 'sum'
  const parentTarget = parent ? parent.target : period.target
  const kids = childAllocations(state, period.id, parent ? parent.id : null)
  const active = kids.filter((a) => !a.leftDate)
  const closed = kids.filter((a) => a.leftDate)
  const [pcts, setPcts] = useState(Object.fromEntries(active.map((a) => [a.id, round(a.percent || 0, 4)])))
  const [added, setAdded] = useState([])
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  // units that can be added at this level
  const present = new Set(kids.map((a) => a.unitId))
  const addable = !parent
    ? state.departments.filter((d) => !present.has(d.id)).map((d) => ({ level: 'department', unitId: d.id, name: d.name }))
    : parent.level === 'department'
      ? state.teams.filter((t) => t.departmentId === parent.unitId && !present.has(t.id)).map((t) => ({ level: 'team', unitId: t.id, name: t.name }))
      : []
  const total = sum(Object.values(pcts).map(Number)) + sum(added.map((u) => Number(u.percent) || 0)) + sum(closed.map((a) => a.percent || 0))
  const err = []
  if (isSum && total > 100.0001) err.push(`Shares add up to ${round(total, 2)}%; the most is 100%.`)
  if (isSum && added.some((u) => !(Number(u.percent) > 0))) err.push('Give every added unit a share.')
  if (!reason.trim()) err.push('Say why the shares are changing.')
  const changed = Object.entries(pcts).some(([aid, v]) => Math.abs(Number(v) - (byId(state.allocations, aid).percent || 0)) > 0.0001) || added.length > 0
  const save = () => {
    setTried(true)
    if (err.length || !changed) return
    const percents = Object.fromEntries(Object.entries(pcts).filter(([aid, v]) => Math.abs(Number(v) - (byId(state.allocations, aid).percent || 0)) > 0.0001))
    editShares({ kpiId: kpi.id, parentAllocId: parent ? parent.id : null, percents, added, reason: reason.trim() })
    toast('Shares updated. Targets recalculated; achievements unchanged.')
    onClose()
  }
  const where = parent ? unitName(state, parent) : `${state.settings.orgName} (organization)`
  return (
    <Modal size="lg" title={`Edit shares — ${where}`} sub={`${kpi.name} · ${isSum ? `target ${valueLabel(kpi, parentTarget)} to share` : 'same benchmark for everyone'}`} icon={<Split size={20} />} onClose={onClose}
      footer={
        <>
          {tried && (err.length > 0 || !changed) && <span className="small" style={{ color: 'var(--red)', marginRight: 'auto' }}>{err[0] || 'Nothing changed yet.'}</span>}
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save shares</button>
        </>
      }>
      <table className="table">
        <thead><tr><th>{parent ? (parent.level === 'department' ? 'Team / member' : 'Member') : 'Department'}</th>{isSum && <><th className="right" style={{ width: 120 }}>Share</th><th className="right">Target now</th><th className="right">Target after</th></>}<th className="right">Achieved</th>{isSum && <th className="right">Still to do</th>}</tr></thead>
        <tbody>
          {active.map((a) => {
            const t2 = (parentTarget * (Number(pcts[a.id]) || 0)) / 100
            const ach = nodeStats(state, kpi, period, a).current
            return (
              <tr key={a.id}>
                <td className="semi small">{unitName(state, a)} <span className="tiny muted">· {a.level === 'individual' ? 'person' : a.level}</span></td>
                {isSum && (
                  <>
                    <td className="right"><div className="input-group" style={{ width: 110, marginLeft: 'auto' }}><NumInput className="input sm pr" value={pcts[a.id]} onChange={(v) => setPcts({ ...pcts, [a.id]: v })} /><span className="addon">%</span></div></td>
                    <td className="right mono small muted">{valueLabel(kpi, a.target)}</td>
                    <td className="right mono small bold">{valueLabel(kpi, t2)}</td>
                  </>
                )}
                <td className="right mono small">{valueLabel(kpi, ach)}</td>
                {isSum && <td className="right mono small">{t2 < ach ? <Badge tone="green">exceeded</Badge> : valueLabel(kpi, t2 - ach)}</td>}
              </tr>
            )
          })}
          {closed.map((a) => (
            <tr key={a.id} style={{ opacity: 0.6 }}>
              <td className="small">{unitName(state, a)} <Badge tone="gray">left {fmtDate(a.leftDate)}</Badge></td>
              {isSum && <><td className="right mono small">{round(a.percent, 2)}%</td><td className="right mono small" colSpan={2}>fixed at what they achieved</td></>}
              <td className="right mono small">{valueLabel(kpi, nodeStats(state, kpi, period, a).current)}</td>
              {isSum && <td />}
            </tr>
          ))}
          {added.map((u, i) => (
            <tr key={u.unitId} style={{ background: 'var(--green-bg)' }}>
              <td className="semi small">{u.name} <Badge tone="green">new</Badge> <button className="link-btn tiny" onClick={() => setAdded(added.filter((_, j) => j !== i))}>remove</button></td>
              {isSum && (
                <>
                  <td className="right"><div className="input-group" style={{ width: 110, marginLeft: 'auto' }}><NumInput className="input sm pr" value={u.percent} onChange={(v) => setAdded(added.map((x, j) => (j === i ? { ...x, percent: v } : x)))} /><span className="addon">%</span></div></td>
                  <td className="right muted small">—</td>
                  <td className="right mono small bold">{valueLabel(kpi, (parentTarget * (Number(u.percent) || 0)) / 100)}</td>
                </>
              )}
              <td className="right muted small">—</td>
              {isSum && <td />}
            </tr>
          ))}
        </tbody>
        {isSum && (
          <tfoot><tr><td>Shared</td><td className="right" style={{ color: total > 100.0001 ? 'var(--red)' : 'inherit' }}>{round(total, 2)}%</td><td colSpan={4} className="small muted">{total < 99.99 ? `${round(100 - total, 2)}% (${valueLabel(kpi, (parentTarget * (100 - total)) / 100)}) stays unallocated` : 'fully shared'}</td></tr></tfoot>
        )}
      </table>
      <div className="row wrap gap-8 mt-12">
        {addable.filter((u) => !added.some((x) => x.unitId === u.unitId)).map((u) => (
          <button key={u.unitId} className="btn soft sm" onClick={() => setAdded([...added, { ...u, percent: isSum ? round(Math.max(0, 100 - total), 2) : null, joinedDate: todayISO() }])}><Plus size={14} /> Add {u.name}</button>
        ))}
        {parent && parent.level !== 'department' && <span className="tiny muted"><Info size={12} /> To add a person use <b>Add member</b>; to take someone off use <b>Remove</b> on their row.</span>}
      </div>
      <Field label="Reason" required style={{ marginTop: 14 }} error={tried && !reason.trim() ? 'Required' : undefined}><input className="input" placeholder="e.g. Team B took over the government accounts" value={reason} onChange={(ev) => setReason(ev.target.value)} /></Field>
    </Modal>
  )
}

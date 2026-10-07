import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Target, Building2, UsersRound, User, UserPlus, UserMinus, PencilLine, ArrowRight, Equal, SlidersHorizontal, RotateCcw, Search, CheckCircle2, XCircle, CircleDashed } from 'lucide-react'
import { useStore } from '../store'
import DepthControl, { RANK } from './DepthControl'
import { Modal, Field, NumInput, Seg, Alert, Badge, Progress, Avatar, useFeedback, navigate, toneFor, ScoreDot } from './ui'
import { byId, childAllocations, nodeStats, unitName, allocationUpdates, kpiStart, periodTarget, progressOf } from '../lib/calc'
import { fmtValue, fmtPct, fmtDate, fmtShortDate, round, sum, todayISO, addDays, daysBetween, minISO, maxISO, parseISO } from '../lib/utils'

const LVL_ICON = { organization: Target, department: Building2, team: UsersRound, individual: User }

export function valueLabel(kpi, v) {
  if (kpi.type === 'completion') return `${round(v, 0)}%`
  return fmtValue(kpi.unit, v)
}

// =====================================================================
// Allocation tree with live progress at every node
// =====================================================================
export function AllocationTree({ kpi, period, goal, canManage, canUpdate, onAddMember, onUpdate, onRemove, onEditShares, canEditShares, defaultDepth = 2 }) {
  const { state } = useStore()
  const [collapsed, setCollapsed] = useState({})
  const [depthTo, setDepthTo] = useState(null)
  const open = period.status === 'open' && goal.status === 'running'
  const collapsedAt = (id, level, depth) => collapsed[id] ?? (depthTo ? RANK[level] >= RANK[depthTo] : depth >= defaultDepth + 1)
  const editable = period.status === 'open' && ['running', 'ready'].includes(goal.status)
  const rows = []
  const walk = (alloc, depth) => {
    const stats = nodeStats(state, kpi, period, alloc)
    const kids = childAllocations(state, period.id, alloc ? alloc.id : null)
    const id = alloc ? alloc.id : 'root'
    rows.push({ alloc, depth, stats, kids, id })
    const isCollapsed = collapsedAt(id, alloc ? alloc.level : 'organization', depth)
    if (!isCollapsed) for (const k of kids) walk(k, depth + 1)
  }
  walk(null, 0)
  const unit = kpi.type === 'completion' ? '%' : kpi.unit

  return (
    <div className="scroll-x">
      <div className="row" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <DepthControl value={depthTo || (defaultDepth >= 3 ? 'individual' : 'team')} onChange={(v) => { setDepthTo(v); setCollapsed({}) }} levels={['organization', 'department', 'team', 'individual']} />
      </div>
      <div style={{ minWidth: 820 }}>
        <div className="tree-row head">
          <div>Organization → department → team → person</div>
          <div className="right">Share</div>
          <div className="right">Target</div>
          <div className="right">Achieved</div>
          <div>Progress</div>
          <div />
        </div>
        {rows.map(({ alloc, depth, stats, kids, id }) => {
          const level = alloc ? alloc.level : 'organization'
          const Icon = LVL_ICON[level]
          const isCollapsed = collapsedAt(id, alloc ? alloc.level : 'organization', depth)
          const allocated = kpi.type === 'sum' ? sum(kids.map((k) => k.percent || 0)) : null
          const person = level === 'individual' ? byId(state.staff, alloc.unitId) : null
          const late = alloc && alloc.joinedDate && alloc.joinedDate > period.startDate
          return (
            <div key={id} className={`tree-row ${alloc?.leftDate ? 'left' : ''}`}>
              <div className="tree-name" style={{ paddingLeft: depth * 22 }}>
                {kids.length ? (
                  <button className="tree-toggle" onClick={() => setCollapsed((c) => ({ ...c, [id]: !isCollapsed }))}>
                    {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  </button>
                ) : (
                  <span style={{ width: 22 }} />
                )}
                {person ? <Avatar name={person.name} size="sm" /> : <span className={`lvl ${level}`}><Icon size={14} /></span>}
                <div style={{ minWidth: 0 }}>
                  <div className={depth === 0 ? 'bold' : 'semi'} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {alloc ? <a href={`#/kpis/${kpi.id}/${alloc.id}`} className="tree-link" title="Open this KPI share">{unitName(state, alloc)}</a> : `${state.settings.orgName} — ${kpi.name}`}
                  </div>
                  <div className="tiny muted row gap-4">
                    {level === 'individual' ? person?.title : level === 'organization' ? 'Organization' : `${level[0].toUpperCase()}${level.slice(1)}`}
                    {allocated !== null && kids.length > 0 && allocated < 99.99 && <span style={{ color: 'var(--amber)' }}>· {round(100 - allocated, 2)}% unallocated</span>}
                    {late && <span className="badge violet" style={{ padding: '0 6px' }}>joined {fmtShortDate(alloc.joinedDate)}</span>}
                    {alloc?.leftDate && <span className="badge red" style={{ padding: '0 6px' }}>{alloc.leftReason === 'left' ? 'left' : alloc.leftReason === 'moved' ? 'moved' : 'removed'} {fmtShortDate(alloc.leftDate)}</span>}
                  </div>
                </div>
              </div>
              <div className="right mono">{alloc ? (kpi.type === 'sum' ? fmtPct(alloc.percent, 2) : <span className="muted small">same</span>) : '100%'}</div>
              <div className="right mono semi">{kpi.type === 'completion' ? 'Full' : valueLabel(kpi, stats.target)}</div>
              <div className="right mono">{stats.hasData || kpi.type === 'sum' ? valueLabel(kpi, stats.current) : <span className="muted">—</span>}</div>
              {alloc?.leftDate && level === 'individual' ? (
                <div className="tiny muted">closed{kpi.type === 'sum' && alloc.targetBeforeLeave ? ` · had ${valueLabel(kpi, alloc.targetBeforeLeave)} (${fmtPct((stats.current / alloc.targetBeforeLeave) * 100, 0)} done)` : ' · no longer counted'}</div>
              ) : (
                <div><ScoreDot value={stats.progress} size="sm" /></div>
              )}
              <div className="right row gap-4" style={{ justifyContent: 'flex-end' }}>
                {editable && onEditShares && (alloc ? canManage && (level === 'team' || level === 'department') : canEditShares) && (kpi.type === 'sum' || level !== 'team') && (
                  <button className="btn ghost xs" onClick={() => onEditShares(alloc)} title={kpi.type === 'sum' ? 'Change the shares below this row' : 'Add departments or teams'}>
                    <SlidersHorizontal size={13} /> {kpi.type === 'sum' ? 'Edit shares' : 'Add units'}
                  </button>
                )}
                {open && canManage && alloc && (level === 'team' || level === 'department') && (
                  <button className="btn soft xs" onClick={() => onAddMember(alloc)} title="Add a member to this group">
                    <UserPlus size={13} /> Add member
                  </button>
                )}
                {open && canManage && onRemove && level === 'individual' && !alloc.leftDate && (
                  <button className="btn ghost xs" style={{ color: 'var(--red)' }} onClick={() => onRemove(alloc)} title="Remove from this KPI, or record that they left">
                    <UserMinus size={13} /> Remove
                  </button>
                )}
                {open && level === 'individual' && !alloc.leftDate && canUpdate(alloc) && kids.length === 0 && (
                  <button className="btn secondary xs" onClick={() => onUpdate(alloc)}>
                    <PencilLine size={13} /> Update
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================================
// Update a result (no fixed frequency — just a date and a value)
// =====================================================================
export function UpdateModal({ alloc, update, onClose }) {
  const { state, addUpdate, editUpdate } = useStore()
  const { toast } = useFeedback()
  const kpi = byId(state.kpis, alloc.kpiId)
  const period = byId(state.periods, alloc.periodId)
  const presets = state.settings.partialPresets
  const ups = allocationUpdates(state, alloc.id)
  const last = ups[ups.length - 1]
  const minDate = maxISO(alloc.joinedDate, alloc.startDate, period.startDate)
  const maxDate = minISO(todayISO(), period.endDate, alloc.endDate)
  const [date, setDate] = useState(update?.date || maxDate)
  const [value, setValue] = useState(update ? update.value : '')
  const [completion, setCompletion] = useState(update?.completion || '')
  const editingOdd = update?.completion === 'partial' && !presets.includes(Number(update.value))
  const [partial, setPartial] = useState(update?.completion === 'partial' ? (editingOdd ? 'other' : update.value) : presets[1] ?? presets[0])
  const [otherPct, setOtherPct] = useState(editingOdd ? update.value : '')
  const [comment, setComment] = useState(update?.comment ?? update?.reason ?? '')
  const [tried, setTried] = useState(false)

  const target = kpi.type === 'sum' ? alloc.target : periodTarget(kpi, period)
  const start = kpiStart(kpi)
  const finalValue = kpi.type === 'completion' ? (completion === 'full' ? 100 : completion === 'partial' ? (partial === 'other' ? Number(otherPct) : Number(partial)) : completion === 'none' ? 0 : null) : value === '' ? null : Number(value)
  // Sum: the entry is what was achieved since the previous update; it is added to the running total.
  const isSumKpi = kpi.type === 'sum'
  const totalBefore = isSumKpi ? sum(ups.filter((u) => u.id !== update?.id).map((u) => u.value)) : 0
  const newTotal = isSumKpi && finalValue !== null ? totalBefore + finalValue : null
  const preview = finalValue === null ? null : progressOf(isSumKpi ? newTotal : finalValue, start, target)

  const errs = {}
  if (!date) errs.date = 'Pick the date this result is for.'
  else if (date > todayISO()) errs.date = 'Future dates are not allowed.'
  else if (date < minDate) errs.date = `Can't be before ${fmtDate(minDate)} (start of this assignment).`
  else if (date > maxDate) errs.date = `Can't be after ${fmtDate(maxDate)}.`
  if (kpi.type === 'completion') {
    if (!completion) errs.value = 'Choose Fully, Partially or Not achieved.'
    if (completion === 'none' && !comment.trim()) errs.comment = 'Explain why it was not achieved.'
    if (completion === 'partial' && partial === 'other' && !(Number(otherPct) >= 1 && Number(otherPct) <= 99)) errs.partial = 'Enter a percentage between 1 and 99.'
  } else if (value === '' || Number(value) < 0) errs.value = 'Enter a value of 0 or more.'

  const save = () => {
    setTried(true)
    if (Object.keys(errs).length) return
    const payload = { date, value: finalValue, completion: kpi.type === 'completion' ? completion : undefined, comment: comment.trim() || undefined }
    if (update) editUpdate(update.id, payload)
    else addUpdate({ allocationId: alloc.id, ...payload })
    const chain = []
    let p = alloc.parentId && byId(state.allocations, alloc.parentId)
    while (p) {
      chain.push(unitName(state, p))
      p = p.parentId && byId(state.allocations, p.parentId)
    }
    chain.push(state.settings.orgName)
    toast(`Saved. Progress recalculated for ${chain.join(', ')}.`)
    onClose()
  }

  return (
    <Modal
      title={update ? 'Edit result' : 'Update result'}
      sub={`${kpi.name} · ${unitName(state, alloc)}`}
      icon={<PencilLine size={20} />}
      onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>{update ? 'Save changes' : 'Save result'}</button></>}
    >
      <div className="grid g-3 mb-16">
        <div className="card card-pad" style={{ padding: 12 }}><div className="tiny muted">Target</div><div className="bold">{kpi.type === 'completion' ? 'Fully achieved' : valueLabel(kpi, target)}</div></div>
        {isSumKpi ? (
          <div className="card card-pad" style={{ padding: 12 }}><div className="tiny muted">{update ? 'Total from other updates' : 'Achieved so far'}</div><div className="bold">{valueLabel(kpi, totalBefore)}</div><div className="tiny muted">{last ? `last update ${fmtDate(last.date)}` : 'no results yet'}</div></div>
        ) : (
          <div className="card card-pad" style={{ padding: 12 }}><div className="tiny muted">Last recorded</div><div className="bold">{last ? `${valueLabel(kpi, last.value)}` : '—'}</div><div className="tiny muted">{last ? fmtDate(last.date) : 'no results yet'}</div></div>
        )}
        <div className="card card-pad" style={{ padding: 12 }}><div className="tiny muted">Progress after save</div><div className="bold" style={{ color: 'var(--blue-700)' }}>{preview === null ? '—' : fmtPct(preview, 1)}</div></div>
      </div>
      <div className="col gap-16">
        <Field label="Result date" required error={tried ? errs.date : undefined} hint="Any date up to today — there is no weekly or monthly schedule.">
          <input type="date" className={`input ${tried && errs.date ? 'invalid' : ''}`} value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {kpi.type === 'completion' ? (
          <>
            <div className="label">Status <span className="req" style={{ color: 'var(--red)' }}>*</span></div>
            <div className="grid g-3">
              {[
                ['full', 'Fully achieved', 'Recorded as 100%', CheckCircle2, 'var(--green)'],
                ['partial', 'Partially achieved', 'Choose how much %', CircleDashed, 'var(--amber)'],
                ['none', 'Not achieved', '0% · reason required', XCircle, 'var(--red)'],
              ].map(([k, t, s, I, c]) => (
                <button key={k} type="button" className={`option-card ${completion === k ? 'on' : ''}`} onClick={() => setCompletion(k)}>
                  <I size={22} color={c} />
                  <div className="bold mt-8">{t}</div>
                  <div className="tiny muted">{s}</div>
                </button>
              ))}
            </div>
            {tried && errs.value && <div className="err small" style={{ color: 'var(--red)' }}>{errs.value}</div>}
            {completion === 'partial' && (
              <Field label="How much is done?" hint="Pick a preset, or Other to enter the exact percentage." error={tried ? errs.partial : undefined}>
                <div className="row wrap gap-8">
                  <Seg value={partial === 'other' ? 'other' : Number(partial)} onChange={setPartial} options={[...presets.map((p) => ({ value: p, label: `${p}%` })), { value: 'other', label: 'Other %' }]} />
                  {partial === 'other' && (
                    <div className="input-group" style={{ width: 120 }}>
                      <NumInput className={`input pr ${tried && errs.partial ? 'invalid' : ''}`} value={otherPct} min={1} max={99} placeholder="e.g. 60" onChange={setOtherPct} />
                      <span className="addon">%</span>
                    </div>
                  )}
                </div>
              </Field>
            )}
          </>
        ) : (
          <Field
            label={kpi.type === 'sum' ? `Achieved since your last update (${kpi.unit})` : `Current value (${kpi.unit})`}
            required
            error={tried ? errs.value : undefined}
            hint={kpi.type === 'sum' ? `Enter only the new amount — it is added to what you already achieved. Your target is ${fmtValue(kpi.unit, target, false)}.` : `Benchmark ${kpi.startValue} → ${kpi.target}${kpi.unit === '%' ? '%' : ''}.`}
          >
            <NumInput value={value} invalid={tried && !!errs.value} min={0} onChange={setValue} placeholder={isSumKpi ? '0' : last ? String(last.value) : '0'} />
            {isSumKpi && value !== '' && (
              <div className="alert info" style={{ marginTop: 6 }}>
                <div>
                  {fmtValue(kpi.unit, totalBefore, false)} <b>+ {fmtValue(kpi.unit, Number(value), false)}</b> = new total <b>{fmtValue(kpi.unit, newTotal, false)}</b>
                </div>
              </div>
            )}
          </Field>
        )}
        <Field
          label="Comment"
          required={completion === 'none'}
          error={tried ? errs.comment : undefined}
          hint={`${completion === 'none' ? 'Required when not achieved.' : 'Optional.'} Share how it went: what helped, any blockers, or what you expect next. It is kept with this result and in the audit log.`}
        >
          <textarea
            className={`textarea ${tried && errs.comment ? 'invalid' : ''}`}
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
            placeholder={completion === 'none' ? 'Why was it not achieved? What will change?' : 'e.g. Two big clients paid early; I expect a slower October because of the holidays.'}
          />
          <div className="tiny muted right">{comment.length}/500</div>
        </Field>
      </div>
    </Modal>
  )
}

// =====================================================================
// Add a member to a running KPI
// =====================================================================
export function AddMemberModal({ parent, onClose }) {
  const { state, addMember } = useStore()
  const { toast } = useFeedback()
  const kpi = byId(state.kpis, parent.kpiId)
  const period = byId(state.periods, parent.periodId)
  const isSum = kpi.type === 'sum'
  const siblings = childAllocations(state, period.id, parent.id)
  const members = siblings.filter((a) => a.level === 'individual' && !a.leftDate)
  const otherPct = sum(siblings.filter((a) => a.level !== 'individual').map((a) => a.percent || 0)) + sum(siblings.filter((a) => a.leftDate).map((a) => a.percent || 0))
  const membersPct = sum(members.map((a) => a.percent || 0))
  const deptId = parent.level === 'team' ? byId(state.teams, parent.unitId).departmentId : parent.unitId
  const taken = new Set(state.allocations.filter((a) => a.periodId === period.id && a.level === 'individual' && !a.leftDate).map((a) => a.unitId))
  const [outside, setOutside] = useState(false)
  const candidates = state.staff
    .filter((s) => (outside || s.departmentId === deptId) && s.departmentId && s.active !== false && !taken.has(s.id))
    .sort((a, b) => (b.teamId === parent.unitId) - (a.teamId === parent.unitId) || (b.departmentId === deptId) - (a.departmentId === deptId) || a.name.localeCompare(b.name))

  const [step, setStep] = useState(0)
  const [q, setQ] = useState('')
  const [staffId, setStaffId] = useState(candidates[0]?.teamId === parent.unitId ? candidates[0].id : '')
  const [joinedDate, setJoinedDate] = useState(minISO(todayISO(), period.endDate))
  const [method, setMethod] = useState('equal')
  const [newPct, setNewPct] = useState('')
  const [source, setSource] = useState('all')
  const [takeFrom, setTakeFrom] = useState({})

  const person = byId(state.staff, staffId)
  const achieved = (a) => nodeStats(state, kpi, period, a).current

  // ---- the plan ----
  const plan = useMemo(() => {
    const percents = {}
    let p = 0
    const errors = []
    if (!isSum) return { percents, newPercent: null, errors }
    const n = members.length
    if (method === 'equal') {
      const pool = n ? membersPct : Math.max(0, 100 - otherPct)
      p = pool / (n + 1)
      for (const m of members) percents[m.id] = pool / (n + 1)
    } else {
      p = Number(newPct) || 0
      if (!(p > 0)) errors.push("Enter the new member's percentage.")
      if (!n || source === 'unallocated') {
        const free = 100 - otherPct - membersPct
        if (p > free + 0.0001) errors.push(`Only ${round(free, 2)}% of ${unitName(state, parent)} is unallocated.`)
        for (const m of members) percents[m.id] = m.percent
      } else if (source === 'all') {
        for (const m of members) percents[m.id] = m.percent - p / n
      } else {
        const total = sum(Object.values(takeFrom).map(Number))
        if (Math.abs(total - p) > 0.01) errors.push(`The amounts taken from members add up to ${round(total, 2)}% but the new member needs ${round(p, 2)}%.`)
        for (const m of members) percents[m.id] = m.percent - (Number(takeFrom[m.id]) || 0)
      }
      for (const m of members) if (percents[m.id] < -0.0001) errors.push(`${unitName(state, m)} would go below 0%.`)
    }
    return { percents, newPercent: p, errors }
  }, [method, newPct, source, takeFrom, members, membersPct, otherPct, isSum]) // eslint-disable-line react-hooks/exhaustive-deps

  const pt = parent.target
  const amt = (pct) => (pt * pct) / 100
  const fmtA = (v) => fmtValue(kpi.unit, v)
  const summary = {
    before: members.map((m) => `${unitName(state, m)} ${round(m.percent, 2)}% (${fmtA(amt(m.percent))})`).join('; ') || 'No members',
    after: [...members.map((m) => `${unitName(state, m)} ${round(plan.percents[m.id], 2)}% (${fmtA(amt(plan.percents[m.id]))})`), `${person?.name} ${round(plan.newPercent, 2)}% (${fmtA(amt(plan.newPercent))})`].join('; '),
  }
  if (!isSum) {
    summary.before = `${members.length} member(s) with the same target`
    summary.after = `${members.length + 1} member(s) with the same target`
  }

  const steps = isSum ? ['Person', 'Method', 'Preview'] : ['Person', 'Preview']
  const last = step === steps.length - 1
  const canNext = step === 0 ? !!staffId && joinedDate >= period.startDate && joinedDate <= period.endDate : steps[step] === 'Method' ? plan.errors.length === 0 : true

  const save = () => {
    addMember({ parentAllocId: parent.id, staffId, joinedDate, newPercent: plan.newPercent, percents: plan.percents, method: isSum ? (method === 'equal' ? 'equal split' : 'custom') : 'same target', summary })
    toast(`${person.name} added to ${unitName(state, parent)}. Existing achievements unchanged.`)
    onClose()
  }

  const filtered = candidates.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <Modal
      size="xl"
      icon={<UserPlus size={20} />}
      title={`Add member to ${unitName(state, parent)}`}
      sub={`${kpi.name} · ${isSum ? `group target ${fmtA(pt)}` : 'same target for everyone'} · period ${period.index}`}
      onClose={onClose}
      footer={
        <>
          <div className="row gap-6" style={{ marginRight: 'auto' }}>
            {steps.map((s, i) => (
              <span key={s} className={`badge ${i === step ? 'blue' : i < step ? 'green' : ''}`}>{i + 1}. {s}</span>
            ))}
          </div>
          {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>Back</button>}
          {!last ? (
            <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next <ArrowRight size={15} /></button>
          ) : (
            <button className="btn primary" disabled={plan.errors.length > 0} onClick={save}><CheckCircle2 size={15} /> Save & continue</button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.15fr)', alignItems: 'start' }}>
        <div className="col gap-16">
          <Field label="Pick the person from the staff list" required hint="People from this department are listed first. Tick the box to add someone from another team or department; they then contribute to this group.">
            <div className="picker">
              <div style={{ padding: 8, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <div className="input-group">
                  <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
                  <input className="input sm" style={{ paddingLeft: 32 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <label className="check small mt-8"><input type="checkbox" checked={outside} onChange={(e) => setOutside(e.target.checked)} /> Include people from other teams and departments</label>
              </div>
              <div className="picker-list" style={{ maxHeight: 230 }}>
                {filtered.length === 0 && <div className="small muted center" style={{ padding: 16 }}>Everyone in this department is already on this KPI.</div>}
                {filtered.map((s) => (
                  <div key={s.id} className={`picker-item ${staffId === s.id ? 'on' : ''}`} onClick={() => { setStaffId(s.id); if (s.joinedDate > period.startDate && s.joinedDate <= todayISO()) setJoinedDate(s.joinedDate) }}>
                    <input type="radio" checked={staffId === s.id} readOnly style={{ accentColor: 'var(--blue-600)' }} />
                    <Avatar name={s.name} size="sm" />
                    <div style={{ flex: 1 }}>
                      <div className="semi">{s.name}</div>
                      <div className="tiny muted">{s.title} · {s.teamId ? byId(state.teams, s.teamId).name : 'no team'} · joined Pahappa {fmtDate(s.joinedDate)}</div>
                    </div>
                    {s.teamId === parent.unitId ? <Badge tone="blue">in this team</Badge> : s.departmentId !== deptId ? <Badge tone="violet">other department · contributes here</Badge> : parent.level === 'team' ? <Badge tone="violet">outside this team · contributes here</Badge> : null}
                  </div>
                ))}
              </div>
            </div>
          </Field>
          <Field label="Joining date for this KPI" required hint="The new member's target starts from this date.">
            <input type="date" className="input" style={{ maxWidth: 220 }} value={joinedDate} min={period.startDate} max={period.endDate} onChange={(e) => setJoinedDate(e.target.value)} />
          </Field>
        </div>
        <MembersTable state={state} kpi={kpi} period={period} parent={parent} members={members} title={`Current members of ${unitName(state, parent)}`} />
        </div>
      )}

      {steps[step] === 'Method' && (
        <div className="col gap-16">
          <MembersTable state={state} kpi={kpi} period={period} parent={parent} members={members} after={plan.percents} newName={person?.name} newPct={plan.newPercent} title="What everyone has now, and after this change" />
          <div className="grid g-2">
            <button type="button" className={`option-card ${method === 'equal' ? 'on' : ''}`} onClick={() => setMethod('equal')}>
              <div className="ic"><Equal size={16} /></div>
              <div className="bold">Equal</div>
              <div className="small muted mt-4">Re-split the group's target equally across everyone, including {person?.name}.</div>
            </button>
            <button type="button" className={`option-card ${method === 'custom' ? 'on' : ''}`} onClick={() => setMethod('custom')}>
              <div className="ic"><SlidersHorizontal size={16} /></div>
              <div className="bold">Custom</div>
              <div className="small muted mt-4">Enter {person?.name}'s percentage and choose who it is taken from.</div>
            </button>
          </div>
          {method === 'custom' && (
            <div className="card card-pad col gap-16">
              <Field label={`${person?.name}'s share of ${unitName(state, parent)}`} required>
                <div className="row">
                  <div className="input-group" style={{ width: 140 }}>
                    <NumInput className="input pr" value={newPct} min={0} max={100} onChange={setNewPct} />
                    <span className="addon">%</span>
                  </div>
                  <span className="semi">= {fmtValue(kpi.unit, amt(Number(newPct) || 0), false)}</span>
                </div>
              </Field>
              <Field label="Take it from">
                <Seg
                  value={members.length ? source : 'unallocated'}
                  onChange={setSource}
                  options={[
                    { value: 'all', label: 'All members (split evenly)', disabled: !members.length },
                    { value: 'selected', label: 'Selected members', disabled: !members.length },
                    { value: 'unallocated', label: `Unallocated (${round(100 - otherPct - membersPct, 2)}%)` },
                  ]}
                />
              </Field>
              {source === 'selected' && members.length > 0 && (
                <table className="table compact">
                  <thead><tr><th>Member</th><th className="right">Current share</th><th style={{ width: 160 }}>Take (percentage points)</th><th className="right">New share</th></tr></thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td className="semi">{unitName(state, m)}</td>
                        <td className="right mono">{fmtPct(m.percent, 2)}</td>
                        <td>
                          <div className="input-group">
                            <NumInput className="input sm pr" value={takeFrom[m.id] ?? ''} min={0} onChange={(v) => setTakeFrom((t) => ({ ...t, [m.id]: v }))} />
                            <span className="addon">%</span>
                          </div>
                        </td>
                        <td className="right mono bold">{fmtPct(plan.percents[m.id], 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {plan.errors.map((e) => <Alert key={e} tone="error">{e}</Alert>)}
        </div>
      )}

      {steps[step] === 'Preview' && (
        <div className="col gap-16">
          <Alert>What existing members have already achieved never changes — only their remaining targets move. {person?.name}'s target starts on <b>{fmtDate(joinedDate)}</b>.</Alert>
          <div className="card scroll-x">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="right">Achieved so far</th>
                  {isSum && <><th className="right">Before</th><th /><th className="right">After</th><th className="right">Remaining after</th></>}
                  {!isSum && <th className="right">Target</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const a = achieved(m)
                  const after = plan.percents[m.id]
                  const tAfter = amt(after)
                  return (
                    <tr key={m.id}>
                      <td><div className="row gap-6"><Avatar name={unitName(state, m)} size="sm" /><span className="semi">{unitName(state, m)}</span></div></td>
                      <td className="right mono">{valueLabel(kpi, a)}</td>
                      {isSum ? (
                        <>
                          <td className="right mono">{fmtPct(m.percent, 2)}<div className="tiny muted">{fmtA(amt(m.percent))}</div></td>
                          <td className="center"><ArrowRight size={14} color="var(--muted)" /></td>
                          <td className="right mono bold" style={{ color: Math.abs(after - m.percent) > 0.001 ? 'var(--blue-700)' : undefined }}>{fmtPct(after, 2)}<div className="tiny muted">{fmtA(tAfter)}</div></td>
                          <td className="right mono">{tAfter - a <= 0 ? <Badge tone="green">target met</Badge> : fmtA(tAfter - a)}</td>
                        </>
                      ) : (
                        <td className="right mono">{valueLabel(kpi, periodTarget(kpi, period))}</td>
                      )}
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--blue-50)' }}>
                  <td><div className="row gap-6"><Avatar name={person?.name} size="sm" /><span className="bold">{person?.name}</span><Badge tone="violet">new</Badge></div></td>
                  <td className="right mono muted">—</td>
                  {isSum ? (
                    <>
                      <td className="right mono muted">—</td>
                      <td className="center"><ArrowRight size={14} color="var(--muted)" /></td>
                      <td className="right mono bold" style={{ color: 'var(--blue-700)' }}>{fmtPct(plan.newPercent, 2)}<div className="tiny muted">{fmtA(amt(plan.newPercent))}</div></td>
                      <td className="right mono">{fmtA(amt(plan.newPercent))}</td>
                    </>
                  ) : (
                    <td className="right mono">{valueLabel(kpi, periodTarget(kpi, period))}</td>
                  )}
                </tr>
              </tbody>
              {isSum && (
                <tfoot>
                  <tr>
                    <td>Members total</td>
                    <td />
                    <td className="right mono">{fmtPct(membersPct, 2)}</td>
                    <td />
                    <td className="right mono">{fmtPct(sum(Object.values(plan.percents)) + plan.newPercent, 2)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {plan.errors.map((e) => <Alert key={e} tone="error">{e}</Alert>)}
        </div>
      )}
    </Modal>
  )
}

/** Existing members of a group: share, target, what they have achieved, and (optionally) their share after a change. */
function MembersTable({ state, kpi, period, parent, members, after, newName, newPct, title }) {
  const isSum = kpi.type === 'sum'
  const pt = parent.target
  const fmtA = (v) => fmtValue(kpi.unit, v)
  return (
    <div className="card">
      <div className="card-head" style={{ padding: '12px 16px' }}>
        <UsersRound size={16} color="var(--blue-600)" />
        <b className="small">{title}</b>
        <div className="spacer" />
        <span className="tiny muted">{isSum ? `group target ${fmtA(pt)}` : 'same target for everyone'}</span>
      </div>
      {members.length === 0 ? (
        <div className="small muted" style={{ padding: 16 }}>No members yet — the new person will be the first.</div>
      ) : (
        <table className="table compact">
          <thead>
            <tr>
              <th>Member</th>
              {isSum && <th className="right">Share</th>}
              <th className="right">Target</th>
              <th className="right">Achieved</th>
              <th style={{ width: 90 }}>Progress</th>
              {after && isSum && <th className="right">After</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const st = nodeStats(state, kpi, period, m)
              const a = after?.[m.id]
              const changed = a !== undefined && Math.abs(a - m.percent) > 0.001
              return (
                <tr key={m.id}>
                  <td><div className="row gap-6"><Avatar name={unitName(state, m)} size="sm" /><span className="semi small">{unitName(state, m)}</span></div></td>
                  {isSum && <td className="right mono small">{fmtPct(m.percent, 2)}</td>}
                  <td className="right mono small">{kpi.type === 'completion' ? 'Full' : valueLabel(kpi, st.target)}</td>
                  <td className="right mono small bold">{st.hasData || isSum ? valueLabel(kpi, st.current) : '—'}</td>
                  <td><ScoreDot value={st.progress} size="sm" /></td>
                  {after && isSum && (
                    <td className="right mono small" style={{ color: changed ? 'var(--blue-700)' : undefined, fontWeight: changed ? 700 : 400 }}>
                      {fmtPct(a, 2)}<div className="tiny muted">{fmtA((pt * a) / 100)}</div>
                    </td>
                  )}
                </tr>
              )
            })}
            {after && isSum && newName && (
              <tr style={{ background: 'var(--blue-50)' }}>
                <td><div className="row gap-6"><Avatar name={newName} size="sm" /><span className="bold small">{newName}</span><Badge tone="violet">new</Badge></div></td>
                <td className="right muted">—</td>
                <td className="right muted">—</td>
                <td className="right muted">—</td>
                <td />
                <td className="right mono small bold" style={{ color: 'var(--blue-700)' }}>{fmtPct(newPct, 2)}<div className="tiny muted">{fmtA((pt * (newPct || 0)) / 100)}</div></td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

// =====================================================================
// Restart / Restart with new target
// =====================================================================
export function RestartModal({ kpi, period, goal, initialMode = 'restart', onClose }) {
  const { restartKpi } = useStore()
  const { toast } = useFeedback()
  const [mode, setMode] = useState(initialMode)
  const closeDefault = mode === 'restart' ? minISO(todayISO(), period.endDate) : minISO(todayISO(), period.endDate)
  const [closeOn, setCloseOn] = useState(closeDefault)
  const len = daysBetween(period.startDate, period.endDate)
  const [newStart, setNewStart] = useState(addDays(closeDefault, 1))
  const [newEnd, setNewEnd] = useState(mode === 'restart' ? minISO(addDays(closeDefault, len), goal.endDate) : period.endDate)
  const [newTarget, setNewTarget] = useState(period.target)
  const [tried, setTried] = useState(false)

  const errs = []
  if (closeOn < period.startDate) errs.push('The close date is before the period started.')
  if (newStart <= closeOn) errs.push('The new period must start after the close date.')
  if (newEnd < newStart) errs.push('The new end date must be on or after its start.')
  if (newEnd > goal.endDate) errs.push(`A KPI period can't run past the goal's end date (${fmtDate(goal.endDate)}).`)
  if (newStart > goal.endDate) errs.push('There is no time left in this goal for a new period.')
  if (mode === 'newTarget' && !(Number(newTarget) > 0)) errs.push('Enter the new target.')

  const switchMode = (m) => {
    setMode(m)
    const c = minISO(todayISO(), period.endDate)
    setCloseOn(c)
    setNewStart(addDays(c, 1))
    setNewEnd(m === 'restart' ? minISO(addDays(c, len), goal.endDate) : period.endDate > c ? period.endDate : goal.endDate)
  }

  const save = () => {
    setTried(true)
    if (errs.length) return
    restartKpi(kpi.id, { mode, closeOn, newStart, newEnd, newTarget })
    toast(`Period ${period.index} closed and kept in history. Period ${period.index + 1} has started.`)
    onClose()
  }

  return (
    <Modal
      size="lg"
      icon={<RotateCcw size={20} />}
      title={`Restart “${kpi.name}”`}
      sub={`Current: period ${period.index} · ${fmtDate(period.startDate)} – ${fmtDate(period.endDate)} · target ${valueLabel(kpi, period.target)}`}
      onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><RotateCcw size={15} /> Close period & restart</button></>}
    >
      <div className="grid g-2 mb-16">
        <button type="button" className={`option-card ${mode === 'restart' ? 'on' : ''}`} onClick={() => switchMode('restart')}>
          <div className="bold">Restart (end of KPI period)</div>
          <div className="small muted mt-4">Close this period, keep its results, and open a new one with empty current values and the same setup.</div>
        </button>
        <button type="button" className={`option-card ${mode === 'newTarget' ? 'on' : ''}`} onClick={() => switchMode('newTarget')} disabled={kpi.type === 'completion'}>
          <div className="bold">Restart with a new target</div>
          <div className="small muted mt-4">Mid-period change: the current period is closed and calculated, then a new period starts with the new target. Allocation percentages carry over.</div>
        </button>
      </div>
      <div className="grid g-4">
        <Field label="Close current period on"><input type="date" className="input" value={closeOn} min={period.startDate} max={period.endDate} onChange={(e) => setCloseOn(e.target.value)} /></Field>
        <Field label="New period starts"><input type="date" className="input" value={newStart} max={goal.endDate} onChange={(e) => setNewStart(e.target.value)} /></Field>
        <Field label="New period ends" hint={`Max ${fmtDate(goal.endDate)} (goal end)`}><input type="date" className="input" value={newEnd} max={goal.endDate} onChange={(e) => setNewEnd(e.target.value)} /></Field>
        {mode === 'newTarget' ? (
          <Field label={`New target (${kpi.unit})`} hint={kpi.type === 'sum' ? fmtValue(kpi.unit, Number(newTarget) || 0, false) : undefined}>
            <NumInput value={newTarget} onChange={setNewTarget} />
          </Field>
        ) : (
          <Field label="Target"><input className="input" disabled value={kpi.type === 'completion' ? 'Fully achieved' : valueLabel(kpi, period.target)} /></Field>
        )}
      </div>
      <Alert style={{ marginTop: 16 }}>Nothing is deleted. Period {period.index}'s results stay in the period history. The same departments, teams and people carry over with the same percentages{mode === 'newTarget' ? ' — their amounts are recalculated from the new target' : ''}.</Alert>
      {tried && errs.map((e) => <Alert key={e} tone="error" style={{ marginTop: 10 }}>{e}</Alert>)}
    </Modal>
  )
}

// =====================================================================
// Reuse a goal (copies goal, KPIs and allocations into an editable draft)
// =====================================================================
export function ReuseModal({ goal, onClose }) {
  const { state, reuseGoal } = useStore()
  const { toast } = useFeedback()
  const open = state.cycles.filter((c) => c.status !== 'ended')
  const [cycleId, setCycleId] = useState(open.find((c) => c.id !== goal.cycleId)?.id || open[0]?.id || '')
  const go = () => {
    const id = `dr-${Date.now().toString(36)}`
    reuseGoal(goal.id, cycleId, id)
    toast('Copied into a draft — adjust only what changed, then save.')
    navigate(`/wizard?draft=${id}`)
  }
  return (
    <Modal
      icon={<RotateCcw size={20} />}
      title={`Reuse “${goal.name}”`}
      sub="Start from this goal: its KPIs and all allocations are copied into a new draft in the wizard."
      onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!cycleId} onClick={go}>Copy into wizard</button></>}
    >
      {open.length ? (
        <Field label="Copy into review cycle" hint="Dates are moved into the chosen cycle. Results are never copied.">
          <select className="select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            {open.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
          </select>
        </Field>
      ) : (
        <Alert tone="warn">There is no open review cycle. Create one under Review Cycles first.</Alert>
      )}
    </Modal>
  )
}

// =====================================================================
// Progress chart (SVG)
// =====================================================================
export function LineChart({ points, start, end, height = 220 }) {
  const W = 760
  const H = height
  const pad = { l: 40, r: 16, t: 14, b: 28 }
  const t0 = parseISO(start).getTime()
  const t1 = parseISO(end).getTime()
  const maxY = Math.max(100, ...points.map((p) => p.value)) * 1.05
  const x = (d) => pad.l + ((parseISO(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r)
  const y = (v) => H - pad.b - (v / maxY) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = points.length ? `${path} L${x(points[points.length - 1].date)},${y(0)} L${x(points[0].date)},${y(0)} Z` : ''
  const today = todayISO()
  const months = []
  const d = parseISO(start)
  d.setDate(1)
  while (d.getTime() <= t1) {
    if (d.getTime() >= t0) months.push(new Date(d))
    d.setMonth(d.getMonth() + 1)
  }
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="lc-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e7edf7" />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6b7a94">{v}%</text>
        </g>
      ))}
      {months.map((m) => {
        const iso = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
        return <text key={iso} x={x(iso)} y={H - 8} fontSize="11" fill="#6b7a94" textAnchor="middle">{M[m.getMonth()]}</text>
      })}
      {today >= start && today <= end && <line x1={x(today)} x2={x(today)} y1={pad.t} y2={y(0)} stroke="#0ea5e9" strokeDasharray="3 4" />}
      {area && <path d={area} fill="url(#lc-area)" />}
      {path && <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.date)} cy={y(p.value)} r="4" fill="white" stroke="#2563eb" strokeWidth="2">
          <title>{`${fmtDate(p.date)}: ${round(p.value, 1)}%`}</title>
        </circle>
      ))}
    </svg>
  )
}


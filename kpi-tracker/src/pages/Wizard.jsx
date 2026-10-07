import { useEffect, useMemo, useRef, useState } from 'react'
import { PencilLine, ArrowLeft, ArrowRight, Save, SkipForward, Plus, Trash2, Building2, UsersRound, User, Target, FileSpreadsheet, CheckCircle2, AlertTriangle, AlertCircle, Wand2, Play, Copy, Layers, CalendarRange, Sparkles } from 'lucide-react'
import { useStore, currentUserId } from '../store'
import { Field, NumInput, Seg, Badge, Alert, Empty, Modal, Link, navigate, useFeedback } from '../components/ui'
import AllocationEditor, { StaffPicker, equalize, defaultMethod } from '../components/AllocationEditor'
import ExcelUpload from '../components/ExcelUpload'
import { STEPS, emptyDraft, newKpi, validateDraft, kpiTarget, deptTarget, teamTarget, groupRows, pctTotal, teamsPctOfDept, directPctOfDept, isSum } from '../lib/draft'
import { KPI_TYPES, byId, goalKpis } from '../lib/calc'
import { UNITS, fmtValue, fmtRange, round, sum, timeAgo, todayISO, fmtDate } from '../lib/utils'

export default function Wizard({ draftId }) {
  const { state, saveDraft, commitDraft, startGoal } = useStore()
  const { toast } = useFeedback()
  const openCycles = state.cycles.filter((c) => c.status !== 'ended')
  const defaultCycle = openCycles.find((c) => c.id === state.viewCycleId) || openCycles.find((c) => c.status === 'active') || openCycles[0]
  const existing = draftId ? state.drafts.find((d) => d.id === draftId) : null

  const [draft, setDraft] = useState(() => (existing ? structuredClone(existing) : emptyDraft(defaultCycle, currentUserId(state))))
  const [step, setStep] = useState(existing?.step ?? 0)
  const [attempted, setAttempted] = useState(() => new Set())
  const [activeKpi, setActiveKpi] = useState(draft.kpis[0]?.key)
  const [savedAt, setSavedAt] = useState(existing?.savedAt)
  const [doneGoalId, setDoneGoalId] = useState(null)
  const [excel, setExcel] = useState(false)
  const [returnToReview, setReturnToReview] = useState(false)
  const committed = useRef(false)

  const { errors, warnings } = useMemo(() => validateDraft(state, draft), [state, draft])
  const errsFor = (s) => errors.filter((e) => e.step === s)
  const fieldErr = (field) => (attempted.has(step) || attempted.has('all') ? errors.find((e) => e.field === field)?.msg : undefined)

  const up = (fn) =>
    setDraft((d) => {
      const n = structuredClone(d)
      fn(n)
      return n
    })

  // ---- autosave: nothing typed is ever lost ----
  useEffect(() => {
    if (committed.current) return
    const meaningful = draft.goal.name.trim() || draft.kpis.length
    if (!meaningful) return
    const t = setTimeout(() => {
      if (committed.current) return
      saveDraft({ ...draft, step })
      setSavedAt(new Date().toISOString())
      if (!draftId) window.history.replaceState(null, '', `#/wizard?draft=${draft.id}`)
    }, 700)
    return () => clearTimeout(t)
  }, [draft, step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!draft.kpis.find((k) => k.key === activeKpi)) setActiveKpi(draft.kpis[0]?.key)
  }, [draft.kpis, activeKpi])

  if (draftId && !existing && !committed.current)
    return <Empty icon={<AlertTriangle />} title="Draft not found" action={<Link to="/drafts" className="btn primary">Go to drafts</Link>}>It may have been saved as a goal or deleted.</Empty>
  if (!defaultCycle && !existing)
    return <Empty icon={<CalendarRange />} title="No open review cycle" action={<Link to="/cycles" className="btn primary">Create a review cycle</Link>}>Create and activate a review cycle first, then set up its goals here.</Empty>

  const cycle = byId(state.cycles, draft.cycleId)

  const focusField = (field, kpiKey) => {
    if (kpiKey) setActiveKpi(kpiKey)
    setTimeout(() => {
      const el = document.querySelector(`[data-field="${CSS.escape(field)}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('flash')
      void el.offsetWidth
      el.classList.add('flash')
      el.querySelector('input:not([type=checkbox]),select,textarea')?.focus({ preventScroll: true })
    }, 120)
  }

  const goTo = (s) => {
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveAndContinue = () => {
    const errs = errsFor(step)
    if (errs.length) {
      setAttempted((a) => new Set(a).add(step))
      toast(`Please fix ${errs.length} issue${errs.length > 1 ? 's' : ''} on this step — nothing you entered was cleared.`, 'error')
      focusField(errs[0].field, errs[0].kpiKey)
      return
    }
    if (step === 1 && !activeKpi) setActiveKpi(draft.kpis[0]?.key)
    goTo(step + 1)
  }

  const saveAsDraft = () => {
    saveDraft({ ...draft, step })
    setSavedAt(new Date().toISOString())
    if (!draftId) window.history.replaceState(null, '', `#/wizard?draft=${draft.id}`)
    toast('Draft saved. Reopen it any time from Drafts — it resumes at this step.')
  }

  const finalSave = () => {
    if (errors.length) {
      setAttempted(new Set(['all', 0, 1, 2, 3, 4]))
      const first = errors[0]
      toast(`${errors.length} issue${errors.length > 1 ? 's' : ''} must be fixed before saving. Taking you to the first one.`, 'error')
      goTo(first.step)
      focusField(first.field, first.kpiKey)
      return
    }
    const goalId = `g-${Date.now().toString(36)}`
    committed.current = true
    commitDraft(draft, goalId)
    setDoneGoalId(goalId)
    toast(`"${draft.goal.name}" is set up and ready.`)
  }

  if (doneGoalId) return <DoneScreen state={state} draft={draft} goalId={doneGoalId} startGoal={startGoal} />

  const canSkip = step >= 2 && step <= 4
  const kpi = draft.kpis.find((k) => k.key === activeKpi) || draft.kpis[0]
  const stepState = (i) => (i === step ? 'current' : attempted.has(i) && errsFor(i).length ? 'error' : i < step ? 'done' : '')

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="crumbs"><Wand2 size={13} /> Goal setup wizard · {cycle?.name}</div>
          <h1>{draft.goal.name || 'Set up a new organizational goal'}</h1>
          <div className="sub">Create the goal and its KPIs once, then share them down to departments, teams and people — all in one lane.</div>
        </div>
        <div className="spacer" />
        {savedAt && <span className="badge green"><CheckCircle2 size={12} /> Draft saved {timeAgo(savedAt)}</span>}
        {draft.reusedFrom && <span className="badge violet"><Copy size={12} /> Reused from a previous goal</span>}
      </div>

      {/* ---------- the lane ---------- */}
      <div className="card card-pad" style={{ padding: '22px 10px 16px' }}>
        <div className="lane">
          <div className="lane-rail">
            <div className="lane-fill" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          </div>
          {STEPS.map((s, i) => (
            <button key={s.key} className={`lane-step ${stepState(i)}`} onClick={() => goTo(i)} title={`Go to step ${i + 1}: ${s.label}`}>
              <div className="knob">
                <div className="knob-inner">{stepState(i) === 'done' ? <CheckCircle2 size={20} /> : i + 1}</div>
              </div>
              <div className="t">{s.label}</div>
              <div className="h">{s.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-24">
        {step === 0 && <StepGoal state={state} draft={draft} up={up} fieldErr={fieldErr} cycle={cycle} openCycles={openCycles} />}
        {step === 1 && <StepKpis draft={draft} up={up} fieldErr={fieldErr} />}
        {step >= 2 && step <= 4 && draft.kpis.length > 0 && (
          <KpiTabs state={state} draft={draft} active={kpi?.key} onPick={setActiveKpi} step={step} errors={attempted.has(step) || attempted.has('all') ? errsFor(step) : []} onExcel={() => setExcel(true)} />
        )}
        {step >= 2 && step <= 4 && draft.kpis.length === 0 && (
          <Empty icon={<Target />} title="Add a KPI first" action={<button className="btn primary" onClick={() => goTo(1)}>Go to KPIs</button>}>Allocations are made per KPI.</Empty>
        )}
        {step === 2 && kpi && <StepDepts state={state} draft={draft} up={up} kpi={kpi} fieldErr={fieldErr} toast={toast} />}
        {step === 3 && kpi && <StepTeams state={state} draft={draft} up={up} kpi={kpi} fieldErr={fieldErr} goTo={goTo} />}
        {step === 4 && kpi && <StepPeople state={state} draft={draft} up={up} kpi={kpi} fieldErr={fieldErr} goTo={goTo} />}
        {step === 5 && <StepReview state={state} draft={draft} errors={errors} warnings={warnings} cycle={cycle} onFix={(e) => { setAttempted(new Set(['all', 0, 1, 2, 3, 4])); goTo(e.step); focusField(e.field, e.kpiKey) }} onAdjust={(st, kpiKey) => { if (kpiKey) setActiveKpi(kpiKey); setReturnToReview(true); goTo(st) }} />}
      </div>

      <div className="wizard-foot">
        <button className="btn secondary" disabled={step === 0} onClick={() => goTo(step - 1)}>
          <ArrowLeft size={16} /> Previous
        </button>
        {canSkip && (
          <button className="btn ghost" onClick={() => goTo(step + 1)} title="Leave this level empty for now">
            <SkipForward size={16} /> Skip
          </button>
        )}
        <div className="spacer" />
        <span className="small muted">Step {step + 1} of {STEPS.length}</span>
        <button className="btn secondary" onClick={saveAsDraft}>
          <Save size={16} /> Save as draft
        </button>
        {returnToReview && step < 5 && (
          <button className="btn secondary" onClick={() => { if (!errsFor(step).length) goTo(5); else saveAndContinue() }}>
            <CheckCircle2 size={16} /> Back to review
          </button>
        )}
        {step < 5 ? (
          <button className="btn primary" onClick={saveAndContinue}>
            Save & continue <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn success" onClick={finalSave}>
            <CheckCircle2 size={16} /> Save goal
          </button>
        )}
      </div>

      {excel && (
        <ExcelUpload
          state={state}
          draft={draft}
          onClose={() => setExcel(false)}
          onApply={(next, n) => {
            setDraft(next)
            setExcel(false)
            toast(`${n} row${n > 1 ? 's' : ''} applied from Excel. Everything stays editable.`)
          }}
        />
      )}
    </div>
  )
}

// =====================================================================
// Step 1 — Goal
// =====================================================================
function StepGoal({ state, draft, up, fieldErr, cycle, openCycles }) {
  const g = draft.goal
  const others = state.goals.filter((x) => x.cycleId === draft.cycleId)
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)' }}>
      <div className="card card-pad">
        <h2>Goal details</h2>
        <p className="muted small mt-4 mb-16">Goals exist only at organization level. Departments, teams and people contribute through KPIs.</p>
        <div className="grid g-2">
          <Field label="Review cycle" required hint={cycle ? `${fmtRange(cycle.startDate, cycle.endDate)} · ${cycle.status}` : ''}>
            <select
              className="select"
              value={draft.cycleId}
              onChange={(e) =>
                up((d) => {
                  const c = byId(state.cycles, e.target.value)
                  d.cycleId = c.id
                  if (!d.goal.startDate || d.goal.startDate < c.startDate || d.goal.startDate > c.endDate) d.goal.startDate = c.startDate
                  if (!d.goal.endDate || d.goal.endDate > c.endDate || d.goal.endDate < c.startDate) d.goal.endDate = c.endDate
                })
              }
            >
              {openCycles.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
              ))}
            </select>
          </Field>
          <Field label="Goal name" required field="goal.name" error={fieldErr('goal.name')}>
            <input className={`input ${fieldErr('goal.name') ? 'invalid' : ''}`} placeholder="e.g. Increase Revenue" value={g.name} onChange={(e) => up((d) => { d.goal.name = e.target.value })} />
          </Field>
        </div>
        <Field label="Description" style={{ marginTop: 14 }}>
          <textarea className="textarea" placeholder="What does success look like?" value={g.description} onChange={(e) => up((d) => { d.goal.description = e.target.value })} />
        </Field>

        <div className="label mt-16 mb-8">Goal type <span className="muted" style={{ fontWeight: 400 }}>— every KPI of this goal, and every share below it, uses this type</span></div>
        <div className="grid g-3">
          {Object.entries(KPI_TYPES).map(([k, t]) => (
            <button key={k} type="button" className={`option-card ${g.type === k ? 'on' : ''}`} onClick={() => up((d) => {
              d.goal.type = k
              // KPIs inherit the goal's type
              d.kpis.forEach((x) => {
                if (x.type === k) return
                x.type = k
                x.unit = k === 'completion' ? '%' : k === 'average' ? (x.unit === 'UGX' ? '%' : x.unit) : x.unit === '%' ? 'UGX' : x.unit
                x.target = k === 'completion' ? 100 : ''
                x.startValue = k === 'average' ? '' : 0
              })
            })}>
              <div className="ic">{t.short}</div>
              <div className="bold">{t.label}</div>
              <div className="small muted mt-4">{t.desc}</div>
              <div className="tiny mt-8" style={{ color: 'var(--blue-700)' }}>e.g. {t.example}</div>
            </button>
          ))}
        </div>

        <div className="grid g-2 mt-16">
          <Field label="Start date" required field="goal.startDate" error={fieldErr('goal.startDate')}>
            <input type="date" className={`input ${fieldErr('goal.startDate') ? 'invalid' : ''}`} value={g.startDate} min={cycle?.startDate} max={cycle?.endDate} onChange={(e) => up((d) => { d.goal.startDate = e.target.value })} />
          </Field>
          <Field label="End date" required field="goal.endDate" error={fieldErr('goal.endDate')}>
            <input type="date" className={`input ${fieldErr('goal.endDate') ? 'invalid' : ''}`} value={g.endDate} min={g.startDate || cycle?.startDate} max={cycle?.endDate} onChange={(e) => up((d) => { d.goal.endDate = e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="col">
        <div className="card card-pad">
          <h3>Tracked on its own</h3>
          <p className="small muted mt-4 mb-12">Every goal counts as <b>100%</b> by itself. It is not weighted against the other goals in {cycle?.name}. Its KPIs share that 100% (you set each KPI's contribution in the next step).</p>
          <div className="stack-bar" style={{ height: 14 }}>
            <span style={{ width: '100%', background: 'var(--navy-800)' }} />
          </div>
          <div className="row small mt-8"><span className="spacer bold">{g.name || 'This goal'}</span><b>100%</b></div>
          {others.length > 0 && (
            <>
              <div className="divider" style={{ margin: '12px 0 8px' }} />
              <div className="tiny muted mb-8">Other goals in {cycle?.name}, each tracked separately</div>
              <div className="col gap-6">
                {others.map((o) => (
                  <div key={o.id} className="row small"><span className="spacer">{o.name}</span><span className="muted">{goalKpis(state, o.id).length} KPI{goalKpis(state, o.id).length === 1 ? '' : 's'}</span></div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="card card-pad" style={{ background: 'linear-gradient(160deg,#f4f8ff,#fff)' }}>
          <h3 className="row gap-6"><Layers size={16} color="var(--blue-600)" /> How it cascades</h3>
          <div className="col gap-6 mt-12 small">
            {[
              ['organization', Target, 'Organization goal + KPIs', 'Set once, here'],
              ['department', Building2, 'Departments', 'Get a share of each KPI'],
              ['team', UsersRound, 'Teams', "Split their department's share"],
              ['individual', User, 'Individuals', 'Update results; everything rolls up'],
            ].map(([lvl, Icon, t, s], i) => (
              <div key={lvl} className="row" style={{ paddingLeft: i * 14 }}>
                <span className={`lvl ${lvl}`}><Icon size={14} /></span>
                <div><div className="semi">{t}</div><div className="tiny muted">{s}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// Step 2 — KPIs
// =====================================================================
function StepKpis({ draft, up, fieldErr }) {
  const totalW = sum(draft.kpis.map((k) => Number(k.weight) || 0))
  const addKpi = () =>
    up((d) => {
      d.kpis.push(newKpi(d))
      const n = d.kpis.length
      d.kpis.forEach((k) => (k.weight = round(100 / n, 2)))
    })
  const splitEqual = () => up((d) => d.kpis.forEach((k) => (k.weight = round(100 / d.kpis.length, 2))))
  const removeKpi = (key) =>
    up((d) => {
      d.kpis = d.kpis.filter((k) => k.key !== key)
      delete d.depts[key]
      delete d.teams[key]
      delete d.people[key]
      d.kpis.forEach((k) => (k.weight = round(100 / (d.kpis.length || 1), 2)))
    })

  return (
    <div>
      <div className="row mb-16" data-field="kpis">
        <div>
          <h2>KPIs for “{draft.goal.name || 'this goal'}”</h2>
          <p className="muted small mt-4">Define the measurable targets at organization level. The goal is 100%; each KPI's contribution is its share of that 100%, and lower levels contribute to these KPIs.</p>
        </div>
        <div className="spacer" />
        <div data-field="kpis.weight" className="row gap-6">
          <span className={`badge ${Math.abs(totalW - 100) < 0.05 ? 'green' : 'red'}`}>KPI contributions: {round(totalW)}% of the goal</span>
          {draft.kpis.length > 1 && <button className="btn ghost sm" onClick={splitEqual}>Split contributions equally</button>}
        </div>
        <button className="btn primary" onClick={addKpi}><Plus size={16} /> Add KPI</button>
      </div>
      {fieldErr('kpis') && <Alert tone="error" style={{ marginBottom: 14 }}>{fieldErr('kpis')}</Alert>}
      {fieldErr('kpis.weight') && <Alert tone="error" style={{ marginBottom: 14 }}>{fieldErr('kpis.weight')}</Alert>}

      {draft.kpis.length === 0 && (
        <div className="card">
          <Empty icon={<Target />} title="No KPIs yet" action={<button className="btn primary" onClick={addKpi}><Plus size={16} /> Add the first KPI</button>}>
            A goal needs at least one KPI before it can run.
          </Empty>
        </div>
      )}

      <div className="col gap-16">
        {draft.kpis.map((k, i) => {
          const f = (x) => `kpi.${k.key}.${x}`
          const E = (x) => fieldErr(f(x))
          const set = (patch) => up((d) => Object.assign(d.kpis.find((x) => x.key === k.key), patch))
          return (
            <div key={k.key} className="card">
              <div className="card-head">
                <span className="badge navy">KPI {i + 1}</span>
                <b>{k.name || 'Untitled KPI'}</b>
                <Badge tone="blue">{KPI_TYPES[k.type].label}</Badge>
                <div className="spacer" />
                <button className="btn danger sm" onClick={() => removeKpi(k.key)}><Trash2 size={14} /> Remove</button>
              </div>
              <div className="card-body">
                <div className="grid" style={{ gridTemplateColumns: '2fr 1.4fr' }}>
                  <Field label="KPI name" required field={f('name')} error={E('name')}>
                    <input className={`input ${E('name') ? 'invalid' : ''}`} placeholder="e.g. Annual Revenue" value={k.name} onChange={(e) => set({ name: e.target.value })} />
                  </Field>
                  <Field label="Type" hint="Set by the goal (step 1); every level below uses it too.">
                    <div className="inherited-type"><span className="lock">🔒</span> <b>{KPI_TYPES[draft.goal.type].label}</b> <span className="muted small">— from the goal “{draft.goal.name || 'this goal'}”</span></div>
                  </Field>
                </div>
                <Field label="Description" style={{ marginTop: 12 }}>
                  <input className="input" placeholder="Optional — what exactly is measured?" value={k.description} onChange={(e) => set({ description: e.target.value })} />
                </Field>
                <div className="grid mt-12" style={{ gridTemplateColumns: 'repeat(6, minmax(0,1fr))' }}>
                  <Field label="Unit" required field={f('unit')} error={E('unit')} style={{ gridColumn: 'span 1' }}>
                    <select className={`select ${E('unit') ? 'invalid' : ''}`} value={k.unit} disabled={k.type === 'completion'} onChange={(e) => set({ unit: e.target.value })}>
                      <option value="">Select…</option>
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </Field>
                  {k.type === 'average' && (
                    <Field label="Starting value" required field={f('startValue')} error={E('startValue')}>
                      <NumInput value={k.startValue} invalid={!!E('startValue')} placeholder="e.g. 70" onChange={(v) => set({ startValue: v })} />
                    </Field>
                  )}
                  <Field label={k.type === 'completion' ? 'Target' : 'Organization target'} required field={f('target')} error={E('target')} style={{ gridColumn: k.type === 'average' ? 'span 1' : 'span 2' }} hint={k.type === 'sum' && Number(k.target) > 0 ? fmtValue(k.unit, Number(k.target), false) : k.type === 'completion' ? 'Fully achieved' : undefined}>
                    {k.type === 'completion' ? <input className="input" value="100% (fully achieved)" disabled /> : <NumInput value={k.target} invalid={!!E('target')} placeholder="e.g. 1000000000" onChange={(v) => set({ target: v })} />}
                  </Field>
                  <Field label="Contribution to goal" required hint="Auto-split; editable">
                    <div className="input-group">
                      <NumInput className="input pr" value={k.weight} onChange={(v) => set({ weight: v })} />
                      <span className="addon">%</span>
                    </div>
                  </Field>
                  <Field label="Start date" required field={f('startDate')} error={E('startDate')}>
                    <input type="date" className={`input ${E('startDate') ? 'invalid' : ''}`} value={k.startDate} min={draft.goal.startDate} max={draft.goal.endDate} onChange={(e) => set({ startDate: e.target.value })} />
                  </Field>
                  <Field label="End date" required field={f('endDate')} error={E('endDate')}>
                    <input type="date" className={`input ${E('endDate') ? 'invalid' : ''}`} value={k.endDate} min={k.startDate} max={draft.goal.endDate} onChange={(e) => set({ endDate: e.target.value })} />
                  </Field>
                </div>
                <div className="small muted mt-12">
                  {k.type === 'sum' && 'Progress = (current − start) ÷ (target − start) × 100. Shares are split across departments, teams and people and added back up.'}
                  {k.type === 'average' && 'Everyone carries the same benchmark; results are averaged on the way up.'}
                  {k.type === 'completion' && `Updates are Fully achieved (100%), Partially achieved (presets) or Not achieved (0%, reason required).`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {draft.kpis.length > 0 && (
        <button className="btn soft mt-16" onClick={addKpi}><Plus size={16} /> Add another KPI</button>
      )}
    </div>
  )
}

// =====================================================================
// KPI tabs used by steps 3–5
// =====================================================================
function KpiTabs({ state, draft, active, onPick, step, errors, onExcel }) {
  return (
    <div className="row mb-16 top wrap">
      <div className="pills" style={{ flex: 1 }}>
        {draft.kpis.map((k) => {
          const drows = draft.depts[k.key]?.rows || []
          const pct = isSum(k) ? pctTotal(drows) : null
          const bad = errors.some((e) => e.kpiKey === k.key)
          return (
            <button key={k.key} className={`pill ${active === k.key ? 'on' : ''}`} onClick={() => onPick(k.key)} style={bad ? { borderColor: 'var(--red)' } : undefined}>
              <span className="row gap-6"><span className="t">{k.name || 'Untitled KPI'}</span>{bad && <AlertCircle size={14} color="var(--red)" />}</span>
              <span className="tiny muted">
                {KPI_TYPES[k.type].label} · {isSum(k) ? fmtValue(k.unit, kpiTarget(k)) : k.type === 'average' ? `${k.startValue} → ${k.target}${k.unit === '%' ? '%' : ' ' + k.unit}` : 'Completion'}
                {step === 2 && ` · ${drows.length} dept${drows.length === 1 ? '' : 's'}${pct !== null ? ` · ${round(pct)}%` : ''}`}
              </span>
            </button>
          )
        })}
      </div>
      <button className="btn secondary" onClick={onExcel}><FileSpreadsheet size={16} /> Upload from Excel</button>
    </div>
  )
}

function TargetBanner({ kpi, label, amount, extra }) {
  return (
    <div className="target-banner mb-16">
      <div className="stat" style={{ padding: 0 }}><div className="icon" style={{ background: 'white' }}><Target size={20} /></div></div>
      <div>
        <div className="small muted">{label}</div>
        <div className="big">{kpi.name}</div>
      </div>
      <div className="spacer" />
      <div className="right">
        <div className="small muted">{isSum(kpi) ? 'Target to distribute' : 'Target everyone carries'}</div>
        <div className="big">{kpi.type === 'completion' ? 'Fully achieved' : fmtValue(kpi.unit, amount, false)}</div>
      </div>
      <div className="right">
        <div className="small muted">Period</div>
        <div className="semi">{fmtRange(kpi.startDate, kpi.endDate)}</div>
      </div>
      {extra}
    </div>
  )
}

// =====================================================================
// Step 3 — Departments
// =====================================================================
function StepDepts({ state, draft, up, kpi, fieldErr, toast }) {
  const group = draft.depts[kpi.key]
  const rows = group?.rows || []
  const [copyOn, setCopyOn] = useState(false)
  const [source, setSource] = useState('')
  const [targets, setTargets] = useState([])
  const src = source || rows[0]?.unitId

  const units = state.departments.map((d) => {
    const head = byId(state.staff, d.headId)
    const tCount = state.teams.filter((t) => t.departmentId === d.id).length
    const sCount = state.staff.filter((s) => s.departmentId === d.id).length
    return { id: d.id, name: d.name, sub: `Head: ${head?.name || '—'} · ${tCount ? `${tCount} team${tCount > 1 ? 's' : ''}` : 'no teams'} · ${sCount} staff` }
  })

  const applyCopy = () => {
    const s = rows.find((r) => r.unitId === src)
    if (!s || !targets.length) return
    up((d) => {
      const g = (d.depts[kpi.key] ??= { method: 'percent', rows: [] })
      if (isSum(kpi) && g.method === 'equal') g.method = 'percent'
      const srcTeams = d.teams[kpi.key]?.[src]
      for (const t of targets) {
        const ex = g.rows.find((r) => r.unitId === t)
        const row = { unitId: t, percent: s.percent, startDate: s.startDate, endDate: s.endDate }
        if (ex) Object.assign(ex, row)
        else g.rows.push(row)
        // copy the distribution method for the teams (never the people)
        const deptTeams = state.teams.filter((x) => x.departmentId === t)
        if (deptTeams.length && srcTeams) {
          d.teams[kpi.key] ??= {}
          const m = srcTeams.method
          d.teams[kpi.key][t] = { method: m, rows: m === 'equal' || m === 'same' ? equalize(deptTeams.map((x) => ({ unitId: x.id, percent: isSum(kpi) ? 0 : null, startDate: s.startDate, endDate: s.endDate })), 0).map((r) => (isSum(kpi) ? r : { ...r, percent: null })) : [] }
        }
      }
    })
    toast(`Setup copied to ${targets.map((t) => byId(state.departments, t).name).join(', ')}. Values stay editable.`)
    setCopyOn(false)
    setTargets([])
  }

  return (
    <div>
      <TargetBanner kpi={kpi} label="Organization KPI" amount={kpiTarget(kpi)} />
      <AllocationEditor
        kpi={kpi}
        parentTarget={kpiTarget(kpi)}
        parentLabel={`${state.settings.orgName} — ${kpi.name}`}
        units={units}
        group={group}
        unitLabel="Department"
        onChange={(g) => up((d) => { d.depts[kpi.key] = g })}
        defaults={{ startDate: kpi.startDate, endDate: kpi.endDate }}
        fieldId={`dept.${kpi.key}`}
        error={fieldErr(`dept.${kpi.key}`)}
      />

      <div className="card card-pad mt-16">
        <label className="check">
          <input type="checkbox" checked={copyOn} disabled={!rows.length} onChange={(e) => setCopyOn(e.target.checked)} />
          <span className="semi">Copy this setup to other departments</span>
          <span className="small muted">— copies the share, period and team distribution method (not the people)</span>
        </label>
        {copyOn && (
          <div className="row wrap mt-12 gap-16">
            <Field label="Copy from">
              <select className="select sm" value={src} onChange={(e) => setSource(e.target.value)}>
                {rows.map((r) => <option key={r.unitId} value={r.unitId}>{byId(state.departments, r.unitId).name}</option>)}
              </select>
            </Field>
            <div className="field">
              <label>To departments</label>
              <div className="row wrap">
                {state.departments.filter((d) => d.id !== src).map((d) => (
                  <label key={d.id} className="check small">
                    <input type="checkbox" checked={targets.includes(d.id)} onChange={(e) => setTargets((t) => (e.target.checked ? [...t, d.id] : t.filter((x) => x !== d.id)))} />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn primary sm" disabled={!targets.length} onClick={applyCopy} style={{ alignSelf: 'flex-end' }}>
              <Copy size={14} /> Copy setup
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// =====================================================================
// Step 4 — Teams
// =====================================================================
function StepTeams({ state, draft, up, kpi, fieldErr, goTo }) {
  const drows = draft.depts[kpi.key]?.rows || []
  const [creating, setCreating] = useState(null)
  if (!drows.length)
    return (
      <div className="card">
        <Empty icon={<Building2 />} title={`“${kpi.name}” isn't shared with any department yet`} action={<button className="btn primary" onClick={() => goTo(2)}>Go to Departments</button>}>
          Allocate the KPI to departments first, or skip — the KPI can be tracked at organization level only.
        </Empty>
      </div>
    )
  return (
    <div className="col gap-20">
      {drows.map((dr) => {
        const dept = byId(state.departments, dr.unitId)
        const teams = state.teams.filter((t) => t.departmentId === dept.id)
        const dT = deptTarget(draft, kpi, dept.id)
        const direct = directPctOfDept(draft, kpi, dept.id)
        return (
          <div key={dept.id}>
            <div className="row mb-8">
              <span className="lvl department"><Building2 size={14} /></span>
              <h3>{dept.name}</h3>
              <span className="badge blue">{isSum(kpi) ? `${round(dr.percent || 0, 2)}% · ${fmtValue(kpi.unit, dT)}` : `Target ${kpi.type === 'completion' ? 'fully achieved' : fmtValue(kpi.unit, Number(kpi.target))}`}</span>
              <div className="spacer" />
              <button className="btn soft sm" onClick={() => setCreating(dept.id)}><Plus size={14} /> Create team</button>
            </div>
            {teams.length ? (
              <AllocationEditor
                kpi={kpi}
                parentTarget={dT}
                parentLabel={`${dept.name} — ${fmtValue(kpi.unit, dT)}`}
                units={teams.map((t) => ({ id: t.id, name: t.name, sub: `Lead: ${byId(state.staff, t.leadId)?.name || '—'} · ${state.staff.filter((s) => s.teamId === t.id).length} members` }))}
                group={draft.teams[kpi.key]?.[dept.id]}
                unitLabel="Team"
                otherUsed={direct}
                otherLabel="Direct members"
                onChange={(g) => up((d) => { (d.teams[kpi.key] ??= {})[dept.id] = g })}
                defaults={{ startDate: dr.startDate || kpi.startDate, endDate: dr.endDate || kpi.endDate }}
                fieldId={`team.${kpi.key}.${dept.id}`}
                error={fieldErr(`team.${kpi.key}.${dept.id}`)}
              />
            ) : (
              <div className="card card-pad row" style={{ background: 'var(--surface-2)' }}>
                <SkipForward size={18} color="var(--muted)" />
                <div className="spacer">
                  <div className="semi">{dept.name} has no teams — skipped.</div>
                  <div className="small muted">Its members contribute directly to the department. You can assign them in the next step, or create a team now.</div>
                </div>
                <button className="btn secondary sm" onClick={() => setCreating(dept.id)}><Plus size={14} /> Create a team</button>
              </div>
            )}
          </div>
        )
      })}
      {creating && <CreateTeamModal deptId={creating} onClose={() => setCreating(null)} />}
    </div>
  )
}

export function CreateTeamModal({ deptId, onClose }) {
  const { state, createTeam } = useStore()
  const { toast } = useFeedback()
  const dept = byId(state.departments, deptId)
  const deptStaff = state.staff.filter((s) => s.departmentId === deptId && s.active !== false)
  const [name, setName] = useState('')
  const [leadId, setLeadId] = useState('')
  const [members, setMembers] = useState([])
  const [tried, setTried] = useState(false)
  const dup = state.teams.some((t) => t.departmentId === deptId && t.name.trim().toLowerCase() === name.trim().toLowerCase())
  const nameErr = tried && (!name.trim() ? 'Team name is required.' : dup ? 'Team name already exists in this department, use another name.' : '')
  const save = () => {
    setTried(true)
    if (!name.trim() || dup) return
    createTeam({ name: name.trim(), departmentId: deptId, leadId: leadId || null, memberIds: members })
    toast(`Team "${name}" created in ${dept.name}.`)
    onClose()
  }
  return (
    <Modal
      title={`Create a team in ${dept.name}`}
      sub="Members come from this department (synced from HR). Each person shows whether they are already in a team."
      icon={<UsersRound size={20} />}
      onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Create team</button></>}
    >
      <div className="col gap-16">
        <Field label="Team name" required error={nameErr || undefined}>
          <input className={`input ${nameErr ? 'invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Team D" autoFocus />
        </Field>
        <Field label="Team lead">
          <select className="select" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">— none —</option>
            {deptStaff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.title}</option>)}
          </select>
        </Field>
        <div className="row wrap gap-8 small"><span className="badge gray">No team</span> {deptStaff.filter((s) => !s.teamId).length} people <span className="badge green">In a team</span> {deptStaff.filter((s) => s.teamId).length} people <span className="muted">(adding someone who is already in a team moves them to this one)</span></div>
        <StaffPicker state={state} candidates={deptStaff} selectedIds={members} teamFilter defaultOpen onToggle={(id) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))} title="Add members" />
        {members.length > 0 && (
          <div className="row wrap">
            {members.map((id) => <span key={id} className="chip">{byId(state.staff, id).name}</span>)}
          </div>
        )}
      </div>
    </Modal>
  )
}

// =====================================================================
// Step 5 — Individuals
// =====================================================================
function StepPeople({ state, draft, up, kpi, fieldErr, goTo }) {
  const drows = draft.depts[kpi.key]?.rows || []
  if (!drows.length)
    return (
      <div className="card">
        <Empty icon={<User />} title="Nothing to assign yet" action={<button className="btn primary" onClick={() => goTo(2)}>Go to Departments</button>}>
          Share “{kpi.name}” with departments (and optionally teams) first.
        </Empty>
      </div>
    )

  // people already used anywhere in this KPI (avoid assigning someone twice)
  const usedBy = {}
  for (const [gk, g] of Object.entries(draft.people[kpi.key] || {})) for (const r of g.rows) usedBy[r.unitId] = gk

  const group = (key, title, sub, parentTarget, candidates, allCandidates, otherUsed, defaults, showAllLabel, homeTeamId) => {
    const g = draft.people[kpi.key]?.[key]
    const rows = g?.rows || []
    const ids = rows.map((r) => r.unitId)
    const toggle = (sid) =>
      up((d) => {
        const bucket = ((d.people[kpi.key] ??= {})[key] ??= { method: defaultMethod(kpi), rows: [] })
        const ex = bucket.rows.find((r) => r.unitId === sid)
        bucket.rows = ex ? bucket.rows.filter((r) => r.unitId !== sid) : [...bucket.rows, { unitId: sid, percent: isSum(kpi) ? '' : null, startDate: defaults.startDate, endDate: defaults.endDate }]
        if (bucket.method === 'equal') bucket.rows = equalize(bucket.rows, otherUsed)
      })
    return (
      <div key={key} className="col gap-6">
        <div className="row">
          <div>
            <div className="semi">{title}</div>
            <div className="tiny muted">{sub}</div>
          </div>
          <div className="spacer" />
          <StaffPicker
            state={state}
            candidates={candidates}
            allCandidates={allCandidates}
            showAllLabel={showAllLabel}
            homeTeamId={homeTeamId}
            selectedIds={ids}
            disabledIds={Object.keys(usedBy).filter((sid) => usedBy[sid] !== key)}
            onToggle={toggle}
            title="Select people"
          />
        </div>
        <AllocationEditor
          kpi={kpi}
          parentTarget={parentTarget}
          parentLabel={`${title} — ${isSum(kpi) ? fmtValue(kpi.unit, parentTarget) : 'same target'}`}
          units={rows.map((r) => {
            const p = byId(state.staff, r.unitId)
            const outside = homeTeamId && p.teamId !== homeTeamId
            return { id: p.id, name: p.name, sub: outside ? `${p.title} · from ${byId(state.teams, p.teamId)?.name || byId(state.departments, p.departmentId)?.name} — contributes to this team` : p.title, avatar: true }
          })}
          selectable={false}
          group={g}
          unitLabel="Person"
          otherUsed={otherUsed}
          otherLabel="Teams"
          emptyText="No one selected. Use “Select people” to pick staff from HR."
          onChange={(ng) => up((d) => { (d.people[kpi.key] ??= {})[key] = ng })}
          defaults={defaults}
          fieldId={`people.${kpi.key}.${key}`}
          error={fieldErr(`people.${kpi.key}.${key}`)}
        />
      </div>
    )
  }

  return (
    <div className="col gap-20">
      <Alert>People are picked from the staff list synced from HR — they are never typed in or created here. Search, tick several at once, then share the target.</Alert>
      {drows.map((dr) => {
        const dept = byId(state.departments, dr.unitId)
        const trows = draft.teams[kpi.key]?.[dept.id]?.rows || []
        const deptStaff = state.staff.filter((s) => s.departmentId === dept.id && s.active !== false)
        const allStaff = state.staff.filter((s) => s.active !== false && s.departmentId)
        const dDefaults = { startDate: dr.startDate || kpi.startDate, endDate: dr.endDate || kpi.endDate }
        return (
          <div key={dept.id} className="card card-pad">
            <div className="row mb-16">
              <span className="lvl department"><Building2 size={14} /></span>
              <h3>{dept.name}</h3>
              <span className="badge blue">{isSum(kpi) ? fmtValue(kpi.unit, deptTarget(draft, kpi, dept.id)) : 'same target'}</span>
            </div>
            <div className="col gap-20">
              {trows.map((tr) => {
                const team = byId(state.teams, tr.unitId)
                return group(
                  `team:${team.id}`,
                  team.name,
                  `${isSum(kpi) ? `${round(tr.percent || 0, 2)}% of ${dept.name}` : 'Team'} · Lead: ${byId(state.staff, team.leadId)?.name || '—'}`,
                  teamTarget(draft, kpi, dept.id, team.id),
                  deptStaff.filter((s) => s.teamId === team.id),
                  allStaff,
                  0,
                  { startDate: tr.startDate || dDefaults.startDate, endDate: tr.endDate || dDefaults.endDate },
                  'Include people outside this team (they contribute to it)',
                  team.id,
                )
              })}
              {group(
                `dept:${dept.id}`,
                trows.length ? `${dept.name} — direct members (no team)` : `${dept.name} members`,
                trows.length ? 'Members without a team contribute directly to the department.' : 'This department has no teams allocated, so members contribute directly.',
                deptTarget(draft, kpi, dept.id),
                trows.length ? deptStaff.filter((s) => !s.teamId) : deptStaff,
                allStaff,
                teamsPctOfDept(draft, kpi, dept.id),
                dDefaults,
                'Include people from other teams or departments',
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =====================================================================
// Step 6 — Review: the entire setup on one page, each part with an "Adjust" shortcut
// =====================================================================
const METHOD_LABEL = { equal: 'Split equally', percent: 'By percentage', amount: 'Entered amounts', same: 'Same target for everyone' }

function AdjustBtn({ onClick, label = 'Adjust' }) {
  return (
    <button className="btn o-purple xs" onClick={onClick} title="Go back to this step — nothing is lost">
      <PencilLine size={12} /> {label}
    </button>
  )
}

function StepReview({ state, draft, errors, warnings, cycle, onFix, onAdjust }) {
  const g = draft.goal
  const counts = { depts: 0, teams: 0, people: 0 }
  for (const k of draft.kpis) {
    counts.depts += draft.depts[k.key]?.rows.length || 0
    for (const t of Object.values(draft.teams[k.key] || {})) counts.teams += t.rows.length
    for (const p of Object.values(draft.people[k.key] || {})) counts.people += p.rows.length
  }
  return (
    <div className="col gap-16">
      <div className="hero">
        <div className="label">Review · {cycle?.name}</div>
        <h1>{g.name || 'Untitled goal'}</h1>
        <p style={{ color: '#e6efff', marginTop: 6, maxWidth: 680 }}>This is everything you have set up. Check each part and use <b>Adjust</b> to change it — you come straight back here afterwards.</p>
        <div className="row wrap gap-16 mt-16">
          <div className="hero-stat"><div className="v">{draft.kpis.length}</div><div className="k">KPIs</div></div>
          <div className="hero-stat"><div className="v">{counts.depts}</div><div className="k">Department allocations</div></div>
          <div className="hero-stat"><div className="v">{counts.teams}</div><div className="k">Team allocations</div></div>
          <div className="hero-stat"><div className="v">{counts.people}</div><div className="k">People allocations</div></div>
        </div>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="card">
          <div className="card-head">
            {errors.length ? <AlertCircle size={18} color="var(--red)" /> : <AlertTriangle size={18} color="var(--amber)" />}
            <b>{errors.length ? `${errors.length} issue${errors.length > 1 ? 's' : ''} to fix before saving` : 'Ready to save — a few notes'}</b>
            {warnings.length > 0 && <Badge tone="amber">{warnings.length} note{warnings.length > 1 ? 's' : ''}</Badge>}
          </div>
          <div className="card-body col gap-6">
            {errors.map((e, i) => (
              <div key={`e${i}`} className="row small">
                <Badge tone="red">Step {e.step + 1}</Badge>
                <span className="spacer">{e.msg}</span>
                <button className="btn secondary xs" onClick={() => onFix(e)}>Fix</button>
              </div>
            ))}
            {warnings.map((w, i) => (
              <div key={`w${i}`} className="row small">
                <Badge tone="amber">Step {w.step + 1}</Badge>
                <span className="spacer muted">{w.msg}</span>
                <AdjustBtn onClick={() => onAdjust(w.step, w.kpiKey)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1 — Goal */}
      <div className="summary-section">
        <div className="card-head">
          <span className="badge navy">1</span>
          <h3>Goal</h3>
          <div className="spacer" />
          <AdjustBtn onClick={() => onAdjust(0)} />
        </div>
        <div className="card-body">
          <div className="kv-grid">
            <div><div className="k">Name</div><div className="v">{g.name || '—'}</div></div>
            <div><div className="k">Type</div><div className="v">{KPI_TYPES[g.type].label}</div></div>
            <div><div className="k">Weight</div><div className="v">100% (tracked on its own)</div></div>
            <div><div className="k">Review cycle</div><div className="v">{cycle?.name}</div></div>
            <div><div className="k">Start date</div><div className="v">{fmtDate(g.startDate)}</div></div>
            <div><div className="k">End date</div><div className="v">{fmtDate(g.endDate)}</div></div>
          </div>
          {g.description && <p className="small muted mt-12">{g.description}</p>}
        </div>
      </div>

      {/* 2 — KPIs */}
      <div className="summary-section">
        <div className="card-head">
          <span className="badge navy">2</span>
          <h3>KPIs</h3>
          <span className="small muted">organization level</span>
          <div className="spacer" />
          <AdjustBtn onClick={() => onAdjust(1)} />
        </div>
        <div className="scroll-x">
          <table className="table compact">
            <thead><tr><th>KPI</th><th>Type</th><th>Unit</th><th className="right">Start</th><th className="right">Organization target</th><th className="right">Contribution to goal</th><th>Period</th><th /></tr></thead>
            <tbody>
              {draft.kpis.length === 0 && <tr><td colSpan={8} className="muted center">No KPIs yet.</td></tr>}
              {draft.kpis.map((k) => (
                <tr key={k.key}>
                  <td className="semi">{k.name || 'Untitled KPI'}{k.description && <div className="tiny muted">{k.description}</div>}</td>
                  <td><Badge tone="blue">{KPI_TYPES[k.type].label}</Badge></td>
                  <td>{k.type === 'completion' ? '%' : k.unit}</td>
                  <td className="right mono">{k.type === 'average' ? k.startValue : '—'}</td>
                  <td className="right mono bold">{k.type === 'completion' ? 'Fully achieved' : fmtValue(k.unit, kpiTarget(k), false)}</td>
                  <td className="right mono">{k.weight}%</td>
                  <td className="small nowrap">{fmtRange(k.startDate, k.endDate)}</td>
                  <td className="right"><AdjustBtn onClick={() => onAdjust(1, k.key)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3–5 — Allocations per KPI */}
      {draft.kpis.map((k, i) => (
        <div key={k.key} className="summary-section">
          <div className="card-head">
            <span className="badge navy">{3 + i > 3 ? `3.${i + 1}` : '3'}</span>
            <span className="lvl organization"><Target size={14} /></span>
            <div>
              <h3>Who contributes to “{k.name || 'Untitled KPI'}”</h3>
              <div className="tiny muted">Department → team → person, with each one's share, target and period</div>
            </div>
            <div className="spacer" />
            <AdjustBtn onClick={() => onAdjust(2, k.key)} label="Departments" />
            <AdjustBtn onClick={() => onAdjust(3, k.key)} label="Teams" />
            <AdjustBtn onClick={() => onAdjust(4, k.key)} label="People" />
          </div>
          <ReviewTree state={state} draft={draft} k={k} onAdjust={onAdjust} />
        </div>
      ))}

      {errors.length === 0 && (
        <Alert tone="success">Everything checks out. Click <b>Save goal</b> to create the goal, its KPIs and every allocation in one go. It will be <b>Ready</b> — start it running from the goal page when its start date arrives.</Alert>
      )}
    </div>
  )
}

function ReviewTree({ state, draft, k, onAdjust }) {
  const unit = k.type === 'completion' ? '%' : k.unit
  const rows = []
  const drows = draft.depts[k.key]?.rows || []
  const method = (g) => (g ? METHOD_LABEL[isSum(k) ? (g.method === 'same' ? 'equal' : g.method) : 'same'] : null)
  const totalLine = (pct, parentAmt) =>
    isSum(k) ? (
      <span className={`badge ${pct > 100.0001 ? 'red' : pct >= 99.99 ? 'green' : 'amber'}`}>
        {round(pct, 2)}% allocated · {round(Math.max(0, 100 - pct), 2)}% ({fmtValue(unit, (parentAmt * Math.max(0, 100 - pct)) / 100)}) left
      </span>
    ) : null
  rows.push({ lvl: 'organization', depth: 0, step: 1, name: `${state.settings.orgName} (organization)`, pct: 100, amt: kpiTarget(k), dates: [k.startDate, k.endDate], method: method(draft.depts[k.key]), total: drows.length ? totalLine(pctTotal(drows), kpiTarget(k)) : <span className="tiny muted">not shared yet</span> })
  for (const d of drows) {
    const dept = byId(state.departments, d.unitId)
    const dAmt = deptTarget(draft, k, d.unitId)
    const tg = draft.teams[k.key]?.[d.unitId]
    const trows = tg?.rows || []
    const dg = draft.people[k.key]?.[`dept:${d.unitId}`]
    const direct = dg?.rows || []
    rows.push({ lvl: 'department', depth: 1, step: 2, name: dept.name, pct: d.percent, amt: dAmt, dates: [d.startDate, d.endDate], method: trows.length ? method(tg) : direct.length ? method(dg) : null, total: trows.length || direct.length ? totalLine(pctTotal(trows) + pctTotal(direct), dAmt) : <span className="tiny muted">no further split</span> })
    for (const t of trows) {
      const team = byId(state.teams, t.unitId)
      const tAmt = teamTarget(draft, k, d.unitId, t.unitId)
      const pg = draft.people[k.key]?.[`team:${t.unitId}`]
      const prows = pg?.rows || []
      rows.push({ lvl: 'team', depth: 2, step: 3, name: team.name, pct: t.percent, amt: tAmt, dates: [t.startDate, t.endDate], method: prows.length ? method(pg) : null, total: prows.length ? totalLine(pctTotal(prows), tAmt) : <span className="tiny muted">no people yet</span> })
      for (const p of prows) rows.push({ lvl: 'individual', depth: 3, step: 4, name: byId(state.staff, p.unitId).name, sub: byId(state.staff, p.unitId).title, pct: p.percent, amt: (tAmt * (Number(p.percent) || 0)) / 100, dates: [p.startDate, p.endDate] })
    }
    for (const p of direct) rows.push({ lvl: 'individual', depth: 2, step: 4, name: byId(state.staff, p.unitId).name, sub: 'direct member (no team)', pct: p.percent, amt: (dAmt * (Number(p.percent) || 0)) / 100, dates: [p.startDate, p.endDate] })
  }
  const Icon = { organization: Target, department: Building2, team: UsersRound, individual: User }
  return (
    <div className="scroll-x">
      <table className="table compact">
        <thead>
          <tr><th>Level / unit</th><th className="right">Share</th><th className="right">Target</th><th>Period</th><th>Split below</th><th>Allocation check</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const I = Icon[r.lvl]
            return (
              <tr key={i}>
                <td>
                  <div className="row gap-6" style={{ paddingLeft: r.depth * 22 }}>
                    <span className={`lvl ${r.lvl}`}><I size={13} /></span>
                    <div>
                      <span className={r.depth === 0 ? 'bold' : 'semi'}>{r.name}</span>
                      {r.sub && <div className="tiny muted">{r.sub}</div>}
                    </div>
                  </div>
                </td>
                <td className="right mono">{isSum(k) ? `${round(Number(r.pct) || 0, 2)}%` : <span className="muted">same</span>}</td>
                <td className="right mono bold">{k.type === 'completion' ? 'Full' : isSum(k) ? fmtValue(unit, r.amt) : fmtValue(unit, Number(k.target))}</td>
                <td className="small muted nowrap">{fmtRange(r.dates[0] || k.startDate, r.dates[1] || k.endDate)}</td>
                <td className="small">{r.method || <span className="muted">—</span>}</td>
                <td>{r.total}</td>
                <td className="right"><AdjustBtn onClick={() => onAdjust(r.step, k.key)} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// =====================================================================
// Done
// =====================================================================
function DoneScreen({ state, draft, goalId, startGoal }) {
  const { toast } = useFeedback()
  const goal = byId(state.goals, goalId)
  const cycle = byId(state.cycles, draft.cycleId)
  const canStart = goal && goal.status === 'ready' && cycle?.status === 'active' && goal.startDate <= todayISO()
  return (
    <div className="card card-pad" style={{ maxWidth: 760, margin: '30px auto', textAlign: 'center', padding: 40 }}>
      <div style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto 18px', display: 'grid', placeItems: 'center', background: 'var(--green-bg)' }}>
        <Sparkles size={36} color="var(--green)" />
      </div>
      <h1>“{draft.goal.name}” is set up</h1>
      <p className="muted mt-8" style={{ maxWidth: 520, margin: '8px auto 0' }}>
        The goal, {draft.kpis.length} KPI{draft.kpis.length > 1 ? 's' : ''} and every department, team and individual allocation were saved in one go. Status: <b>Ready</b>.
        {!canStart && goal && goal.startDate > todayISO() && <> It can start running from {fmtDate(goal.startDate)}.</>}
      </p>
      <div className="row mt-24" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={() => navigate(`/wizard?new=${Date.now()}`)}><Plus size={16} /> Set up the next goal</button>
        <Link to={`/goals/${goalId}`} className="btn secondary">View goal</Link>
        {canStart && (
          <button className="btn success" onClick={() => { startGoal(goalId); toast('Goal is now running.'); navigate(`/goals/${goalId}`) }}>
            <Play size={16} /> Start running now
          </button>
        )}
      </div>
    </div>
  )
}


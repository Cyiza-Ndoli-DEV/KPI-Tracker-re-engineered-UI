// Admin Settings → Set up (labels, bands, score weights, update rules) and Org Fit scores.
import { useState } from 'react'
import { Check, Plus, X, SlidersHorizontal, Award, Scale, Clock, Users, Search } from 'lucide-react'
import { useStore } from '../store'
import { Field, NumInput, Badge, Alert, Avatar, useFeedback, ScoreDot } from '../components/ui'
import { byId, DEFAULT_BANDS, personScore, band } from '../lib/calc'
import { fmtPct, round } from '../lib/utils'

const TONES = ['green', 'blue', 'amber', 'red', 'violet', 'gray']

export function SetupPanel() {
  const { state, updateSettings } = useStore()
  const { toast } = useFeedback()
  const st = state.settings
  const [orgName, setOrgName] = useState(st.orgName)
  const [bands, setBands] = useState(structuredClone(st.bands || DEFAULT_BANDS))
  const [scoring, setScoring] = useState({ ...(st.scoring || { kpiWeight: 70, orgFitWeight: 30 }) })
  const [days, setDays] = useState(st.editWindowDays)
  const [presets, setPresets] = useState(st.partialPresets)
  const [newPreset, setNewPreset] = useState('')
  const [staleDays, setStaleDays] = useState(st.staleDays ?? 30)
  const [pipBelow, setPipBelow] = useState(st.pipBelow ?? 50)

  const sorted = [...bands].sort((a, b) => Number(b.min) - Number(a.min))
  const errors = []
  if (!orgName.trim()) errors.push('Organization name is required.')
  if (bands.some((b) => !String(b.label).trim())) errors.push('Every band needs a label.')
  if (new Set(bands.map((b) => Number(b.min))).size !== bands.length) errors.push('Two bands cannot start at the same score.')
  if (!bands.some((b) => Number(b.min) === 0)) errors.push('The lowest band must start at 0%.')
  if (Number(scoring.kpiWeight) + Number(scoring.orgFitWeight) !== 100) errors.push('KPI weight + Org Fit weight must equal 100%.')
  if (!(Number(days) >= 1)) errors.push('The edit window must be at least 1 day.')
  if (!presets.length) errors.push('Keep at least one partial-completion preset.')

  const save = () => {
    if (errors.length) return toast(errors[0], 'error')
    updateSettings({
      orgName: orgName.trim(),
      bands: sorted.map((b) => ({ ...b, label: b.label.trim(), min: Number(b.min) })),
      scoring: { kpiWeight: Number(scoring.kpiWeight), orgFitWeight: Number(scoring.orgFitWeight) },
      editWindowDays: Number(days),
      partialPresets: presets,
      staleDays: Number(staleDays),
      pipBelow: Number(pipBelow),
    })
    toast('Set up saved. Every page now uses the new labels and percentages.')
  }
  const setBand = (i, patch) => setBands(bands.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const addPreset = () => {
    const v = Number(newPreset)
    if (!(v > 0 && v < 100) || presets.includes(v)) return toast('Presets must be unique, between 1 and 99%.', 'error')
    setPresets([...presets, v].sort((a, b) => a - b))
    setNewPreset('')
  }

  return (
    <div className="col gap-16">
      <div className="grid g-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><Award size={18} color="var(--blue-600)" /><h3>Performance bands</h3><span className="small muted">labels and the score each one starts at</span></div>
          <div className="card-body col gap-10">
            <table className="table compact">
              <thead><tr><th>Label</th><th className="right" style={{ width: 130 }}>From score</th><th>Colour</th><th /></tr></thead>
              <tbody>
                {bands.map((b, i) => (
                  <tr key={i}>
                    <td><input className="input sm" value={b.label} onChange={(e) => setBand(i, { label: e.target.value })} /></td>
                    <td className="right"><div className="input-group" style={{ width: 110, marginLeft: 'auto' }}><NumInput className="input sm pr" value={b.min} min={0} onChange={(v) => setBand(i, { min: v })} /><span className="addon">%+</span></div></td>
                    <td><select className="select sm" style={{ width: 'auto' }} value={b.tone} onChange={(e) => setBand(i, { tone: e.target.value })}>{TONES.map((t) => <option key={t}>{t}</option>)}</select></td>
                    <td className="right">{bands.length > 2 && <button className="btn ghost xs" onClick={() => setBands(bands.filter((_, j) => j !== i))}><X size={13} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row">
              <button className="btn soft sm" onClick={() => setBands([...bands, { key: `band${Date.now()}`, label: 'New band', min: 85, tone: 'violet' }])}><Plus size={14} /> Add band</button>
              <div className="spacer" />
              <button className="btn ghost sm" onClick={() => setBands(structuredClone(DEFAULT_BANDS))}>Restore defaults</button>
            </div>
            <div className="small muted">Preview (highest first):</div>
            <div className="row wrap gap-6">
              {sorted.map((b, i) => <Badge key={i} tone={b.tone}>{b.label} · {b.min}%{i === 0 ? ' and above' : ` – ${round(Number(sorted[i - 1].min) - 0.01, 2)}%`}</Badge>)}
            </div>
          </div>
        </div>

        <div className="col gap-16">
          <div className="card">
            <div className="card-head"><Scale size={18} color="var(--blue-600)" /><h3>Final score</h3></div>
            <div className="card-body col gap-12">
              <div className="grid g-2">
                <Field label="KPI score weight"><div className="input-group"><NumInput className="input pr" value={scoring.kpiWeight} onChange={(v) => setScoring({ kpiWeight: v, orgFitWeight: 100 - (Number(v) || 0) })} /><span className="addon">%</span></div></Field>
                <Field label="Org Fit score weight"><div className="input-group"><NumInput className="input pr" value={scoring.orgFitWeight} onChange={(v) => setScoring({ orgFitWeight: v, kpiWeight: 100 - (Number(v) || 0) })} /><span className="addon">%</span></div></Field>
              </div>
              <div className="formula small">
                <div><b>Member</b> = average of their own KPIs × {scoring.kpiWeight}% + Org Fit × {scoring.orgFitWeight}%</div>
                <div className="mt-4"><b>Team lead</b> = average of their team members' KPI scores × {scoring.kpiWeight}% + their own Org Fit × {scoring.orgFitWeight}%</div>
                <div className="tiny muted mt-4">Org Fit scores come from supervisor and peer ratings. Until a person is rated, the KPI part alone is shown.</div>
              </div>
              <Field label="“Available for PIP” when the final score is below" hint="Listed in Reports for a performance improvement plan.">
                <div className="input-group" style={{ width: 140 }}><NumInput className="input pr" value={pipBelow} onChange={setPipBelow} /><span className="addon">%</span></div>
              </Field>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><SlidersHorizontal size={18} color="var(--blue-600)" /><h3>General</h3></div>
            <div className="card-body">
              <Field label="Organization name" hint="Shown at the top of every KPI hierarchy."><input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></Field>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><Clock size={18} color="var(--blue-600)" /><h3>Update rules</h3></div>
        <div className="card-body grid g-3">
          <Field label="Edit window" hint="A submitted result can be edited for this many days, then it locks (Request edit).">
            <div className="input-group" style={{ maxWidth: 170 }}><NumInput className="input pr" value={days} min={1} onChange={setDays} /><span className="addon">days</span></div>
          </Field>
          <Field label="“Has not updated” after" hint="People with no result for this long are flagged in Reports.">
            <div className="input-group" style={{ maxWidth: 170 }}><NumInput className="input pr" value={staleDays} min={1} onChange={setStaleDays} /><span className="addon">days</span></div>
          </Field>
          <Field label="Partial-completion presets" hint="Offered for “Partially achieved”; people can also type another %.">
            <div className="row wrap gap-6">
              {presets.map((p) => <span key={p} className="chip">{p}%<button onClick={() => setPresets(presets.filter((x) => x !== p))} aria-label={`Remove ${p}%`}><X size={12} /></button></span>)}
              <div className="input-group" style={{ width: 96 }}><NumInput className="input sm pr" value={newPreset} onChange={setNewPreset} placeholder="90" /><span className="addon">%</span></div>
              <button className="btn soft sm" onClick={addPreset}><Plus size={14} /></button>
            </div>
          </Field>
        </div>
      </div>

      <div className="row">
        {errors.length > 0 && <span className="small" style={{ color: 'var(--red)' }}>{errors[0]}</span>}
        <div className="spacer" />
        <button className="btn primary" onClick={save}><Check size={15} /> Save set up</button>
      </div>
    </div>
  )
}

export function OrgFitPanel() {
  const { state } = useStore()
  const cycle = byId(state.cycles, state.viewCycleId)
  const [q, setQ] = useState('')
  const people = state.staff.filter((s) => s.active !== false && s.departmentId && s.name.toLowerCase().includes(q.trim().toLowerCase()))
  const w = state.settings.scoring || { kpiWeight: 70, orgFitWeight: 30 }
  return (
    <div className="card">
      <div className="card-head">
        <Users size={18} color="var(--blue-600)" /><h3>Organizational Fit scores · {cycle.name}</h3>
        <span className="small muted">read-only · calculated from supervisor and peer ratings · counts for {w.orgFitWeight}% of the final score</span>
        <div className="spacer" />
        <div className="input-group" style={{ width: 200 }}><Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} /><input className="input sm" style={{ paddingLeft: 30 }} placeholder="Search person" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th>Person</th><th>Department / team</th><th className="center">KPI score</th><th className="center">Org Fit score</th><th className="center">Final score</th><th>Band</th></tr></thead>
          <tbody>
            {people.map((p) => {
              const sc = personScore(state, p.id, cycle.id)
              return (
                <tr key={p.id}>
                  <td><div className="row gap-6"><Avatar name={p.name} size="sm" /><div><div className="semi small">{p.name}</div><div className="tiny muted">{p.title}{sc.isLead ? ' · team lead' : ''}</div></div></div></td>
                  <td className="small">{byId(state.departments, p.departmentId)?.name}{p.teamId ? ` · ${byId(state.teams, p.teamId)?.name}` : ''}</td>
                  <td className="center">{sc.kpiPart === null ? <span className="tiny muted">no KPIs</span> : <ScoreDot value={sc.kpiPart} title={sc.isLead ? `Average of ${sc.members} team members` : 'Average of own KPIs'} />}</td>
                  <td className="center">{sc.orgFit === null ? <span className="tiny muted">not rated yet</span> : <ScoreDot value={sc.orgFit} muted />}</td>
                  <td className="center">{sc.final === null ? <span className="tiny muted">—</span> : <ScoreDot value={sc.final} size="lg" />}</td>
                  <td>{sc.final === null ? <span className="tiny muted">—</span> : <Badge tone={band(state, sc.final).tone}>{band(state, sc.final).label}</Badge>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Alert style={{ margin: 16 }}>Org Fit scores are not entered here: they come from the supervisor and peer ratings of the professional attributes. Final score = KPI score × {w.kpiWeight}% + Org Fit score × {w.orgFitWeight}%.</Alert>
    </div>
  )
}

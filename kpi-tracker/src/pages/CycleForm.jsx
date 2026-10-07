// Full-page form to create or edit a review cycle.
import { useState } from 'react'
import { CalendarRange, CheckCircle2, Copy, Award, Info } from 'lucide-react'
import { useStore } from '../store'
import { BackLink, Field, Alert, Link, useFeedback, navigate } from '../components/ui'
import BandScale from '../components/BandScale'
import { byId, cycleGoals } from '../lib/calc'
import { addDays, daysBetween, fmtRange, uid } from '../lib/utils'

export const overlaps = (state, start, end, ignoreId) => state.cycles.find((c) => c.id !== ignoreId && start <= c.endDate && end >= c.startDate)

export default function CycleForm({ id }) {
  const { state, createCycle, updateCycle, reuseCycle } = useStore()
  const { toast } = useFeedback()
  const cycle = id ? byId(state.cycles, id) : null
  const latest = [...state.cycles].sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
  const defStart = latest ? addDays(latest.endDate, 1) : '2027-01-01'
  const [f, setF] = useState(
    cycle
      ? { name: cycle.name, description: cycle.description || '', startDate: cycle.startDate, endDate: cycle.endDate }
      : { name: `FY ${defStart.slice(0, 4)} Review`, description: '', startDate: defStart, endDate: addDays(`${Number(defStart.slice(0, 4)) + 1}${defStart.slice(4)}`, -1) },
  )
  const [copyFrom, setCopyFrom] = useState('')
  const [tried, setTried] = useState(false)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  if (id && !cycle) return <Alert tone="error">Cycle not found. <Link to="/cycles">Back to review cycles</Link></Alert>
  const locked = cycle && cycle.status !== 'draft'

  const errs = {}
  if (!f.name.trim()) errs.name = 'Cycle name is required.'
  else if (state.cycles.some((c) => c.id !== cycle?.id && c.name.trim().toLowerCase() === f.name.trim().toLowerCase())) errs.name = 'A cycle with this name already exists.'
  if (!f.startDate) errs.startDate = 'Start date is required.'
  if (!f.endDate) errs.endDate = 'End date is required.'
  else if (f.endDate < f.startDate) errs.endDate = 'End date must be after the start date.'
  const ov = f.startDate && f.endDate && overlaps(state, f.startDate, f.endDate, cycle?.id)
  if (ov) errs.startDate = `These dates overlap with ${ov.name} (${fmtRange(ov.startDate, ov.endDate)}).`
  const E = (k) => (tried ? errs[k] : undefined)
  const sources = state.cycles.filter((c) => c.id !== cycle?.id && cycleGoals(state, c.id).length)

  const save = () => {
    setTried(true)
    if (Object.keys(errs).length) return toast(Object.values(errs)[0], 'error')
    const data = { name: f.name.trim(), description: f.description.trim(), startDate: f.startDate, endDate: f.endDate }
    if (cycle) {
      updateCycle(cycle.id, data)
      toast('Cycle updated.')
    } else if (copyFrom) {
      reuseCycle(copyFrom, { mode: 'new', ...data })
      toast(`${data.name} created. The goals of ${byId(state.cycles, copyFrom).name} are waiting as drafts.`)
    } else {
      createCycle(data, uid('c'))
      toast(`${data.name} created as a draft. Activate it when you're ready.`)
    }
    navigate('/cycles')
  }

  return (
    <div className="col gap-16" style={{ maxWidth: 980 }}>
      <div>
        <BackLink to="/cycles" label="Review cycles" />
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <h1>{cycle ? `Edit ${cycle.name}` : 'New review cycle'}</h1>
            <div className="sub">A cycle groups the organization's goals for one review period. Goals and KPIs can have shorter periods inside it.</div>
          </div>
        </div>
      </div>

      <form className="card" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="form-section">
          <div className="form-section-head"><span className="form-no">1</span><div><h3>Cycle details</h3><div className="small muted">How the cycle appears everywhere in the tracker.</div></div></div>
          <div className="grid g-2">
            <Field label="Cycle name" required error={E('name')}><input className={`input ${E('name') ? 'invalid' : ''}`} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. FY 2027 Review" /></Field>
            <Field label="Status"><input className="input" disabled value={cycle ? cycle.status : 'Draft (activate it from Review cycles)'} /></Field>
          </div>
          <Field label="Description" style={{ marginTop: 12 }}><textarea className="textarea" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Annual performance review for all staff. Mid-year check-in in July." /></Field>
        </div>

        <div className="form-section">
          <div className="form-section-head"><span className="form-no">2</span><div><h3>Review period</h3><div className="small muted">Cycles cannot overlap. {locked ? 'Dates are fixed once a cycle is active.' : ''}</div></div></div>
          <div className="grid g-3">
            <Field label="Start date" required error={E('startDate')}><input type="date" disabled={locked} className={`input ${E('startDate') ? 'invalid' : ''}`} value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
            <Field label="End date" required error={E('endDate')}><input type="date" disabled={locked} className={`input ${E('endDate') ? 'invalid' : ''}`} value={f.endDate} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
            <Field label="Length"><input className="input" disabled value={f.startDate && f.endDate && f.endDate >= f.startDate ? `${daysBetween(f.startDate, f.endDate)} days` : '—'} /></Field>
          </div>
          {latest && !cycle && <div className="tiny muted mt-8"><Info size={12} /> The latest cycle, {latest.name}, ends on {fmtRange(latest.endDate, latest.endDate)}; the new one starts the next day by default.</div>}
        </div>

        <div className="form-section">
          <div className="form-section-head"><span className="form-no">3</span><div><h3>Performance bands</h3><div className="small muted">Scores are labelled with the bands from Admin Settings → Set up.</div></div><div className="spacer" /><Link to="/admin" className="btn ghost sm"><Award size={14} /> Change in Set up</Link></div>
          <BandScale />
        </div>

        {!cycle && (
          <div className="form-section">
            <div className="form-section-head"><span className="form-no">4</span><div><h3>Start from a previous cycle (optional)</h3><div className="small muted">Copies every goal, KPI and allocation into editable drafts. Results are never copied.</div></div></div>
            <Field label="Copy goals from">
              <select className="select" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} style={{ maxWidth: 420 }}>
                <option value="">Start empty</option>
                {sources.map((c) => <option key={c.id} value={c.id}>{c.name} — {cycleGoals(state, c.id).length} goal(s)</option>)}
              </select>
            </Field>
            {copyFrom && <Alert style={{ marginTop: 10 }}><Copy size={14} /> {cycleGoals(state, copyFrom).length} goal(s) from {byId(state.cycles, copyFrom).name} will appear under <b>Drafts</b>, ready to adjust and save.</Alert>}
          </div>
        )}

        <div className="form-foot">
          <Link to="/cycles" className="btn secondary">Cancel</Link>
          <button type="submit" className="btn primary"><CheckCircle2 size={15} /> {cycle ? 'Save changes' : 'Create cycle'}</button>
        </div>
      </form>
      <div className="small muted row gap-6"><CalendarRange size={14} /> After creating it: activate the cycle, then set up its goals in the wizard.</div>
    </div>
  )
}

import { useState } from 'react'
import { CalendarRange, Plus, Play, Square, Wand2, Copy, PencilLine, CheckCircle2, ArrowRight, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Modal, Field, NumInput, Badge, Alert, Ring, useFeedback, navigate, Seg } from '../components/ui'
import { cycleGoals, cycleScore, band, goalKpis } from '../lib/calc'
import BandScale from '../components/BandScale'
import { fmtRange, daysBetween, addDays, uid } from '../lib/utils'

export default function Cycles() {
  const { state, activateCycle, endCycle, setViewCycle } = useStore()
  const { toast, confirm } = useFeedback()
  const [reuse, setReuse] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const active = state.cycles.find((c) => c.status === 'active')
  const cycles = [...state.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))

  const doActivate = async (c) => {
    if (active) return toast(`Only one review cycle can be active at a time. End "${active.name}" first.`, 'error')
    if (await confirm({ title: `Activate ${c.name}?`, message: 'Goals in this cycle can then be started and tracked.', okLabel: 'Activate' })) {
      activateCycle(c.id)
      toast(`${c.name} is now active.`)
    }
  }
  const doEnd = async (c) => {
    if (await confirm({ title: `End ${c.name}?`, message: 'All running goals in this cycle are stopped and their progress is frozen. Every result stays in history, and you can start the next cycle from this one.', okLabel: 'End cycle', danger: true })) {
      endCycle(c.id)
      toast(`${c.name} has ended. Results are kept.`)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Review cycles</h1>
          <div className="sub">Create a cycle, activate it, set up its goals in the wizard — then start the next cycle from the previous one.</div>
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => navigate('/cycles/new')}><Plus size={16} /> New review cycle</button>
      </div>

      <div className="card card-pad mb-16">
        <div className="row wrap gap-6" style={{ justifyContent: 'space-between' }}>
          {[
            ['1', 'Create cycle', 'Name, dates & description'],
            ['2', 'Activate', 'Only one active at a time'],
            ['3', 'Set up goals', 'One lane: goal → KPIs → people'],
            ['4', 'Track', 'People update, results roll up'],
            ['5', 'End & reuse', 'Next cycle starts from this one'],
          ].map(([n, t, s], i, arr) => (
            <div key={n} className="row gap-6" style={{ flex: 1, minWidth: 170 }}>
              <span className="avatar sm" style={{ background: 'var(--blue-600)' }}>{n}</span>
              <div><div className="semi small">{t}</div><div className="tiny muted">{s}</div></div>
              {i < arr.length - 1 && <ArrowRight size={14} color="var(--muted)" style={{ marginLeft: 'auto' }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="col gap-16">
        {cycles.map((c) => {
          const goals = cycleGoals(state, c.id)
          const score = cycleScore(state, c.id)
          const b = band(state, score)
          return (
            <div key={c.id} className="card">
              <div className="card-pad row wrap gap-20">
                <Ring value={score} size={60} stroke={6} color={c.status === 'ended' ? '#94a3b8' : 'var(--blue-600)'} sub="avg. goal" />
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div className="row gap-6">
                    <h2>{c.name}</h2>
                    <Badge tone={c.status === 'active' ? 'green' : c.status === 'draft' ? 'gray' : 'red'} dot>{c.status}</Badge>
                    {goals.length > 0 && <Badge tone={b.tone}>{b.label}</Badge>}
                  </div>
                  {c.description && <div className="small mt-4">{c.description}</div>}
                  <div className="small muted mt-4">{fmtRange(c.startDate, c.endDate)} · {daysBetween(c.startDate, c.endDate)} days · {goals.length} goal{goals.length === 1 ? '' : 's'}</div>
                  <div className="mt-12" style={{ maxWidth: 520 }}>
                    <BandScale />
                  </div>
                </div>
                <div className="row wrap">
                  {c.status !== 'ended' && <button className="btn secondary sm" onClick={() => navigate(`/cycles/${c.id}/edit`)}><PencilLine size={14} /> Edit</button>}
                  {c.status !== 'ended' && (
                    <button className="btn soft sm" onClick={() => { setViewCycle(c.id); navigate(`/wizard?new=${Date.now()}`) }}><Wand2 size={14} /> Set up goals</button>
                  )}
                  {c.status === 'draft' && <button className="btn primary sm" onClick={() => doActivate(c)}><Play size={14} /> Activate</button>}
                  {c.status === 'active' && <button className="btn danger sm" onClick={() => doEnd(c)}><Square size={14} /> End cycle</button>}
                  {goals.length > 0 && <button className="btn secondary sm" onClick={() => setReuse(c)}><Copy size={14} /> Start next cycle from this one</button>}
                  <button className="btn ghost sm" onClick={() => { setViewCycle(c.id); navigate('/') }}>Open <ArrowRight size={14} /></button>
                  <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => (state.cycles.length === 1 ? toast('This is the only review cycle. Create another one before deleting it.', 'error') : setDeleting(c))}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {reuse && <ReuseCycleModal source={reuse} onClose={() => setReuse(null)} />}
      {deleting && <DeleteCycleModal cycle={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}

function DeleteCycleModal({ cycle, onClose }) {
  const { state, deleteCycle } = useStore()
  const { toast } = useFeedback()
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const goals = cycleGoals(state, cycle.id)
  const kpiIds = new Set(goals.flatMap((g) => goalKpis(state, g.id).map((k) => k.id)))
  const periodIds = new Set(state.periods.filter((p) => kpiIds.has(p.kpiId)).map((p) => p.id))
  const shares = state.allocations.filter((a) => periodIds.has(a.periodId)).length
  const results = state.updates.filter((u) => kpiIds.has(u.kpiId)).length
  const drafts = state.drafts.filter((d) => d.cycleId === cycle.id).length
  const people = new Set(state.allocations.filter((a) => periodIds.has(a.periodId) && a.level === 'individual').map((a) => a.unitId)).size
  // a cycle with real data needs the name typed; an empty draft cycle does not
  const strict = results > 0 || cycle.status !== 'draft'
  const nameOk = !strict || typed.trim() === cycle.name.trim()
  const reasonOk = !strict || reason.trim()
  const go = () => {
    setTried(true)
    if (!nameOk || !reasonOk) return
    deleteCycle(cycle.id, reason.trim() || 'Draft cycle removed')
    toast(`${cycle.name} deleted${results ? ` with ${results} result${results > 1 ? 's' : ''}` : ''}.`, 'warn')
    onClose()
  }
  const rows = [
    ['Goals', goals.length],
    ['KPIs', kpiIds.size],
    ['Shares (departments, teams, people)', shares],
    ['People with KPIs', people],
    ['Recorded results', results],
    ['Goal drafts', drafts],
  ]
  return (
    <Modal
      title={`Delete ${cycle.name}?`}
      sub={`${fmtRange(cycle.startDate, cycle.endDate)} · ${cycle.status}`}
      icon={<Trash2 size={20} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={strict && !nameOk} onClick={go}><Trash2 size={15} /> Delete cycle</button>
        </>
      }
    >
      <div className="col gap-12">
        <Alert tone={strict ? 'error' : 'warn'}>
          {strict
            ? <>This permanently removes the cycle and <b>everything in it</b>. It cannot be undone. {cycle.status === 'ended' ? 'This is a finished cycle: its results are performance history.' : cycle.status === 'active' ? 'This cycle is active: people are tracking against it now.' : ''} To keep the history instead, use <b>End cycle</b>.</>
            : <>This draft cycle has no results. It and its set-up are removed.</>}
        </Alert>
        <table className="table compact">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><td className="small">{k}</td><td className="right mono bold" style={{ color: v ? 'var(--red)' : 'var(--muted)' }}>{v}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="tiny muted">Staff, departments and teams come from HR and are not affected. The deletion is recorded in the audit log.</p>
        {strict && (
          <>
            <Field label="Reason" required error={tried && !reasonOk ? 'Say why the cycle is deleted.' : undefined}>
              <input className="input" placeholder="e.g. Test cycle created by mistake" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Field label={<>Type <b>{cycle.name}</b> to confirm</>} required>
              <input className={`input ${tried && !nameOk ? 'invalid' : ''}`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={cycle.name} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  )
}

function overlaps(state, start, end, ignoreId) {
  return state.cycles.find((c) => c.id !== ignoreId && start <= c.endDate && end >= c.startDate)
}

function ReuseCycleModal({ source, onClose }) {
  const { state, reuseCycle } = useStore()
  const { toast } = useFeedback()
  const others = state.cycles.filter((c) => c.status !== 'ended' && c.id !== source.id)
  const latest = [...state.cycles].sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
  const start = addDays(latest.endDate, 1)
  const [mode, setMode] = useState('new')
  const [name, setName] = useState(`FY ${start.slice(0, 4)} Review`)
  const [startDate, setStart] = useState(start)
  const [endDate, setEnd] = useState(addDays(`${Number(start.slice(0, 4)) + 1}${start.slice(4)}`, -1))
  const [cycleId, setCycleId] = useState(others[0]?.id || '')
  const goals = cycleGoals(state, source.id)
  const ov = mode === 'new' && overlaps(state, startDate, endDate)
  const dup = mode === 'new' && state.cycles.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())
  const bad = mode === 'new' ? !name.trim() || !startDate || !endDate || endDate < startDate || !!ov || dup : !cycleId

  const go = () => {
    reuseCycle(source.id, mode === 'new' ? { mode, name: name.trim(), startDate, endDate } : { mode, cycleId })
    toast(`${goals.length} goal${goals.length > 1 ? 's' : ''} copied into drafts. Adjust only what changed, then save each one.`)
    navigate('/drafts')
  }
  return (
    <Modal
      size="lg"
      icon={<Copy size={20} />}
      title={`Start from ${source.name}`}
      sub="Copies every goal, KPI and allocation into editable drafts. Results are never copied, and the old cycle is untouched."
      onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={bad} onClick={go}><Copy size={15} /> Copy {goals.length} goal{goals.length > 1 ? 's' : ''}</button></>}
    >
      <div className="col gap-16">
        <Seg value={mode} onChange={setMode} options={[{ value: 'new', label: 'Into a new cycle' }, { value: 'existing', label: 'Into an existing cycle', disabled: !others.length }]} />
        {mode === 'new' ? (
          <div className="grid g-3">
            <Field label="New cycle name" required error={dup ? 'A cycle with this name already exists.' : undefined}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Start date" required error={ov ? `Overlaps with ${ov.name}.` : undefined}><input type="date" className="input" value={startDate} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="End date" required><input type="date" className="input" value={endDate} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
        ) : (
          <Field label="Target cycle">
            <select className="select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              {others.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
            </select>
          </Field>
        )}
        <div className="card">
          <div className="card-head"><b>Goals that will be copied</b></div>
          <div className="card-body col gap-6">
            {goals.map((g) => (
              <div key={g.id} className="row small"><CheckCircle2 size={14} color="var(--green)" /><span className="semi spacer">{g.name}</span><span className="muted">{goalKpis(state, g.id).length} KPI{goalKpis(state, g.id).length === 1 ? '' : 's'}</span></div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { Play, Square, Copy, Target, CheckCircle2, Circle, ArrowRight, ChevronRight, PencilLine, Plus } from 'lucide-react'
import { useStore, useCurrentUser } from '../store'
import { BackLink, Ring, GoalStatus, Badge, Progress, Link, Empty, Tabs, useFeedback, toneFor, ScoreDot } from '../components/ui'
import { AllocationTree, AddMemberModal, UpdateModal, ReuseModal, valueLabel } from '../components/KpiWidgets'
import { LeaverModal, EditGoalModal, AddKpiModal, EditSharesModal } from '../components/ChangeModals'
import GoalTracking from '../components/GoalTracking'
import { byId, goalKpis, goalProgress, kpiProgress, currentPeriod, childAllocations, KPI_TYPES } from '../lib/calc'
import { fmtRange, fmtPct, fmtDate, todayISO } from '../lib/utils'

export function goalStartCheck(state, goal) {
  const cycle = byId(state.cycles, goal.cycleId)
  const kpis = goalKpis(state, goal.id)
  const checks = [
    { ok: goal.status === 'ready', label: 'Setup saved (status Ready)' },
    { ok: kpis.length > 0 && kpis.every((k) => { const p = currentPeriod(state, k.id); return p && childAllocations(state, p.id, null).length > 0 }), label: 'Every KPI is allocated to at least one department' },
    { ok: cycle?.status === 'active', label: `Review cycle is active (${cycle?.name})` },
    { ok: goal.startDate <= todayISO(), label: `Start date reached (${fmtDate(goal.startDate)})` },
  ]
  return { checks, ok: checks.every((c) => c.ok) }
}

export default function GoalDetail({ id }) {
  const { state, startGoal, stopGoal } = useStore()
  const user = useCurrentUser()
  const { toast, confirm } = useFeedback()
  const goal = byId(state.goals, id)
  const kpis = goal ? goalKpis(state, goal.id) : []
  const [tab, setTab] = useState(kpis[0]?.id)
  const [addTo, setAddTo] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [reuse, setReuse] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [sharesOf, setSharesOf] = useState(undefined)
  const [editing, setEditing] = useState(false)
  const [addingKpi, setAddingKpi] = useState(false)
  if (!goal) return <Empty title="Goal not found" action={<Link to="/goals" className="btn primary">Back to goals</Link>} />

  const cycle = byId(state.cycles, goal.cycleId)
  const p = goalProgress(state, goal)
  const isAdmin = state.role === 'admin'
  const canManage = ['admin', 'dept_head', 'team_lead'].includes(state.role)
  const { checks, ok } = goalStartCheck(state, goal)
  const active = kpis.find((k) => k.id === tab) || kpis[0]
  const period = active && currentPeriod(state, active.id)

  const doStart = () => {
    startGoal(goal.id)
    toast(`"${goal.name}" is now running.`)
  }
  const doStop = async () => {
    if (await confirm({ title: `Stop running “${goal.name}”?`, message: 'The goal ends now. Progress is frozen at the last recorded values and all history is kept.', okLabel: 'Stop goal', danger: true })) {
      stopGoal(goal.id)
      toast('Goal stopped. Progress frozen, history kept.', 'warn')
    }
  }

  return (
    <div className="col gap-20">
      <div>
        <BackLink to="/goals" label="Goals" />
        <div className="crumbs"><Link to="/goals">Goals</Link><ChevronRight size={13} />{cycle.name}</div>
        <div className="card card-pad">
          <div className="row top wrap gap-20">
            <Ring value={p} size={76} stroke={7} sub="goal progress" />
            <div style={{ flex: 1, minWidth: 280 }}>
              <div className="row gap-6 mb-8"><GoalStatus status={goal.status} /><Badge tone="blue">{KPI_TYPES[goal.type].label}</Badge><span className="badge navy">Tracked on its own · 100%</span></div>
              <h1>{goal.name}</h1>
              <p className="muted mt-4" style={{ maxWidth: 700 }}>{goal.description}</p>
              <div className="row wrap gap-16 mt-12 small">
                <span><span className="muted">Period</span> <b>{fmtRange(goal.startDate, goal.endDate)}</b></span>
                <span><span className="muted">KPIs</span> <b>{kpis.length}</b></span>
                {goal.startedAt && <span><span className="muted">Started</span> <b>{fmtDate(goal.startedAt.slice(0, 10))}</b></span>}
                {goal.stoppedAt && <span><span className="muted">Stopped</span> <b>{fmtDate(goal.stoppedAt.slice(0, 10))}</b></span>}
              </div>
            </div>
            {isAdmin && (
              <div className="col" style={{ minWidth: 250 }}>
                {goal.status === 'ready' && (
                  <>
                    <button className="btn success" disabled={!ok} onClick={doStart}><Play size={16} /> Start running</button>
                    <div className="col gap-4">
                      {checks.map((c) => (
                        <div key={c.label} className="row gap-6 tiny" style={{ color: c.ok ? 'var(--green)' : 'var(--muted)' }}>
                          {c.ok ? <CheckCircle2 size={13} /> : <Circle size={13} />} {c.label}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {goal.status === 'running' && <button className="btn danger" onClick={doStop}><Square size={16} /> Stop running</button>}
                {['ready', 'running'].includes(goal.status) && (
                  <div className="row gap-6">
                    <button className="btn secondary" style={{ flex: 1 }} onClick={() => setEditing(true)}><PencilLine size={15} /> Edit goal</button>
                    <button className="btn secondary" style={{ flex: 1 }} onClick={() => setAddingKpi(true)}><Plus size={15} /> Add KPI</button>
                  </div>
                )}
                <button className="btn secondary" onClick={() => setReuse(true)}><Copy size={16} /> Reuse in a new period</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid g-3">
        {kpis.map((k) => {
          const kp = kpiProgress(state, k)
          const per = currentPeriod(state, k.id)
          return (
            <Link key={k.id} to={`/kpis/${k.id}`} className="card card-pad hover" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="row">
                <span className="lvl organization"><Target size={14} /></span>
                <div className="spacer"><div className="bold">{k.name}</div><div className="tiny muted">{KPI_TYPES[k.type].label} · contributes {k.weight}% to the goal · period {per?.index}</div></div>
                <ArrowRight size={16} color="var(--blue-600)" />
              </div>
              <div className="row mt-12 small"><ScoreDot value={kp.progress} /><span className="muted spacer">Achieved</span><b>{valueLabel(k, kp.current)}</b><span className="muted">of {k.type === 'completion' ? '100%' : valueLabel(k, kp.target)}</span></div>
              <div className="tiny muted mt-8">Adds <b style={{ color: 'var(--text)' }}>{fmtPct((kp.progress * k.weight) / 100, 1)}</b> to the goal ({k.weight}% contribution)</div>
            </Link>
          )
        })}
      </div>

      {kpis.length > 0 && goal.status !== 'draft' && <GoalTracking state={state} goal={goal} />}

      {active && period && (
        <div className="card">
          <div className="card-head">
            <h3>Allocation tree</h3>
            <span className="small muted">organization → department → team → person, with progress at each node</span>
            <div className="spacer" />
            <Link to={`/kpis/${active.id}`} className="btn ghost sm">Open KPI <ArrowRight size={14} /></Link>
          </div>
          {kpis.length > 1 && (
            <div style={{ padding: '0 20px' }}>
              <Tabs value={active.id} onChange={setTab} tabs={kpis.map((k) => ({ key: k.id, label: k.name }))} />
            </div>
          )}
          <AllocationTree
            kpi={active}
            period={period}
            goal={goal}
            canManage={canManage}
            canUpdate={(a) => isAdmin || a.unitId === user.id}
            onAddMember={setAddTo}
            onUpdate={setUpdating}
            onRemove={setRemoving}
            onEditShares={(a) => setSharesOf(a || null)}
            canEditShares={isAdmin}
          />
        </div>
      )}
      {addTo && <AddMemberModal parent={addTo} onClose={() => setAddTo(null)} />}
      {updating && <UpdateModal alloc={updating} onClose={() => setUpdating(null)} />}
      {reuse && <ReuseModal goal={goal} onClose={() => setReuse(false)} />}
      {removing && <LeaverModal staffId={removing.unitId} allocId={removing.id} onClose={() => setRemoving(null)} />}
      {sharesOf !== undefined && active && <EditSharesModal kpi={active} parent={sharesOf} onClose={() => setSharesOf(undefined)} />}
      {editing && <EditGoalModal goal={goal} onClose={() => setEditing(false)} />}
      {addingKpi && <AddKpiModal goal={goal} onClose={() => setAddingKpi(false)} />}
    </div>
  )
}

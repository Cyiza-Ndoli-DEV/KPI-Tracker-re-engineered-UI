import { useState } from 'react'
import { ChevronRight, UserPlus, RotateCcw, Eraser, Copy, History, ListChecks, ScrollText, GitBranch, LineChart as LineIcon, Lock, Unlock, PencilLine, Send, Target as TargetIcon } from 'lucide-react'
import { useStore, useCurrentUser } from '../store'
import { BackLink, Ring, Badge, Link, Empty, Tabs, Modal, Field, Alert, Avatar, useFeedback, Progress, toneFor, GoalStatus, ScoreDot } from '../components/ui'
import { AllocationTree, AddMemberModal, UpdateModal, RestartModal, ReuseModal, LineChart, valueLabel } from '../components/KpiWidgets'
import { LeaverModal, EditKpiModal, EditSharesModal } from '../components/ChangeModals'
import LevelTabs from '../components/LevelTabs'
import { byId, kpiPeriods, currentPeriod, nodeStats, unitName, lockInfo, progressSeries, KPI_TYPES, childAllocations, cumulativeAt } from '../lib/calc'
import { fmtRange, fmtPct, fmtDate, fmtDateTime, daysBetween } from '../lib/utils'

export default function KpiDetail({ id, query }) {
  const { state, resetPeriod } = useStore()
  const user = useCurrentUser()
  const { toast, confirm } = useFeedback()
  const kpi = byId(state.kpis, id)
  const periods = kpi ? kpiPeriods(state, kpi.id) : []
  const cur = kpi && currentPeriod(state, kpi.id)
  const [periodId, setPeriodId] = useState(cur?.id)
  const [tab, setTab] = useState(query?.tab || 'alloc')
  const [addTo, setAddTo] = useState(null)
  const [chooseGroup, setChooseGroup] = useState(false)
  const [updating, setUpdating] = useState(null)
  const [restart, setRestart] = useState(null)
  const [reuse, setReuse] = useState(false)
  const [requesting, setRequesting] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [sharesOf, setSharesOf] = useState(undefined)
  const [editing, setEditing] = useState(false)
  if (!kpi) return <Empty title="KPI not found" action={<Link to="/goals" className="btn primary">Back to goals</Link>} />

  const goal = byId(state.goals, kpi.goalId)
  const period = byId(state.periods, periodId) || cur
  const stats = nodeStats(state, kpi, period, null)
  const isAdmin = state.role === 'admin'
  const canManage = ['admin', 'dept_head', 'team_lead'].includes(state.role)
  const live = period.status === 'open' && goal.status === 'running'
  const groups = state.allocations.filter((a) => a.periodId === period.id && (a.level === 'team' || a.level === 'department'))
  const periodUpdates = state.updates.filter((u) => u.periodId === period.id).sort((a, b) => b.date.localeCompare(a.date) || b.submittedAt.localeCompare(a.submittedAt))
  const audit = state.audit.filter((a) => a.kpiId === kpi.id)

  const doReset = async () => {
    if (await confirm({ title: `Reset period ${period.index}?`, message: `This clears the ${periodUpdates.length} result(s) entered in the current period (for values entered by mistake). The period stays open and the setup is unchanged. The action is recorded in the audit log.`, okLabel: 'Reset values', danger: true })) {
      resetPeriod(kpi.id)
      toast('Current period values cleared.', 'warn')
    }
  }

  return (
    <div className="col gap-20">
      <div>
        <BackLink to={`/goals/${goal.id}`} label={`goal: ${goal.name}`} />
        <div className="crumbs"><Link to="/kpis">KPIs</Link><ChevronRight size={13} /><Link to={`/goals/${goal.id}`}>{goal.name}</Link><ChevronRight size={13} />{kpi.name}</div>
        <div className="card card-pad">
          <div className="row top wrap gap-20">
            <Ring value={stats.progress} size={76} stroke={7} sub={`period ${period.index}`} />
            <div style={{ flex: 1, minWidth: 280 }}>
              <div className="row gap-6 mb-8">
                <span className="lvl-badge organization">Organization KPI</span>
                <Badge tone="blue">{KPI_TYPES[kpi.type].label}</Badge>
                <GoalStatus status={goal.status} />
                <Badge tone={period.status === 'open' ? 'green' : 'gray'} dot>Period {period.index} · {period.status}</Badge>
              </div>
              <h1>{kpi.name}</h1>
              <div className="row gap-6 mt-4 small"><span className="muted">Attached to goal</span><Link to={`/goals/${goal.id}`} className="goal-chip">{goal.name}</Link><span className="muted">· carries {kpi.weight}% of it</span></div>
              <p className="muted mt-4">{kpi.description}</p>
              <div className="row wrap gap-16 mt-12 small">
                <span><span className="muted">Target</span> <b>{kpi.type === 'completion' ? 'Fully achieved' : valueLabel(kpi, stats.target)}</b></span>
                {kpi.type === 'average' && <span><span className="muted">Start</span> <b>{valueLabel(kpi, kpi.startValue)}</b></span>}
                <span><span className="muted">Achieved</span> <b>{valueLabel(kpi, stats.current)}</b></span>
                <span><span className="muted">Period</span> <b>{fmtRange(period.startDate, period.endDate)}</b></span>
                <span><span className="muted">Contribution to goal</span> <b>{kpi.weight}%</b></span>
              </div>
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              {canManage && <button className="btn primary" disabled={!live} onClick={() => setChooseGroup(true)}><UserPlus size={16} /> Add member</button>}
              {isAdmin && (
                <>
                  <button className="btn secondary" disabled={period.id !== cur.id || !['running', 'ready'].includes(goal.status)} onClick={() => setEditing(true)}><PencilLine size={15} /> Edit KPI</button>
                  <div className="row gap-6">
                    <button className="btn secondary" style={{ flex: 1 }} disabled={!live} onClick={() => setRestart('restart')}><RotateCcw size={15} /> Restart</button>
                    <button className="btn secondary" style={{ flex: 1 }} disabled={!live || kpi.type === 'completion'} onClick={() => setRestart('newTarget')} title="Restart with a new target"><TargetIcon size={15} /> New target</button>
                  </div>
                  <div className="row gap-6">
                    <button className="btn danger" style={{ flex: 1 }} disabled={!live || !periodUpdates.length} onClick={doReset}><Eraser size={15} /> Reset</button>
                    <button className="btn secondary" style={{ flex: 1 }} onClick={() => setReuse(true)}><Copy size={15} /> Reuse</button>
                  </div>
                </>
              )}
              {!live && <span className="tiny muted">{goal.status !== 'running' ? `Goal is ${goal.status}.` : 'Viewing a closed period.'}</span>}
            </div>
          </div>
          {periods.length > 1 && (
            <div className="row wrap gap-6 mt-16">
              <span className="small muted">Period:</span>
              {periods.map((p) => (
                <button key={p.id} className={`btn xs ${p.id === period.id ? 'primary' : 'secondary'}`} onClick={() => setPeriodId(p.id)}>
                  {p.index}. {fmtRange(p.startDate, p.closedAt || p.endDate)} {p.status === 'closed' ? '· closed' : '· open'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '0 20px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'alloc', label: 'Allocations', icon: <GitBranch size={15} /> },
              { key: 'chart', label: 'Progress', icon: <LineIcon size={15} /> },
              { key: 'periods', label: 'Period history', icon: <History size={15} />, count: periods.length },
              { key: 'updates', label: 'Update history', icon: <ListChecks size={15} />, count: periodUpdates.length },
              { key: 'audit', label: 'Audit log', icon: <ScrollText size={15} />, count: audit.length },
            ]}
          />
        </div>
        {tab === 'alloc' && (
          <LevelTabs
            key={period.id}
            state={state}
            kpi={kpi}
            period={period}
            includeLeft
            tree={<AllocationTree kpi={kpi} period={period} goal={goal} canManage={canManage} canUpdate={(a) => isAdmin || a.unitId === user.id} onAddMember={setAddTo} onUpdate={setUpdating} onRemove={setRemoving} onEditShares={(a) => setSharesOf(a || null)} canEditShares={isAdmin && period.id === cur.id} defaultDepth={3} />}
          />
        )}
        {tab === 'chart' && (
          <div className="card-body">
            <div className="row mb-8 small muted"><span className="spacer">Organization progress over period {period.index}</span></div>
            <LineChart points={progressSeries(state, kpi, period)} start={period.startDate} end={period.endDate} />
            <div className="grid g-4 mt-16">
              {childAllocations(state, period.id, null).map((d) => {
                const s = nodeStats(state, kpi, period, d)
                return (
                  <div key={d.id} className="card card-pad" style={{ padding: 14 }}>
                    <div className="row gap-8"><ScoreDot value={s.progress} /><div className="small semi">{unitName(state, d)}</div></div>
                    <div className="tiny muted mt-4">{valueLabel(kpi, s.current)} of {kpi.type === 'completion' ? '100%' : valueLabel(kpi, s.target)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {tab === 'periods' && (
          <table className="table">
            <thead><tr><th>Period</th><th>Dates</th><th className="right">Target</th><th className="right">Final / current</th><th style={{ width: 90 }}>Progress</th><th>Status</th><th /></tr></thead>
            <tbody>
              {[...periods].reverse().map((p) => {
                const s = nodeStats(state, kpi, p, null)
                return (
                  <tr key={p.id}>
                    <td className="bold">Period {p.index}</td>
                    <td className="small">{fmtRange(p.startDate, p.closedAt || p.endDate)}<div className="tiny muted">{daysBetween(p.startDate, p.closedAt || p.endDate)} days</div></td>
                    <td className="right mono">{kpi.type === 'completion' ? 'Full' : valueLabel(kpi, p.target)}</td>
                    <td className="right mono">{valueLabel(kpi, s.current)}</td>
                    <td><ScoreDot value={s.progress} /></td>
                    <td>{p.status === 'open' ? <Badge tone="green" dot>Open</Badge> : <Badge>Closed</Badge>}<div className="tiny muted">{p.closeReason}</div></td>
                    <td><button className="btn ghost xs" onClick={() => { setPeriodId(p.id); setTab('alloc') }}>View</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {tab === 'updates' && (
          <UpdateTable state={state} kpi={kpi} updates={periodUpdates} user={user} isAdmin={isAdmin} live={live} onEdit={(u) => setUpdating({ alloc: byId(state.allocations, u.allocationId), update: u })} onRequest={setRequesting} />
        )}
        {tab === 'audit' && <AuditTable state={state} entries={audit} />}
      </div>

      {chooseGroup && (
        <Modal title="Add member — choose the group" sub="Pick the team or department the new person will contribute to." icon={<UserPlus size={20} />} onClose={() => setChooseGroup(false)}>
          <div className="col gap-6">
            {groups.map((g) => {
              const parent = g.parentId && byId(state.allocations, g.parentId)
              return (
                <button key={g.id} className="option-card row" onClick={() => { setChooseGroup(false); setAddTo(g) }}>
                  <span className={`lvl ${g.level}`}><GitBranch size={13} /></span>
                  <div className="spacer"><div className="bold">{unitName(state, g)}</div><div className="tiny muted">{g.level === 'team' ? `Team in ${unitName(state, parent)}` : 'Department (direct members)'} · {childAllocations(state, period.id, g.id).filter((c) => c.level === 'individual').length} members</div></div>
                  <span className="small semi">{kpi.type === 'sum' ? valueLabel(kpi, g.target) : 'same target'}</span>
                </button>
              )
            })}
            {groups.length === 0 && <Alert tone="warn">This KPI is not allocated to any department yet.</Alert>}
          </div>
        </Modal>
      )}
      {addTo && <AddMemberModal parent={addTo} onClose={() => setAddTo(null)} />}
      {updating && (updating.alloc ? <UpdateModal alloc={updating.alloc} update={updating.update} onClose={() => setUpdating(null)} /> : <UpdateModal alloc={updating} onClose={() => setUpdating(null)} />)}
      {restart && <RestartModal kpi={kpi} period={cur} goal={goal} initialMode={restart} onClose={() => { setRestart(null); setPeriodId(undefined) }} />}
      {reuse && <ReuseModal goal={goal} onClose={() => setReuse(false)} />}
      {requesting && <RequestEditModal update={requesting} onClose={() => setRequesting(null)} />}
      {removing && <LeaverModal staffId={removing.unitId} allocId={removing.id} onClose={() => setRemoving(null)} />}
      {sharesOf !== undefined && <EditSharesModal kpi={kpi} parent={sharesOf} onClose={() => setSharesOf(undefined)} />}
      {editing && <EditKpiModal kpi={kpi} onClose={() => setEditing(false)} />}
    </div>
  )
}

function LEVEL_COUNTS(state, period) {
  const live = state.allocations.filter((a) => a.periodId === period.id && !a.leftDate)
  const c = (l) => live.filter((a) => a.level === l).length
  return [[c('department'), 'department'], [c('team'), 'team'], [c('individual'), 'person']].filter(([x]) => x).map(([x, w]) => `${x} ${w}${x > 1 ? (w === 'person' ? 's' : 's') : ''}`).join(', ').replace('persons', 'people') || 'not shared yet'
}

export function UpdateTable({ state, kpi, updates, user, isAdmin, live, onEdit, onRequest, showKpi }) {
  if (!updates.length) return <Empty icon={<ListChecks />} title="No results recorded in this period yet" />
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th>Result date</th>
            {showKpi && <th>KPI</th>}
            <th>Person</th>
            <th className="right">Result</th>
            <th>Submitted</th>
            <th>Edit window</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {updates.map((u) => {
            const k = kpi || byId(state.kpis, u.kpiId)
            const alloc = byId(state.allocations, u.allocationId)
            const person = alloc && byId(state.staff, alloc.unitId)
            const li = lockInfo(state, u)
            const mine = alloc?.unitId === user.id || u.submittedBy === user.id
            const pendingReq = state.editRequests.find((r) => r.updateId === u.id && r.status === 'pending')
            return (
              <tr key={u.id}>
                <td className="semi nowrap">{fmtDate(u.date)}</td>
                {showKpi && <td className="small">{k.name}</td>}
                <td><div className="row gap-6"><Avatar name={person?.name} size="sm" /><span>{person?.name}</span></div></td>
                <td className="right mono bold">
                  {k.type === 'completion' ? (u.completion === 'full' ? 'Fully achieved' : u.completion === 'none' ? 'Not achieved' : `Partially · ${u.value}%`) : k.type === 'sum' ? `+${valueLabel(k, u.value)}` : valueLabel(k, u.value)}
                  {k.type === 'sum' && <div className="tiny muted" style={{ fontWeight: 400 }}>total {valueLabel(k, cumulativeAt(state, u.allocationId, u))}</div>}
                  {u.reason && <div className="tiny muted" style={{ fontWeight: 400, maxWidth: 220, marginLeft: 'auto' }}>“{u.reason}”</div>}
                </td>
                <td className="small muted nowrap">{fmtDateTime(u.submittedAt)}<div className="tiny">by {byId(state.staff, u.submittedBy)?.name}{u.editedAt ? ' · edited' : ''}</div></td>
                <td>
                  {li.unlocked ? (
                    <Badge tone="violet"><Unlock size={11} /> Unlocked until {fmtDate(u.unlockedUntil.slice(0, 10))}</Badge>
                  ) : li.locked ? (
                    <Badge tone="red"><Lock size={11} /> Locked</Badge>
                  ) : (
                    <Badge tone="green">Editable until {fmtDate(li.lockAt.toISOString().slice(0, 10))}</Badge>
                  )}
                </td>
                <td className="right nowrap">
                  {live && !li.locked && (mine || isAdmin) && <button className="btn secondary xs" onClick={() => onEdit(u)}><PencilLine size={12} /> Edit</button>}
                  {live && li.locked && (mine || isAdmin) && (pendingReq ? <Badge tone="amber">Edit requested</Badge> : <button className="btn soft xs" onClick={() => onRequest(u)}><Send size={12} /> Request edit</button>)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function AuditTable({ state, entries, showKpi }) {
  if (!entries.length) return <Empty icon={<ScrollText />} title="No changes recorded yet" />
  return (
    <div className="scroll-x">
      <table className="table compact">
        <thead><tr><th>When</th><th>Who</th><th>Action</th>{showKpi && <th>KPI</th>}<th>Subject</th><th>Old value</th><th>New value</th><th>Access granted by</th></tr></thead>
        <tbody>
          {entries.map((a) => (
            <tr key={a.id}>
              <td className="small nowrap">{fmtDateTime(a.at)}</td>
              <td className="small semi nowrap">{byId(state.staff, a.who)?.name || a.who}</td>
              <td><Badge tone={a.action.includes('edit') || a.action.includes('Edit') ? 'violet' : a.action.includes('reset') || a.action.includes('stopped') ? 'red' : 'blue'}>{a.action}</Badge></td>
              {showKpi && <td className="small">{byId(state.kpis, a.kpiId)?.name || '—'}</td>}
              <td className="small">{a.subject}{a.note && <div className="tiny muted">{a.note}</div>}</td>
              <td className="small muted" style={{ maxWidth: 260 }}>{a.oldValue}</td>
              <td className="small" style={{ maxWidth: 260 }}>{a.newValue}</td>
              <td className="small">{a.grantedBy ? byId(state.staff, a.grantedBy)?.name : <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RequestEditModal({ update, onClose }) {
  const { state, requestEdit } = useStore()
  const { toast } = useFeedback()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const kpi = byId(state.kpis, update.kpiId)
  const save = () => {
    setTried(true)
    if (!reason.trim()) return
    requestEdit(update.id, reason.trim())
    toast('Edit request sent to the admin.')
    onClose()
  }
  return (
    <Modal
      icon={<Lock size={20} />}
      title="Request edit"
      sub={`${kpi.name} · result of ${fmtDate(update.date)} · locked after ${state.settings.editWindowDays} days`}
      onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Send size={15} /> Send request</button></>}
    >
      <Alert>This update is past its edit window. The admin can extend the window for you on this KPI, and will revert it after your change. Every change is recorded in the audit log.</Alert>
      <Field label="Reason" required error={tried && !reason.trim() ? 'Please explain what needs correcting.' : undefined} style={{ marginTop: 14 }}>
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Typo: the figure should be UGX 54M" autoFocus />
      </Field>
    </Modal>
  )
}

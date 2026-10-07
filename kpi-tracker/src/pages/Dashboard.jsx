import { Target, Wand2, FileClock, Activity, Building2, ArrowRight, Gauge, BellRing, UsersRound } from 'lucide-react'
import { useStore, useCurrentUser } from '../store'
import { Ring, Progress, GoalStatus, Badge, Link, Empty, toneFor, navigate, ScoreDot } from '../components/ui'
import { bandsOf, personScore, byId, cycleGoals, goalKpis, goalProgress, kpiProgress, cycleScore, band, currentPeriod, unitScore, unitAllocations, weightedScore, KPI_TYPES } from '../lib/calc'
import { fmtRange, fmtPct, daysBetween, todayISO, timeAgo } from '../lib/utils'
import { valueLabel } from '../components/KpiWidgets'
import GoalsTable from '../components/GoalsTable'

export default function Dashboard() {
  const { state } = useStore()
  const user = useCurrentUser()
  const cycle = byId(state.cycles, state.viewCycleId)
  if (!cycle) return <Empty title="No review cycle yet" action={<Link to="/cycles" className="btn primary">Create one</Link>} />
  const goals = cycleGoals(state, cycle.id)
  const score = cycleScore(state, cycle.id)
  const live = goals.filter((g) => g.status !== 'draft')
  const onTrack = live.filter((g) => goalProgress(state, g) >= (bandsOf(state).find((b) => b.key === 'meets')?.min ?? 70)).length
  const today = todayISO()
  const daysLeft = today > cycle.endDate ? 0 : daysBetween(today < cycle.startDate ? cycle.startDate : today, cycle.endDate)
  const elapsed = today < cycle.startDate ? 0 : Math.min(100, (daysBetween(cycle.startDate, today) / daysBetween(cycle.startDate, cycle.endDate)) * 100)
  const kpis = goals.flatMap((g) => goalKpis(state, g.id).map((k) => ({ k, g })))
  const running = kpis.filter(({ g }) => g.status === 'running')
  const people = new Set(state.allocations.filter((a) => a.level === 'individual' && kpis.some(({ k }) => currentPeriod(state, k.id)?.id === a.periodId)).map((a) => a.unitId))
  const pending = state.editRequests.filter((r) => r.status === 'pending')
  const cycleDrafts = state.drafts.filter((d) => d.cycleId === cycle.id)
  const isAdmin = state.role === 'admin'
  const myScore = personScore(state, user.id, cycle.id).final

  return (
    <div className="col gap-20">
      <div className="hero">
        <div className="row top wrap gap-20">
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="label">{state.settings.orgName} · {cycle.status === 'active' ? 'Active review cycle' : cycle.status === 'draft' ? 'Draft cycle' : 'Ended cycle'}</div>
            <h1>{cycle.name}</h1>
            <div style={{ color: '#d6e4ff', marginTop: 6 }}>{fmtRange(cycle.startDate, cycle.endDate)} · {daysLeft} days left</div>
            <div style={{ maxWidth: 420, marginTop: 14 }}>
              <div className="row tiny" style={{ color: '#c4d7ff', marginBottom: 6 }}><span>Cycle elapsed</span><span className="spacer" /><span>{fmtPct(elapsed, 0)}</span></div>
              <div className="bar" style={{ background: 'rgba(255,255,255,.18)' }}><span style={{ width: `${elapsed}%`, background: 'linear-gradient(90deg,#7dd3fc,#fff)' }} /></div>
            </div>
            <div className="row wrap gap-16 mt-16">
              <div className="hero-stat"><div className="v">{goals.filter((g) => g.status === 'running').length}<span style={{ fontSize: 13, opacity: 0.7 }}> / {goals.length}</span></div><div className="k">Goals running</div></div>
              <div className="hero-stat"><div className="v">{running.length}</div><div className="k">Running KPIs</div></div>
              <div className="hero-stat"><div className="v">{people.size}</div><div className="k">People contributing</div></div>
              {!isAdmin && myScore !== null && <div className="hero-stat"><div className="v">{fmtPct(myScore, 1)}</div><div className="k">Your score</div></div>}
            </div>
          </div>
          <div className="col" style={{ alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
            <Ring value={score} size={96} stroke={9} color="#ffffff" track="rgba(255,255,255,.18)" textColor="white" sub="Avg. goal progress" />
            <span className="badge" style={{ background: 'rgba(255,255,255,.16)', color: 'white' }}>{onTrack} of {live.length} goals on track</span>
          </div>
        </div>
      </div>

      {isAdmin && (pending.length > 0 || cycleDrafts.length > 0) && (
        <div className="grid g-2">
          {cycleDrafts.length > 0 && (
            <Link to="/drafts" className="card card-pad row hover" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="stat" style={{ padding: 0 }}><div className="icon"><FileClock size={20} /></div></div>
              <div className="spacer"><div className="bold">{cycleDrafts.length} goal draft{cycleDrafts.length > 1 ? 's' : ''} waiting</div><div className="small muted">Pick up exactly where you stopped in the wizard.</div></div>
              <ArrowRight size={18} color="var(--blue-600)" />
            </Link>
          )}
          {pending.length > 0 && (
            <Link to="/admin" className="card card-pad row hover" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="stat" style={{ padding: 0 }}><div className="icon" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}><BellRing size={20} /></div></div>
              <div className="spacer"><div className="bold">{pending.length} edit request{pending.length > 1 ? 's' : ''} pending</div><div className="small muted">Locked updates waiting for an extended edit window.</div></div>
              <ArrowRight size={18} color="var(--blue-600)" />
            </Link>
          )}
        </div>
      )}

      <div className="row">
        <h2>Organization goals</h2>
        <span className="badge blue">{goals.length}</span>
        <div className="spacer" />
        {isAdmin && cycle.status !== 'ended' && <Link to="/wizard" className="btn primary"><Wand2 size={16} /> Set up a goal</Link>}
      </div>
      {goals.length === 0 ? (
        <div className="card">
          <Empty icon={<Target />} title="No goals in this cycle yet" action={isAdmin && cycle.status !== 'ended' && <Link to="/wizard" className="btn primary"><Wand2 size={16} /> Open the setup wizard</Link>}>
            Set up an organizational goal, its KPIs and every allocation in one flow.
          </Empty>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <GoalsTable goals={goals} />
          <div className="card-pad small muted" style={{ borderTop: '1px solid var(--border)' }}>Each goal is tracked on its own as 100%. Its KPIs share that 100% by weight, and a goal's progress is the sum of what its KPIs add.</div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(300px,1fr)', alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><Gauge size={18} color="var(--blue-600)" /><h3>Running KPIs</h3><div className="spacer" /><span className="small muted">click to open</span></div>
          {running.length === 0 ? (
            <Empty title="Nothing running yet">Start a goal from its page once its setup is complete.</Empty>
          ) : (
            <table className="table">
              <thead><tr><th>KPI</th><th>Goal</th><th className="right">Achieved / target</th><th style={{ width: 90 }}>Progress</th></tr></thead>
              <tbody>
                {running.map(({ k, g }) => {
                  const kp = kpiProgress(state, k)
                  const per = currentPeriod(state, k.id)
                  return (
                    <tr key={k.id} className="clickable" onClick={() => navigate(`/kpis/${k.id}`)}>
                      <td><div className="semi">{k.name}</div><div className="tiny muted">{KPI_TYPES[k.type].label} · period {per?.index} · {fmtRange(per?.startDate, per?.endDate)}</div></td>
                      <td className="small">{g.name}</td>
                      <td className="right mono small">{valueLabel(k, kp.current)} / {k.type === 'completion' ? '100%' : valueLabel(k, kp.target)}</td>
                      <td><ScoreDot value={kp.progress} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="col gap-16">
          <div className="card">
            <div className="card-head"><Building2 size={18} color="var(--blue-600)" /><h3>Departments</h3></div>
            <div className="card-body col gap-12">
              {state.departments.map((d) => {
                const s = unitScore(state, 'department', d.id, cycle.id)
                const teams = state.teams.filter((t) => t.departmentId === d.id)
                return (
                  <div key={d.id}>
                    <div className="row small"><span className="semi spacer">{d.name}</span>{s === null ? <span className="muted">no KPIs</span> : <ScoreDot value={s} size="sm" />}</div>
                    {teams.length > 0 && (
                      <div className="row wrap gap-6 mt-8">
                        {teams.map((t) => {
                          const ts = unitScore(state, 'team', t.id, cycle.id)
                          return <span key={t.id} className="badge"><UsersRound size={11} /> {t.name} {ts === null ? '—' : fmtPct(ts, 0)}</span>
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><Activity size={18} color="var(--blue-600)" /><h3>Recent activity</h3></div>
            <div className="card-body">
              <div className="timeline">
                {state.audit.slice(0, 6).map((a) => (
                  <div key={a.id} className="tl-item">
                    <div className="small"><b>{a.action}</b> · {a.subject}</div>
                    <div className="tiny muted">{byId(state.staff, a.who)?.name} · {timeAgo(a.at)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


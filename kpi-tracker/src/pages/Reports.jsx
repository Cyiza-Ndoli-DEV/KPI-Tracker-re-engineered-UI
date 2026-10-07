import { Fragment, useMemo, useState } from 'react'
import { BarChart3, Trophy, Building2, UsersRound, User, Target, ClipboardCheck, Download, Printer, Lightbulb, TrendingUp, Gauge, Users, CalendarClock, Info, Search, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, AlertTriangle, LifeBuoy, UserX, FileSpreadsheet, ArrowRight, LineChart as LineIcon } from 'lucide-react'
import { useStore, useCurrentUser } from '../store'
import { Tabs, Badge, Progress, Avatar, Empty, Field, Link, Seg, toneFor, useFeedback, navigate, PctBar } from '../components/ui'
import { valueLabel, LineChart } from '../components/KpiWidgets'
import BandScale from '../components/BandScale'
import CountChart from '../components/CountChart'
import { Toggle, KpiIcon, useOpenState } from '../components/Hierarchy'
import Rankings from './Rankings'
import { byId, bandsOf, cycleGoals, goalKpis, goalProgress, currentPeriod, progressSeries, KPI_TYPES } from '../lib/calc'
import { levelRows, kpiRows, unassignedStaff, unsharedNodes, updatesOverTime, recentUpdates, bandCounts, reportDefaultAsOf } from '../lib/reports'
import { exportFullReport, exportTeamReport } from '../lib/reportExports'
import { kpiNodes, LEVEL_NAME } from '../lib/hierarchy'
import { fmtPct, fmtDate, fmtShortDate, fmtRange, round, sum, todayISO, daysBetween } from '../lib/utils'

const TONE_COLOR = { green: '#22c55e', blue: '#3b82f6', amber: '#f59e0b', red: '#ef4444', violet: '#8b5cf6', gray: '#94a3b8' }
const avg = (xs) => (xs.length ? sum(xs) / xs.length : 0)

export default function Reports({ query = {} }) {
  const { state } = useStore()
  const user = useCurrentUser()
  const { toast } = useFeedback()
  const cycle = byId(state.cycles, state.viewCycleId)
  const scoped = ['dept_head', 'team_lead'].includes(state.role) && user.departmentId
  const [tab, setTab] = useState(query.tab || 'overview')
  const [asOf, setAsOf] = useState(reportDefaultAsOf(cycle, todayISO()))
  const [dept, setDept] = useState(scoped ? user.departmentId : 'all')
  const [goalId, setGoalId] = useState('all')
  const [kpiId, setKpiId] = useState('all')
  const goals = cycleGoals(state, cycle.id).filter((g) => g.status !== 'draft')
  const kpiOptions = goals.filter((g) => goalId === 'all' || g.id === goalId).flatMap((g) => goalKpis(state, g.id))
  const filter = { goalId: goalId === 'all' ? undefined : goalId, kpiId: kpiId === 'all' ? undefined : kpiId }
  const pipBelow = state.settings.pipBelow ?? 50
  const { isOpen, toggle, setAll } = useOpenState(() => false)
  const allOpen = goals.length > 0 && goals.every((g) => isOpen(g.id))

  const data = useMemo(() => {
    const people = levelRows(state, cycle, 'individual', asOf, dept, filter)
    const everyone = levelRows(state, cycle, 'individual', asOf, dept)
    return {
      departments: levelRows(state, cycle, 'department', asOf, dept, filter),
      teams: levelRows(state, cycle, 'team', asOf, dept, filter),
      people,
      kpis: kpiRows(state, cycle, asOf).filter((r) => (!filter.goalId || r.goal.id === filter.goalId) && (!filter.kpiId || r.kpi.id === filter.kpiId)),
      stale: everyone.filter((r) => r.stale).sort((a, b) => (b.since ?? 1e9) - (a.since ?? 1e9)),
      pip: people.filter((r) => r.score !== null && r.score < pipBelow).sort((a, b) => a.score - b.score),
      unassigned: unassignedStaff(state, cycle, dept),
      unshared: unsharedNodes(state, cycle),
      recent: recentUpdates(state, cycle, asOf),
    }
  }, [state, cycle, asOf, dept, goalId, kpiId]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const tabs = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={15} /> },
    { key: 'ranking', label: 'Member ranking', icon: <Trophy size={15} /> },
    { key: 'departments', label: 'Departments', icon: <Building2 size={15} />, count: data.departments.length },
    { key: 'teams', label: 'Teams', icon: <UsersRound size={15} />, count: data.teams.length },
    { key: 'individuals', label: 'Individuals', icon: <User size={15} />, count: data.people.length },
    { key: 'compliance', label: 'Update compliance', icon: <ClipboardCheck size={15} />, count: data.stale.length || undefined },
  ]

  return (
    <div className="col gap-16 reports">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Reports</h1>
          <div className="sub">{cycle.name} · as of {fmtDate(asOf)}{dept !== 'all' ? ` · ${byId(state.departments, dept)?.name}` : ''}{filter.goalId ? ` · ${byId(state.goals, filter.goalId)?.name}` : ''}{filter.kpiId ? ` · ${byId(state.kpis, filter.kpiId)?.name}` : ''}</div>
        </div>
        <div className="spacer" />
        <button className="btn secondary no-print" onClick={() => window.print()}><Printer size={16} /> Print</button>
        <button className="btn primary no-print" onClick={() => { exportFullReport(state, cycle, asOf, dept, filter, data); toast('Full report exported to Excel.') }}><Download size={16} /> Export to Excel</button>
      </div>

      <div className="card card-pad row wrap gap-16 no-print" style={{ alignItems: 'flex-end' }}>
        <Field label="As of date"><input type="date" className="input" value={asOf} min={cycle.startDate} max={cycle.endDate} onChange={(e) => e.target.value && setAsOf(e.target.value)} /></Field>
        <Field label="Department">
          <select className="select" value={dept} disabled={scoped} onChange={(e) => setDept(e.target.value)}>
            <option value="all">All departments</option>
            {state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Goal">
          <select className="select" value={goalId} onChange={(e) => { setGoalId(e.target.value); setKpiId('all') }}>
            <option value="all">All goals</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="KPI">
          <select className="select" value={kpiId} onChange={(e) => setKpiId(e.target.value)}>
            <option value="all">All KPIs</option>
            {kpiOptions.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </Field>
        {(goalId !== 'all' || kpiId !== 'all') && <button className="btn ghost sm" style={{ marginBottom: 6 }} onClick={() => { setGoalId('all'); setKpiId('all') }}>Clear goal / KPI</button>}
        <div className="spacer" />
        <div className="col gap-4"><div className="tiny muted semi">Performance bands (Admin → Set up)</div><BandScale compact /></div>
      </div>

      <div className="card no-print" style={{ padding: '0 8px' }}>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && <Overview data={data} cycle={cycle} asOf={asOf} go={go} filter={filter} />}
      {tab === 'ranking' && <Rankings embedded deptFilter={dept} key={dept} />}
      {tab === 'departments' && <LevelReport rows={data.departments} level="department" />}
      {tab === 'teams' && <LevelReport rows={data.teams} level="team" onExport={(t) => { exportTeamReport(state, cycle, t, asOf, filter); toast(`Team report for ${t.name} exported.`) }} />}
      {tab === 'individuals' && <LevelReport rows={data.people} level="individual" />}
      {tab === 'compliance' && <Compliance data={data} asOf={asOf} cycle={cycle} dept={dept} />}
    </div>
  )
}

// =====================================================================
// Overview
// =====================================================================
function Overview({ data, cycle, asOf, go, filter }) {
  const { state } = useStore()
  const goals = cycleGoals(state, cycle.id).filter((g) => g.status !== 'draft' && (!filter.goalId || g.id === filter.goalId))
  const bands = bandsOf(state)
  const counts = bandCounts(data.people)
  const insights = buildInsights(state, data)
  const pipBelow = state.settings.pipBelow ?? 50
  const { isOpen, toggle, setAll } = useOpenState(() => false)
  const allOpen = goals.length > 0 && goals.every((g) => isOpen(g.id))

  return (
    <div className="col gap-16">
      <div className="grid g-3">
        <Stat icon={<Target size={20} />} v={fmtPct(avg(goals.map((g) => goalProgress(state, g, asOf))), 1)} k="Average goal progress" sub={`${goals.length} goals, each tracked on its own`} onClick={() => navigate('/goals')} />
        <Stat icon={<Gauge size={20} />} v={fmtPct(avg(data.kpis.map((k) => k.stats.progress)), 1)} k="Average KPI achievement" sub={`${data.kpis.length} KPIs`} onClick={() => navigate('/kpis')} />
        <Stat icon={<Users size={20} />} v={data.people.length} k="People contributing" sub={`average final score ${fmtPct(avg(data.people.map((p) => p.score || 0)), 1)}`} onClick={() => go('individuals')} />
        <Stat icon={<LifeBuoy size={20} />} v={data.pip.length} k="Available for PIP" sub={`final score below ${pipBelow}%`} tone={data.pip.length ? 'red' : ''} onClick={() => go('individuals')} />
        <Stat icon={<CalendarClock size={20} />} v={data.stale.length} k="Have not updated" sub={`no result for ${state.settings.staleDays ?? 30}+ days`} tone={data.stale.length ? 'amber' : ''} onClick={() => go('compliance')} />
        <Stat icon={<UserX size={20} />} v={data.unassigned.length} k="People without KPIs" sub={data.unassigned.map((s) => s.name.split(' ')[0]).join(', ') || 'everyone holds a KPI'} tone={data.unassigned.length ? 'amber' : ''} onClick={() => go('compliance')} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <Target size={18} color="var(--blue-600)" /><h3>Goals and their KPIs</h3><div className="spacer" /><span className="tiny muted">as of {fmtShortDate(asOf)}</span>
            <button className="btn ghost xs no-print" onClick={() => setAll(goals.map((g) => g.id), !allOpen)}>{allOpen ? <><ChevronsDownUp size={13} /> Collapse all</> : <><ChevronsUpDown size={13} /> Expand all</>}</button>
          </div>
          <div className="goal-list">
            {goals.map((g, i) => {
              const ks = data.kpis.filter((k) => k.goal.id === g.id)
              const gOpen = isOpen(g.id)
              return (
                <div key={g.id} className="goal-item">
                  <div className="goal-item-row clickable" onClick={() => ks.length && toggle(g.id)}>
                    <Toggle open={gOpen} onClick={() => toggle(g.id)} disabled={!ks.length} />
                    <span className="goal-no">{i + 1}</span>
                    <div className="spacer" style={{ minWidth: 0 }}>
                      <Link to={`/goals/${g.id}`} className="semi" style={{ color: 'inherit' }} onClick={(e) => e.stopPropagation()}>{g.name}</Link>
                      <div className="tiny muted">{ks.length} KPI{ks.length === 1 ? '' : 's'}</div>
                    </div>
                    <PctBar value={goalProgress(state, g, asOf)} />
                  </div>
                  {gOpen && ks.map((k) => (
                    <div key={k.kpi.id} className="goal-item-row kpi">
                      <KpiIcon />
                      <div className="spacer small" style={{ minWidth: 0 }}>
                        <Link to={`/kpis/${k.kpi.id}`} style={{ color: 'inherit' }}>{k.kpi.name}</Link> <span className="tiny muted">· {k.kpi.weight}% of goal</span>
                      </div>
                      <PctBar value={k.stats.progress} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <CardLink onClick={() => navigate('/goals')}>All goals</CardLink>
        </div>
        <div className="card">
          <div className="card-head"><Lightbulb size={18} color="#d97706" /><h3>Key findings</h3></div>
          <div className="card-body col gap-10">
            {insights.map((x, i) => (
              <div key={i} className="insight row top gap-10">
                <span className={`insight-dot ${x.tone}`} />
                <div className="small spacer">{x.text}</div>
                {x.tab && <button className="link-btn tiny no-print" onClick={() => go(x.tab)}>View</button>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g-3" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><Users size={18} color="var(--blue-600)" /><h3>Final scores by band</h3></div>
          <div className="card-body">
            <div className="stack-bar" style={{ height: 14, borderRadius: 8 }}>
              {bands.map((b) => counts[b.key] > 0 && <span key={b.key} style={{ width: `${(counts[b.key] / Math.max(1, data.people.length)) * 100}%`, background: TONE_COLOR[b.tone] }} title={`${b.label}: ${counts[b.key]}`} />)}
            </div>
            <div className="col gap-6 mt-12">
              {bands.map((b) => (
                <div key={b.key} className="row small"><i className="band-dot" style={{ background: TONE_COLOR[b.tone] }} /><span className="spacer">{b.label} <span className="tiny muted">({b.min}%+)</span></span><b>{counts[b.key] || 0}</b><span className="tiny muted" style={{ width: 40, textAlign: 'right' }}>{fmtPct(((counts[b.key] || 0) / Math.max(1, data.people.length)) * 100, 0)}</span></div>
              ))}
            </div>
            <div className="divider" style={{ margin: '12px 0' }} />
            <div className="tiny muted semi mb-8">Departments</div>
            <div className="col gap-8">
              {data.departments.map((d) => (
                <div key={d.unit.id} className="row gap-8 small">
                  <span className="semi spacer">{d.name} <span className="tiny muted">· {d.people} people</span></span>
                  <PctBar value={d.score} />
                </div>
              ))}
            </div>
          </div>
          <CardLink onClick={() => go('departments')}>Department report</CardLink>
        </div>
        <PeopleList title="Top performers" icon={<TrendingUp size={17} color="var(--green)" />} rows={data.people.slice(0, 6)} more="Member ranking" onMore={() => go('ranking')} />
        <PeopleList title="Available for PIP" icon={<LifeBuoy size={17} color="var(--red)" />} rows={data.pip.slice(0, 6)} empty={`No one has a final score below ${pipBelow}%.`} more="All individuals" onMore={() => go('individuals')} sub={`Final score below ${pipBelow}% (set in Admin → Set up)`} />
      </div>

      <div className="grid g-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><CalendarClock size={18} color="var(--amber)" /><h3>Members who have not updated</h3><div className="spacer" /><Badge tone="amber">{data.stale.length}</Badge></div>
          <div className="card-body col gap-8">
            {data.stale.length === 0 && <div className="small muted">Everyone recorded a result in the last {state.settings.staleDays ?? 30} days.</div>}
            {data.stale.slice(0, 6).map((r) => (
              <Link key={r.unit.id} to={`/reports/person/${r.unit.id}`} className="row gap-8 small person-link">
                <Avatar name={r.name} size="sm" />
                <div className="spacer"><div className="semi">{r.name}</div><div className="tiny muted">{r.team?.name || r.dept?.name}</div></div>
                <span className={`badge ${r.since === null ? 'red' : 'amber'}`}>{r.since === null ? 'never updated' : `${r.since} days ago`}</span>
              </Link>
            ))}
          </div>
          <CardLink onClick={() => go('compliance')}>Update compliance</CardLink>
        </div>
        <div className="card">
          <div className="card-head"><UserX size={18} color="var(--muted)" /><h3>People without KPIs</h3><div className="spacer" /><Badge>{data.unassigned.length}</Badge></div>
          <div className="card-body col gap-8">
            {data.unassigned.length === 0 && <div className="small muted">Everyone in HR holds at least one KPI share.</div>}
            {data.unassigned.map((s) => (
              <div key={s.id} className="row gap-8 small">
                <Avatar name={s.name} size="sm" />
                <div className="spacer"><div className="semi">{s.name}</div><div className="tiny muted">{s.title} · {byId(state.departments, s.departmentId)?.name}{s.teamId ? ` · ${byId(state.teams, s.teamId)?.name}` : ' · no team'}</div></div>
                <span className="tiny muted">joined {fmtShortDate(s.joinedDate)}</span>
              </div>
            ))}
            {data.unassigned.length > 0 && <div className="tiny muted">Give them a share with <b>Add member</b> on a running KPI.</div>}
          </div>
          <CardLink onClick={() => go('compliance')}>Update compliance</CardLink>
        </div>
      </div>
    </div>
  )
}

function buildInsights(state, data) {
  const out = []
  const d = data.departments
  if (d.length > 1) out.push({ tone: 'blue', text: <><b>{d[0].name}</b> leads the departments at {fmtPct(d[0].score, 1)}; <b>{d[d.length - 1].name}</b> is lowest at {fmtPct(d[d.length - 1].score, 1)}.</>, tab: 'departments' })
  const low = [...data.kpis].sort((a, b) => a.stats.progress - b.stats.progress)[0]
  if (low) out.push({ tone: 'red', text: <>Lowest KPI: <b>{low.kpi.name}</b> at {fmtPct(low.stats.progress, 0)}{low.kpi.type === 'completion' ? ' completed' : ` (${valueLabel(low.kpi, low.stats.current)} of ${valueLabel(low.kpi, low.stats.target)})`}.</>, tab: 'departments' })
  for (const u of data.unshared.filter((x) => x.node.includes('(organization)'))) out.push({ tone: 'amber', text: <><b>{round(u.pct, 1)}%</b> of {u.kpi.name} is not shared with any department, so nobody is working towards it.</>, tab: 'compliance' })
  if (data.pip.length) out.push({ tone: 'red', text: <><b>{data.pip.length}</b> {data.pip.length > 1 ? 'people are' : 'person is'} available for a PIP: {data.pip.map((p) => p.name).join(', ')}.</>, tab: 'individuals' })
  if (data.stale.length) out.push({ tone: 'amber', text: <><b>{data.stale.length}</b> {data.stale.length > 1 ? 'people have' : 'person has'} not recorded a result in {state.settings.staleDays ?? 30} days: {data.stale.slice(0, 4).map((p) => p.name).join(', ')}{data.stale.length > 4 ? ' and others' : ''}.</>, tab: 'compliance' })
  if (data.unassigned.length) out.push({ tone: 'gray', text: <><b>{data.unassigned.length}</b> staff hold no KPI yet: {data.unassigned.map((s) => s.name).join(', ')}.</>, tab: 'compliance' })
  if (data.people.length) out.push({ tone: 'green', text: <><b>{data.people[0].name}</b> has the highest final score ({fmtPct(data.people[0].score, 1)}).</>, tab: 'ranking' })
  return out
}


function Stat({ icon, v, k, sub, tone, onClick }) {
  const T = tone === 'amber' ? { background: 'var(--amber-bg)', color: 'var(--amber)' } : tone === 'red' ? { background: 'var(--red-bg)', color: 'var(--red)' } : undefined
  return (
    <button type="button" className="card stat stat-link" onClick={onClick}>
      <div className="icon" style={T}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
        <div className="v">{v}</div>
        <div className="small semi">{k}</div>
        {sub && <div className="tiny muted ellipsis">{sub}</div>}
      </div>
      {onClick && <ArrowRight size={15} className="stat-arrow" />}
    </button>
  )
}

function CardLink({ onClick, children }) {
  return <button className="card-link no-print" onClick={onClick}>{children} <ArrowRight size={13} /></button>
}


function PeopleList({ title, sub, icon, rows, onMore, more, empty }) {
  return (
    <div className="card">
      <div className="card-head">{icon}<div><h3>{title}</h3>{sub && <div className="tiny muted">{sub}</div>}</div></div>
      <div className="card-body col gap-8">
        {rows.length === 0 && <div className="small muted">{empty || 'Nobody yet.'}</div>}
        {rows.map((r) => (
          <Link key={r.unit.id} to={`/reports/person/${r.unit.id}`} className="row gap-8 person-link">
            <Avatar name={r.name} size="sm" />
            <div className="spacer" style={{ minWidth: 0 }}>
              <div className="semi small ellipsis">{r.name}</div>
              <div className="tiny muted">{r.team?.name || r.dept?.name}{r.worst ? ` · weakest: ${r.worst.kpi.name} ${fmtPct(r.worst.stats.progress, 0)}` : ''}</div>
            </div>
            <Badge tone={r.band.tone}>{fmtPct(r.score, 0)}</Badge>
          </Link>
        ))}
      </div>
      <CardLink onClick={onMore}>{more}</CardLink>
    </div>
  )
}

// =====================================================================
// Departments / Teams / Individuals
// =====================================================================
const LEVEL_TXT = {
  department: { one: 'department', many: 'Departments', icon: Building2 },
  team: { one: 'team', many: 'Teams', icon: UsersRound },
  individual: { one: 'person', many: 'Individuals', icon: User },
}

function LevelReport({ rows, level, onExport }) {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [bandF, setBandF] = useState('all')
  const [onlyStale, setOnlyStale] = useState(false)
  const [open, setOpen] = useState({})
  const L = LEVEL_TXT[level]
  const isPerson = level === 'individual'
  const shown = rows.filter((r) => (bandF === 'all' || r.band.key === bandF) && (!onlyStale || r.stale) && r.name.toLowerCase().includes(q.trim().toLowerCase()))
  const counts = bandCounts(rows)
  const bands = bandsOf(state)
  const Icon = L.icon
  if (!rows.length) return <div className="card"><Empty icon={<Icon />} title={`No ${L.one} holds a KPI in this selection`} /></div>
  const cols = isPerson ? 9 : onExport ? 9 : 8

  return (
    <div className="col gap-16">
      <div className="grid g-4">
        <Stat icon={<Icon size={20} />} v={rows.length} k={`${L.many} with KPIs`} sub={isPerson ? `${sum(rows.map((r) => r.items.length))} KPI shares` : `${sum(rows.map((r) => r.people))} people under them`} />
        <Stat icon={<Gauge size={20} />} v={fmtPct(avg(rows.map((r) => r.score || 0)), 1)} k={isPerson ? 'Average final score' : 'Average score'} sub={isPerson ? `KPI average ${fmtPct(avg(rows.map((r) => r.kpiScore || 0)), 1)}` : `${sum(rows.map((r) => r.people))} people`} />
        <Stat icon={<TrendingUp size={20} />} v={fmtPct(rows[0].score, 1)} k={`Best: ${rows[0].name}`} sub={rows[0].band.label} />
        <Stat icon={<CalendarClock size={20} />} v={rows.filter((r) => r.stale).length} k="Have not updated" sub={`no result for ${state.settings.staleDays ?? 30}+ days`} tone={rows.some((r) => r.stale) ? 'amber' : ''} onClick={() => setOnlyStale(!onlyStale)} />
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="row wrap table-toolbar">
          <div className="input-group" style={{ width: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 32 }} placeholder={`Search ${L.one}`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="seg">
            <button className={bandF === 'all' ? 'on' : ''} onClick={() => setBandF('all')}>All {rows.length}</button>
            {bands.map((b) => <button key={b.key} className={bandF === b.key ? 'on' : ''} onClick={() => setBandF(b.key)}><i className="band-dot" style={{ background: TONE_COLOR[b.tone] }} />{b.label} {counts[b.key] || 0}</button>)}
          </div>
          <label className="check small"><input type="checkbox" checked={onlyStale} onChange={(e) => setOnlyStale(e.target.checked)} /> Only those who have not updated</label>
          <div className="spacer" />
          <span className="tiny muted">Click a row for each KPI</span>
        </div>
        <table className="table report-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Rank</th>
              <th>{isPerson ? 'Person' : level === 'team' ? 'Team' : 'Department'}</th>
              <th>{isPerson ? 'Department / team' : level === 'team' ? 'Department / lead' : 'Head'}</th>
              {!isPerson && <th className="right">People</th>}
              <th className="right">KPIs</th>
              {isPerson && <th className="right">KPI score</th>}
              {isPerson && <th className="right">Org Fit</th>}
              <th style={{ width: 150 }}>{isPerson ? 'Final score' : 'Score'}</th>
              <th>Band</th>
              <th>Weakest KPI</th>
              <th className="right">Last result</th>
              {!isPerson && onExport && <th />}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const rank = rows.indexOf(r) + 1
              const isOpen = !!open[r.unit.id]
              return (
                <Fragment key={r.unit.id}>
                  <tr className="clickable" onClick={() => setOpen((o) => ({ ...o, [r.unit.id]: !isOpen }))}>
                    <td><div className="row gap-4">{isOpen ? <ChevronDown size={14} className="muted" /> : <ChevronRight size={14} className="muted" />}<span className={`medal ${rank <= 3 ? `m${rank}` : ''}`}>{rank}</span></div></td>
                    <td>
                      {isPerson ? (
                        <div className="row gap-6"><Avatar name={r.name} size="sm" /><div><div className="semi nowrap"><Link to={`/reports/person/${r.unit.id}`} className="person-name-link" onClick={(e) => e.stopPropagation()} title="Open the individual report">{r.name}</Link> {r.isLead && <Badge tone="violet">team lead</Badge>}</div><div className="tiny muted nowrap">{r.unit.title}</div></div></div>
                      ) : (
                        <div className="row gap-6"><span className={`lvl ${level}`}><Icon size={14} /></span><div className="semi">{r.name}</div></div>
                      )}
                    </td>
                    <td className="small">
                      {isPerson ? <>{r.dept?.name}{r.team ? <span className="muted"> · {r.team.name}</span> : <span className="muted"> · no team</span>}</> : level === 'team' ? <>{r.dept?.name}<div className="tiny muted">{r.lead?.name}</div></> : r.lead?.name}
                    </td>
                    {!isPerson && <td className="right mono">{r.people}</td>}
                    <td className="right mono">{r.items.length}</td>
                    {isPerson && <td className="right mono small">{fmtPct(r.kpiScore, 1)}{r.isLead && <div className="tiny muted">team avg</div>}</td>}
                    {isPerson && <td className="right mono small">{r.orgFit === null ? <span className="tiny muted">pending</span> : `${r.orgFit}%`}</td>}
                    <td><PctBar value={r.score} /></td>
                    <td><Badge tone={r.band.tone}>{r.band.label}</Badge></td>
                    <td className="tiny">{r.worst ? <><span style={{ color: 'var(--red)' }}>▼</span> {r.worst.kpi.name} <b>{fmtPct(r.worst.stats.progress, 0)}</b></> : '—'}</td>
                    <td className="right tiny nowrap">
                      {r.lastUpdate ? fmtShortDate(r.lastUpdate) : <span style={{ color: 'var(--red)' }}>never</span>}
                      <div>{r.stale ? <span className="badge amber" style={{ padding: '0 6px' }}>not updated{r.since !== null ? ` ${r.since}d` : ''}</span> : <span className="muted">{r.updates} result{r.updates === 1 ? '' : 's'}</span>}</div>
                    </td>
                    {!isPerson && onExport && <td className="right" onClick={(e) => e.stopPropagation()}><button className="btn soft xs no-print" onClick={() => onExport(r.unit)}><FileSpreadsheet size={12} /> Full report</button></td>}
                  </tr>
                  {isOpen && (
                    <tr className="detail-row">
                      <td />
                      <td colSpan={cols}>
                        <table className="table inner-table">
                          <thead><tr><th>Goal → KPI</th><th className="right">Share</th><th className="right">Target</th><th className="right">Actual</th><th>Achieved</th><th /></tr></thead>
                          <tbody>
                            {[...r.items].sort((a, b) => a.stats.progress - b.stats.progress).map((it, i) => (
                              <tr key={it.alloc.id}>
                                <td><div className="tiny muted">{it.goal.name}</div><div className="semi small">{it.kpi.name} {i === 0 && r.items.length > 1 && <Badge tone="red">weakest</Badge>}</div></td>
                                <td className="right mono small">{it.kpi.type === 'sum' ? fmtPct(it.alloc.percent, 2) : 'same'}</td>
                                <td className="right mono small">{it.kpi.type === 'completion' ? 'Full' : valueLabel(it.kpi, it.stats.target)}</td>
                                <td className="right mono small bold">{valueLabel(it.kpi, it.stats.current)}</td>
                                <td style={{ width: 150 }}><PctBar value={it.stats.progress} /></td>
                                <td className="right"><Link to={`/kpis/${it.kpi.id}/${it.alloc.id}`} className="tiny no-print">Open KPI →</Link></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <Empty title="Nobody matches these filters" />}
      </div>
      <div className="small muted row gap-6"><Info size={14} />
        {isPerson
          ? <>KPI score = the average of the person's KPI achievements (a team lead: the average of their team members' KPI scores). Final score = KPI score × {state.settings.scoring?.kpiWeight ?? 70}% + Org Fit × {state.settings.scoring?.orgFitWeight ?? 30}%.</>
          : <>Score = each KPI share's achievement, weighted by the KPI's contribution to its goal. </>}
      </div>
    </div>
  )
}

// =====================================================================
// Update compliance
// =====================================================================
function Compliance({ data, asOf, cycle, dept }) {
  const { state } = useStore()
  const nodes = useMemo(() => kpiNodes(state, cycle.id), [state, cycle.id])
  const kpis = [...new Map(nodes.map((n) => [n.kpi.id, n.kpi])).values()]
  // KPI performance graph: pick a KPI, then a level and an owner
  const [perfKpi, setPerfKpi] = useState(kpis[0]?.id || '')
  const [perfLevel, setPerfLevel] = useState('organization')
  const [perfOwner, setPerfOwner] = useState('')
  const kpiNodesOf = nodes.filter((n) => n.kpi.id === perfKpi && !n.alloc?.leftDate)
  const owners = kpiNodesOf.filter((n) => n.level === perfLevel)
  const node = perfLevel === 'organization' ? kpiNodesOf.find((n) => !n.alloc) : owners.find((n) => n.alloc.id === perfOwner) || owners[0]
  const perfPoints = node ? progressSeries(state, node.kpi, node.period, node.alloc).filter((p) => p.date <= asOf) : []
  // results over time
  const [uDept, setUDept] = useState(dept)
  const [uKpi, setUKpi] = useState('all')
  const [by, setBy] = useState('day')
  const [from, setFrom] = useState(cycle.startDate)
  const [to, setTo] = useState(asOf)
  const series = updatesOverTime(state, cycle, asOf, { deptId: uDept, kpiId: uKpi, by, from, to })
  const reqs = state.editRequests
  const reqCount = (s) => reqs.filter((r) => r.status === s).length
  const staleDays = state.settings.staleDays ?? 30

  return (
    <div className="col gap-16">
      <div className="grid g-4">
        <Stat icon={<ClipboardCheck size={20} />} v={series.total} k="Results in the range" sub={`${fmtShortDate(series.start)} – ${fmtShortDate(series.end)}`} />
        <Stat icon={<Users size={20} />} v={`${data.people.length - data.people.filter((r) => r.stale).length} / ${data.people.length}`} k={`Updated in the last ${staleDays} days`} sub="people holding KPIs" />
        <Stat icon={<CalendarClock size={20} />} v={data.stale.length} k="Have not updated" sub={`${data.stale.filter((r) => r.since === null).length} never updated`} tone={data.stale.length ? 'amber' : ''} />
        <Stat icon={<UserX size={20} />} v={data.unassigned.length} k="People without KPIs" sub="in HR, not allocated" tone={data.unassigned.length ? 'amber' : ''} />
      </div>

      <div className="card">
        <div className="card-head wrap"><LineIcon size={18} color="var(--blue-600)" /><h3>KPI performance over time</h3><span className="small muted">pick a KPI, then any level and owner</span></div>
        <div className="row wrap gap-12" style={{ padding: '12px 20px 0' }}>
          <label className="filter-field">KPI<select className="select" value={perfKpi} onChange={(e) => { setPerfKpi(e.target.value); setPerfOwner('') }}>{kpis.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>
          <label className="filter-field">Level<select className="select" value={perfLevel} onChange={(e) => { setPerfLevel(e.target.value); setPerfOwner('') }}>{['organization', 'department', 'team', 'individual'].filter((l) => l === 'organization' || kpiNodesOf.some((n) => n.level === l)).map((l) => <option key={l} value={l}>{LEVEL_NAME[l]}</option>)}</select></label>
          {perfLevel !== 'organization' && (
            <label className="filter-field">Owner<select className="select" value={node?.alloc?.id || ''} onChange={(e) => setPerfOwner(e.target.value)}>{owners.map((n) => <option key={n.alloc.id} value={n.alloc.id}>{n.owner.name}</option>)}</select></label>
          )}
          {node && <div className="col gap-4 small" style={{ marginLeft: 'auto', textAlign: 'right' }}><b>{node.owner.name} — {node.kpi.name}</b><span className="muted">{valueLabel(node.kpi, node.stats.current)} of {node.kpi.type === 'completion' ? '100%' : valueLabel(node.kpi, node.stats.target)} · {fmtPct(node.stats.progress, 1)}</span></div>}
        </div>
        <div className="card-body">{node ? <LineChart points={perfPoints} start={node.period.startDate} end={node.period.endDate} height={200} /> : <Empty title="No KPI share at this level" />}</div>
      </div>

      <div className="card">
        <div className="card-head wrap"><BarChart3 size={18} color="var(--blue-600)" /><h3>Results recorded over time</h3><span className="small muted">each point = results entered on that {by === 'day' ? 'date' : 'week'}</span></div>
        <div className="row wrap gap-12" style={{ padding: '12px 20px 0' }}>
          <label className="filter-field">Department<select className="select" value={uDept} onChange={(e) => setUDept(e.target.value)}><option value="all">All</option>{state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="filter-field">KPI<select className="select" value={uKpi} onChange={(e) => setUKpi(e.target.value)}><option value="all">All KPIs</option>{kpis.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>
          <label className="filter-field">From<input type="date" className="input" value={from} min={cycle.startDate} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className="filter-field">To<input type="date" className="input" value={to} min={from} max={asOf} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          <label className="filter-field">Group by<Seg value={by} onChange={setBy} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} /></label>
        </div>
        <div className="card-body"><CountChart points={series.points} start={series.start} end={series.end} label="results" /></div>
      </div>

      <div className="grid g-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><CalendarClock size={18} color="var(--amber)" /><h3>Members who have not updated</h3><span className="small muted">no result for {staleDays}+ days</span><div className="spacer" /><Badge tone="amber">{data.stale.length}</Badge></div>
          {data.stale.length === 0 ? <Empty title="Everyone is up to date" /> : (
            <table className="table">
              <thead><tr><th>Person</th><th>Department / team</th><th className="right">Last result</th><th className="right">Days since</th></tr></thead>
              <tbody>
                {data.stale.map((r) => (
                  <tr key={r.unit.id} className="clickable" onClick={() => navigate(`/reports/person/${r.unit.id}`)}>
                    <td><div className="row gap-6"><Avatar name={r.name} size="sm" /><span className="semi small">{r.name}</span></div></td>
                    <td className="small">{r.dept?.name}{r.team ? ` · ${r.team.name}` : ''}</td>
                    <td className="right small">{r.lastUpdate ? fmtDate(r.lastUpdate) : <span className="badge red">never</span>}</td>
                    <td className="right mono bold" style={{ color: r.since === null || r.since > 60 ? 'var(--red)' : 'var(--amber)' }}>{r.since ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="col gap-16">
          <div className="card">
            <div className="card-head"><UserX size={18} color="var(--muted)" /><h3>People without KPIs</h3><div className="spacer" /><Badge>{data.unassigned.length}</Badge></div>
            <div className="card-body col gap-8">
              {data.unassigned.length === 0 && <div className="small muted">Everyone holds at least one KPI.</div>}
              {data.unassigned.map((s) => (
                <div key={s.id} className="row gap-6 small">
                  <Avatar name={s.name} size="sm" />
                  <div className="spacer"><div className="semi">{s.name}</div><div className="tiny muted">{s.title} · {byId(state.departments, s.departmentId)?.name}{s.teamId ? ` · ${byId(state.teams, s.teamId)?.name}` : ' · no team'}</div></div>
                  <span className="tiny muted">{daysBetween(s.joinedDate, asOf) <= 90 ? `new · joined ${fmtShortDate(s.joinedDate)}` : `since ${fmtDate(s.joinedDate)}`}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><AlertTriangle size={18} color="var(--amber)" /><h3>Targets not fully shared down</h3></div>
            <div className="card-body col gap-8">
              {data.unshared.length === 0 && <div className="small muted">Every Sum KPI is fully shared.</div>}
              {data.unshared.map((u, i) => (
                <div key={i} className="row small"><div className="spacer"><div className="semi">{u.node}</div><div className="tiny muted">{u.kpi.name} · {u.goal.name}</div></div><Badge tone="amber">{round(u.pct, 2)}% not shared</Badge></div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><ClipboardCheck size={18} color="var(--blue-600)" /><h3>Corrections</h3></div>
            <div className="card-body col gap-8 small">
              <div className="row"><span className="spacer">Edit requests waiting</span><Badge tone="amber">{reqCount('pending')}</Badge></div>
              <div className="row"><span className="spacer">Granted (window extended)</span><Badge tone="blue">{reqCount('granted')}</Badge></div>
              <div className="row"><span className="spacer">Reverted</span><Badge tone="violet">{reqCount('reverted')}</Badge></div>
              <div className="row"><span className="spacer">Rejected</span><Badge tone="red">{reqCount('rejected')}</Badge></div>
              <div className="row"><span className="spacer">Edit window</span><b>{state.settings.editWindowDays} days</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

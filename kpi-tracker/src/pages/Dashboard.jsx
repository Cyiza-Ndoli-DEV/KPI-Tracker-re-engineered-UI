import { useId, useState } from 'react'
import { Building2, CalendarDays, ChevronDown, Coins, Flag, Layers3, Network, Target, UserRound, UsersRound } from 'lucide-react'
import { useStore, useCurrentUser } from '../store'
import { byId, KPI_TYPES } from '../lib/calc'
import { contributions, dashboardData, dashboardMonths, organisationPerformance, performance } from '../lib/dashboard'
import { fmtCompact, fmtDate, fmtPct, fmtValue } from '../lib/utils'
import { Link } from '../components/ui'
import { valueLabel } from '../components/KpiWidgets'
import './dashboard.css'

const titles = {
  admin: 'Executive Performance Dashboard',
  dept_head: 'Department Performance Dashboard',
  team_lead: 'Team Performance Dashboard',
}
const percent = (value) => value == null ? '—' : fmtPct(value, 0)
const tone = { 'On track': 'green', 'At risk': 'amber', Behind: 'red', Unassigned: 'neutral' }
const clamp = (value) => Math.min(100, Math.max(0, value ?? 0))
const money = (value) => 'UGX ' + fmtCompact(value)

function Select({ label, value, onChange, children }) {
  return <label className="pd-select"><select aria-label={label} value={value} onChange={onChange}>{children}</select><ChevronDown size={15} aria-hidden="true" /></label>
}

function Metric({ icon: Icon, label, value, color = 'blue', children, identity }) {
  return <section className={'pd-metric pd-' + (identity ? 'identity' : color)}>
    <span className="pd-metric-icon"><Icon size={33} aria-hidden="true" /></span>
    <div><div className="pd-metric-label">{label}</div><strong className="pd-metric-value">{value}</strong>{children && <div className="pd-metric-detail">{children}</div>}</div>
  </section>
}

function Panel({ title, icon: Icon, to, link, children, className = '' }) {
  return <section className={'pd-panel ' + className}>
    <header><h2>{Icon && <Icon size={25} aria-hidden="true" />}{title}</h2>{to && <Link to={to}>{link}</Link>}</header>
    {children}
  </section>
}

function Bar({ value }) {
  return <span className="pd-bar" aria-hidden="true"><i className={value >= 85 ? 'green' : value >= 65 ? 'blue' : 'amber'} style={{ width: clamp(value) + '%' }} /></span>
}
function Achievement({ score }) {
  return <span className="pd-achievement"><b>{percent(score)}</b><Bar value={score} /></span>
}
function Status({ status }) {
  return <span className={'pd-pill ' + tone[status]}>{status}</span>
}
function Counts({ counts, legend = false }) {
  return <div className={legend ? 'pd-legend' : 'pd-counts'}>{Object.entries(counts).map(([label, count]) => <span key={label} className={tone[label]}>{legend && <i />}{label} <b>{count}</b></span>)}</div>
}
function Change({ current, previous, month }) {
  if (current == null || previous == null || !month) return null
  const diff = Math.round(current - previous)
  return <span className={diff > 0 ? 'pd-growth' : diff < 0 ? 'pd-decline' : ''}>{diff > 0 ? '↑ +' : diff < 0 ? '↓ ' : ''}{diff} pp vs. {month.label}</span>
}
function Table({ columns, rows, empty = 'No data for this month.' }) {
  return <div className="pd-table-wrap"><table className="pd-table">
    <thead><tr>{columns.map((column, i) => <th key={i} scope="col">{column}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map(([id, ...cells]) => <tr key={id}>{cells.map((cell, i) => i === 0 ? <th scope="row" key={i}>{cell}</th> : <td key={i}>{cell}</td>)}</tr>)
      : <tr><td colSpan={columns.length} className="pd-empty">{empty}</td></tr>}</tbody>
  </table></div>
}

function KpiTable({ rows, status, compact = false }) {
  return <Table columns={compact ? ['KPI (Type)', 'Target', 'Actual', 'Achievement'] : ['KPI', 'Type', 'Target', 'Actual', 'Achievement', 'Status']}
    rows={rows.map(({ id, to, kpi, stats }) => {
      const type = KPI_TYPES[kpi.type].label
      const values = [valueLabel(kpi, stats.target), valueLabel(kpi, stats.current), <Achievement score={stats.progress} />]
      return compact
        ? [id, <Link to={to}>{kpi.name} <small>({type})</small></Link>, ...values]
        : [id, <Link to={to}>{kpi.name}</Link>, <span className={'pd-pill pd-type ' + kpi.type}>{type}</span>, ...values, <Status status={status(stats.progress)} />]
    })} />
}

function Trend({ points, format = percent, target, currency = false }) {
  const fillId = useId()
  const [monthKey, setMonthKey] = useState(null)
  const active = points.find((point) => point.key === monthKey) || points.at(-1)
  if (!active) return <p className="pd-empty">No months in this period.</p>
  const measured = points.filter((point) => point.value != null)
  const width = 640, height = 214, left = 77, right = 595, top = 21, bottom = 176
  const high = Math.max(currency ? 1 : 100, ...points.map((point) => Math.max(point.target ?? target ?? 0, point.value ?? 0)))
  const low = !currency && measured.length && measured.every(({ value }) => value >= 50) ? 50 : 0
  const mark = (i) => low + (high - low) * i / 5
  const y = (value) => bottom - (value - low) / (high - low) * (bottom - top)
  const x = (i) => points.length === 1 ? (left + right) / 2 : left + (right - left) * i / (points.length - 1)
  const plotted = points.flatMap((point, i) => point.value == null ? [] : [{ ...point, x: x(i), y: y(point.value) }])
  const segments = []
  for (const point of points) {
    if (point.value == null || !segments.length) segments.push([])
    if (point.value != null) segments.at(-1).push(plotted.find((p) => p.key === point.key))
  }
  const activeX = x(points.indexOf(active))
  return <div className="pd-chart">
    <div className="pd-chart-key"><span>Achieved</span><span>Target</span></div>
    <svg viewBox={'0 0 ' + width + ' ' + height} aria-hidden="true">
      <defs><linearGradient id={fillId} x2="0" y2="1"><stop stopColor="#78b9fc" stopOpacity=".55" /><stop offset="1" stopColor="#eaf5ff" stopOpacity=".55" /></linearGradient></defs>
      {Array.from({ length: 6 }, (_, i) => <g key={i}><line x1={left - 15} x2={right + 25} y1={y(mark(i))} y2={y(mark(i))} className="pd-gridline" /><text x={left - 23} y={y(mark(i)) + 5} textAnchor="end">{currency ? fmtCompact(mark(i)) : percent(mark(i))}</text></g>)}
      <path d={'M' + (left - 15) + ',' + top + ' V' + bottom + ' H' + (right + 25)} className="pd-axis" />
      {segments.filter((segment) => segment.length > 1).map((segment) => {
        const first = segment[0], last = segment.at(-1)
        const coordinates = segment.map((p) => p.x + ',' + p.y).join(' ')
        return <g key={first.key}><polygon points={first.x + ',' + bottom + ' ' + coordinates + ' ' + last.x + ',' + bottom} fill={'url(#' + fillId + ')'} /><polyline points={coordinates} className="pd-line" /></g>
      })}
      <polyline points={points.map((point, i) => x(i) + ',' + y(point.target ?? target ?? 0)).join(' ')} className="pd-target-line" />
      <line x1={activeX} x2={activeX} y1={top} y2={bottom} className="pd-chart-guide" />
      {points.map((point, i) => <circle key={point.key} cx={x(i)} cy={y(point.target ?? target ?? 0)} r="4" className="pd-target-point" />)}
      {plotted.map((p) => <circle key={p.key} cx={p.x} cy={p.y} r={p.key === active.key ? 7 : 5} className="pd-point" />)}
      {points.map((point, i) => {
        const hitWidth = points.length > 1 ? (right - left) / (points.length - 1) : 100
        return <g key={point.key}><text x={x(i)} y={bottom + 23} textAnchor="middle">{point.short}</text>
          <rect className="pd-chart-hit" x={x(i) - hitWidth / 2} y="0" width={hitWidth} height={height} onPointerEnter={() => setMonthKey(point.key)} onClick={() => setMonthKey(point.key)} /></g>
      })}
    </svg>
    <div className="pd-chart-detail">
      <Select label="Chart month" value={active.key} onChange={(event) => setMonthKey(event.target.value)}>
        {points.map((point) => <option key={point.key} value={point.key}>{point.label}</option>)}
      </Select>
      <div className="pd-chart-values" aria-live="polite"><span>Target <b>{format(active.target ?? target)}</b></span><span>Achieved <b>{active.value == null ? 'No result' : format(active.value)}</b></span></div>
      {!currency && <Table columns={['KPI', 'Monthly target', 'Achieved']} rows={active.rows.map(({ id, kpi, stats, scope }) => [id,
        <>{kpi.name}{scope && <small className="pd-chart-scope">{scope}</small>}</>,
        fmtValue(kpi.type === 'completion' ? '%' : kpi.unit, stats.target, false),
        stats.current == null ? 'No result' : fmtValue(kpi.type === 'completion' ? '%' : kpi.unit, stats.current, false),
      ])} />}
    </div>
  </div>
}

function Donut({ value, counts }) {
  return <div className="pd-donut-block"><div className="pd-donut" style={{ '--achievement': clamp(value) + '%' }}><div><strong>{percent(value)}</strong><span>Achievement</span></div></div><Counts counts={counts} legend /></div>
}

function Actions({ rows, status, personal, team, state, user }) {
  if (personal || team) return rows.length ? <ul className={'pd-actions ' + (team ? 'pd-inline-actions' : '')}>
    {rows.map(({ id, to, kpi, period, stats }) => <li key={id}><i className={stats.progress >= 100 ? 'complete' : ''} /><Link to={to}>{stats.progress >= 100 ? kpi.name : 'Review ' + kpi.name}</Link>
      {personal && <time dateTime={period.endDate}><CalendarDays size={16} />{fmtDate(period.endDate)}</time>}</li>)}
  </ul> : <p className="pd-empty">No current KPI actions.</p>
  if (!user) return <Actions rows={rows} team />
  return <Table columns={['Priority / Action', 'Owner', 'Due date', 'Status']} rows={rows.map(({ id, to, kpi, period, stats }) => [
    id, <Link to={to}>Review {kpi.name}</Link>, user.name, fmtDate(period.endDate), <Status status={status(stats.progress)} />,
  ])} empty="No KPIs need attention." />
}

export default function Dashboard() {
  const { state } = useStore()
  const user = useCurrentUser()
  const cycle = byId(state.cycles, state.viewCycleId)
  const [monthKey, setMonth] = useState('')
  const months = dashboardMonths(cycle)
  const month = months.find(({ key }) => key === monthKey) || months.at(-1)
  const admin = state.role === 'admin'
  const department = state.role === 'dept_head'
  const team = state.role === 'team_lead'
  return <div className="pd">
    <header className="pd-page-header">
      <h1>{titles[state.role] || 'My Performance Dashboard'}</h1>
      {month && <Select label="Reporting month" value={month.key} onChange={(e) => setMonth(e.target.value)}>
        {months.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
      </Select>}
    </header>
    {cycle && month ? <DashboardContent {...{ state, user, cycle, month, months, admin, department, team }} />
      : <Panel title="No review cycle yet">{admin && <Link to="/cycles/new">Create a review cycle</Link>}</Panel>}
  </div>
}

function DashboardContent({ state, user, cycle, month, months, admin, department, team }) {
  const data = dashboardData(state, cycle)
  const managedDepartments = state.departments.filter((item) => item.headId === user.id)
  const managedTeams = state.teams.filter((item) => department ? managedDepartments.some(({ id }) => id === item.departmentId) : item.leadId === user.id)
  const members = state.staff.filter((person) => person.active !== false && person.id !== user.id && (department
    ? managedDepartments.some(({ id }) => id === person.departmentId) : managedTeams.some(({ id }) => id === person.teamId)))
  const scope = department ? ['department', managedDepartments.map(({ id }) => id)] : team ? ['team', managedTeams.map(({ id }) => id)] : ['individual', [user.id]]
  const getRows = (date) => admin ? data.rows(date) : data.rows(date, ...scope)
  const scoreOf = (rows) => admin ? organisationPerformance(data.goalRows(rows)) : performance(rows, department || team)
  const rows = getRows(month.date)
  const score = scoreOf(rows)
  const monthIndex = months.indexOf(month)
  const recent = months.slice(Math.max(0, monthIndex - 5), monthIndex + 1)
  const previous = recent.at(-2)
  const counts = { 'On track': 0, 'At risk': 0, Behind: 0 }
  for (const { stats } of rows) counts[data.status(stats.progress)]++
  const points = admin ? [] : recent.map((item) => {
    const rows = data.monthRows(item, ...scope)
    return { ...item, rows, value: scoreOf(rows) }
  })
  const priorities = [...rows].filter(({ stats }) => data.status(stats.progress) !== 'On track').sort((a, b) => a.stats.progress - b.stats.progress).slice(0, 3)
  const previousScore = previous ? scoreOf(getRows(previous.date)) : null
  const revenue = admin && rows.find(({ kpi }) => kpi.type === 'sum' && kpi.unit === 'UGX' && /revenue/i.test(kpi.name))
  const goals = admin ? data.goalRows(rows) : []
  const shares = department || team ? contributions(state, rows, team, month.date) : []
  const orgShares = shares.filter(({ label, share }) => label === 'Organisation' && share != null)
  const avgShare = orgShares.length ? orgShares.reduce((sum, { share }) => sum + share, 0) / orgShares.length : null
  const contributionPanel = <Panel title={team ? 'Contribution to Department & Organisation' : 'Contribution to Organisational KPIs'}>
    <Table columns={['KPI', 'Contribution', 'Achievement']} rows={shares.map(({ id, kpi, label, share, score }) => [id,
      <span className="pd-contribution"><Network size={19} aria-hidden="true" /><span>{kpi.name}<small>{label} · {KPI_TYPES[kpi.type].label}</small></span></span>,
      percent(share), <Achievement score={score} />,
    ])} />
  </Panel>

  const scoreMetric = <Metric icon={Target} label={admin ? 'Overall Performance' : department ? 'Department Performance' : team ? 'Team Performance' : 'My Performance'} value={percent(score)}>
    <Change current={score} previous={previousScore} month={previous} />
  </Metric>
  const kpiMetric = <Metric icon={Layers3} color="violet" label={department || team || admin ? 'KPIs' : 'My KPIs'} value={rows.length}><Counts counts={counts} /></Metric>

  if (admin) {
    const revenueTotal = revenue ? data.revenueAt(revenue.kpi, month.date) : null
    const revenueTarget = revenue ? Number(revenue.kpi.target) : null
    const revenueProgress = revenueTarget > 0 ? revenueTotal / revenueTarget * 100 : null
    const revenuePoints = recent.map((item) => {
      if (!revenue) return { ...item, value: null }
      const monthly = data.monthRows(item).filter(({ kpi }) => kpi.id === revenue.kpi.id)
      return { ...item, value: monthly.length ? monthly.reduce((sum, row) => sum + row.stats.current, 0) : null, target: monthly.reduce((sum, row) => sum + row.stats.target, 0) }
    })
    return <>
      <div className="pd-metrics pd-admin-metrics">
        <Metric icon={Coins} color="green" label="Revenue (cycle to date)" value={revenue ? money(revenueTotal) : '—'}>{revenueProgress != null && <><span className="pd-growth">{percent(revenueProgress)} of {money(revenueTarget)} target</span><Bar value={revenueProgress} /></>}</Metric>
        {scoreMetric}{kpiMetric}
        <Metric icon={Flag} label="Strategic Goals" value={goals.filter(({ score }) => data.status(score) === 'On track').length + ' / ' + goals.length}><span className="pd-growth">On track</span></Metric>
      </div>
      <div className="pd-admin-columns">
        <div>
          <Panel title="Monthly Revenue Performance">{revenue ? <Trend key={cycle.id + month.key} points={revenuePoints} format={(value) => fmtValue('UGX', value, false)} currency /> : <p className="pd-empty">No revenue KPI for this period.</p>}</Panel>
          <Panel title="Department Performance">
            <Table columns={['Department', 'KPIs', 'Achievement', 'Status', 'Trend']} rows={state.departments.map((item) => {
              const scoped = (date) => data.rows(date, 'department', [item.id])
              const current = scoped(month.date)
              const score = performance(current)
              return [item.id, item.name, current.length, <Achievement score={score} />, <Status status={data.status(score)} />, <Change current={score} previous={previous ? performance(scoped(previous.date)) : null} month={previous} />]
            })} />
          </Panel>
        </div>
        <div>
          <Panel title="Strategic Goals (Organisation)" to="/goals" link="View all goals">
            <Table columns={['Goal', 'Progress']} rows={goals.map(({ id, name, score }) => [id, <span className="pd-contribution"><Flag size={19} aria-hidden="true" /><Link to={'/goals/' + id}>{name}</Link></span>, <Achievement score={score} />])} />
          </Panel>
          <Panel title="Top Organisation KPIs" to="/kpis" link="View all KPIs"><KpiTable rows={[...rows].sort((a, b) => b.stats.progress - a.stats.progress).slice(0, 3)} compact /></Panel>
          <Panel title="Key Management Actions" icon={Target} to="/reports" link="View details"><Actions rows={priorities} team /></Panel>
        </div>
      </div>
    </>
  }

  const title = department ? 'KPI Performance (Department)' : team ? 'Team KPI Performance' : 'My KPI Performance'
  const pending = rows.filter(({ stats }) => stats.progress < 100).length
  return <>
    <div className={'pd-metrics ' + (department || team ? 'pd-manager-metrics' : 'pd-staff-metrics')}>
      <Metric identity icon={department ? Building2 : team ? UsersRound : UserRound} label={department ? 'Department' : team ? 'Team' : 'Welcome,'}
        value={department ? managedDepartments.map(({ name }) => name).join(', ') || 'Unassigned' : team ? managedTeams.map(({ name }) => name).join(', ') || 'Unassigned' : user.name} />
      {scoreMetric}{kpiMetric}
      {department && <Metric icon={Network} label="Teams" value={managedTeams.length} />}
      {(department || team) && <Metric icon={UsersRound} label="Team Members" value={members.length} />}
      {team && <Metric icon={Flag} label="Org. Contribution" value={percent(avgShare)}>{orgShares.length > 0 && 'Across ' + orgShares.length + ' Sum KPIs'}</Metric>}
      {!department && !team && <Metric icon={CalendarDays} label="KPI Actions" value={rows.length}>{pending} pending</Metric>}
    </div>
    <div className={'pd-pair ' + (department || team ? 'pd-manager-top' : 'pd-staff-top')}>
      <Panel title={title}><KpiTable rows={rows} status={data.status} /></Panel>
      {department || team ? contributionPanel : <Panel title="Overall Performance"><Donut value={score} counts={counts} /></Panel>}
    </div>
    <div className="pd-pair pd-bottom">
      <Panel title={department ? 'Performance Trend (Department)' : team ? 'Team Trend' : 'Performance Trend'}>
        <Trend key={cycle.id + state.role + month.key} points={points} target={100} />
      </Panel>
      {team ? <Panel title="Individual Performance (Team Members)" to="/reports?tab=individuals" link="View team details">
        <Table columns={['Team Member', 'KPI Achievement', 'Status']} rows={members.map((person) => {
          const score = performance(data.rows(month.date, 'individual', [person.id]), false)
          return [person.id, <Link to={'/reports/person/' + person.id}>{person.name}</Link>, <Achievement score={score} />, <Status status={data.status(score)} />]
        })} />
      </Panel> : department ? <Panel title="Key Priorities & Actions" icon={Target}><Actions rows={priorities} status={data.status} user={user} /></Panel>
        : <Panel title="My Current Actions" icon={CalendarDays}><Actions rows={rows} personal /></Panel>}
    </div>
    {team && <Panel title="Key Actions" icon={Target} className="pd-team-actions"><Actions rows={priorities} team /></Panel>}
  </>
}

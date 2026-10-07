import { useState } from 'react'
import { ChevronRight, ArrowDown, ArrowUpRight, PencilLine, UserPlus, UserMinus, SlidersHorizontal, LineChart as LineIcon, ListChecks, ScrollText, GitBranch, Gauge } from 'lucide-react'
import { useStore, useCurrentUser } from '../store'
import { BackLink, Ring, Badge, Link, Empty, Tabs, Avatar, Progress, toneFor, navigate, ScoreDot } from '../components/ui'
import { AddMemberModal, UpdateModal, LineChart, valueLabel } from '../components/KpiWidgets'
import { LeaverModal, EditSharesModal } from '../components/ChangeModals'
import { UpdateTable, AuditTable, RequestEditModal } from './KpiDetail'
import { byId, updateBlock, progressSeries, KPI_TYPES, nodeStats, childAllocations } from '../lib/calc'
import { nodeFor, ancestors, leavesOf, LEVEL_NAME } from '../lib/hierarchy'
import { fmtRange, fmtPct, fmtDate, todayISO, minISO, maxISO } from '../lib/utils'
import { LEVEL_ICON, RoleBadge, nodeLink } from './Kpis'
import LevelTabs, { NodeTable } from '../components/LevelTabs'

export default function KpiNodeDetail({ kpiId, allocId }) {
  const { state } = useStore()
  const user = useCurrentUser()
  const [tab, setTab] = useState('children')
  const [modal, setModal] = useState(null)
  const kpi = byId(state.kpis, kpiId)
  const alloc = byId(state.allocations, allocId)
  if (!kpi || !alloc) return <Empty title="KPI share not found" action={<Link to="/kpis" className="btn primary">Back to KPIs</Link>} />

  const n = nodeFor(state, kpi, alloc)
  const { goal, period, stats, owner } = n
  const isSum = kpi.type === 'sum'
  const isAdmin = state.role === 'admin'
  const canManage = ['admin', 'dept_head', 'team_lead'].includes(state.role)
  const live = period.status === 'open' && goal.status === 'running' && !alloc.leftDate
  const editable = period.status === 'open' && ['running', 'ready'].includes(goal.status) && !alloc.leftDate
  const isLeaf = n.children.length === 0
  const mayUpdate = isLeaf && alloc.level === 'individual' && !alloc.leftDate && (isAdmin || alloc.unitId === user.id)
  const block = mayUpdate ? updateBlock(state, alloc) : null
  const canUpdate = mayUpdate && !block
  const notStarted = maxISO(alloc.joinedDate, period.startDate, goal.startDate) > todayISO()
  const chain = ancestors(state, alloc) // department / team above this one
  const org = nodeStats(state, kpi, period, null)
  const siblings = childAllocations(state, period.id, alloc.parentId).filter((s) => s.id !== alloc.id)
  const parentT = n.parentStats?.target
  const contribution = isSum && n.parentStats?.current ? (stats.current / n.parentStats.current) * 100 : null
  const leafIds = new Set(leavesOf(state, period.id, alloc).map((l) => l.id))
  const updates = state.updates.filter((u) => leafIds.has(u.allocationId)).sort((a, b) => b.date.localeCompare(a.date))
  const subtree = new Set([alloc.id, ...state.allocations.filter((a) => a.periodId === period.id && ancestors(state, a).some((x) => x.id === alloc.id)).map((a) => a.id)])
  const audit = state.audit.filter((a) => a.kpiId === kpi.id && (subtree.has(a.allocationId) || (a.subject || '').includes(owner.name)))
  const Icon = LEVEL_ICON[n.level]
  const targetShown = alloc.leftDate && alloc.targetBeforeLeave ? alloc.targetBeforeLeave : stats.target

  const ChainRow = ({ level, name, sub, share, s, to, current, depth }) => {
    const I = LEVEL_ICON[level] || Gauge
    return (
      <div className={`chain-row ${current ? 'current' : ''}`} style={{ marginLeft: depth * 26 }} onClick={() => !current && to && navigate(to)}>
        <span className={`lvl ${level}`}><I size={13} /></span>
        <div className="spacer" style={{ minWidth: 0 }}>
          <div className="semi small nowrap">{name} {current && <Badge tone="blue">this KPI</Badge>}</div>
          <div className="tiny muted">{sub}</div>
        </div>
        <span className="tiny muted nowrap" style={{ width: 120, textAlign: 'right' }}>{share}</span>
        <span className="small mono nowrap" style={{ width: 170, textAlign: 'right' }}>{valueLabel(kpi, s.current)} / {kpi.type === 'completion' ? '100%' : valueLabel(kpi, s.target)}</span>
        <ScoreDot value={s.progress} size="sm" />
      </div>
    )
  }

  return (
    <div className="col gap-20">
      <div>
        <BackLink to={n.parentAlloc ? `/kpis/${kpi.id}/${n.parentAlloc.id}` : `/kpis/${kpi.id}`} label={n.parentAlloc ? `${n.parentName} — ${kpi.name}` : `${kpi.name} (organization)`} />
        <div className="crumbs wrap">
          <Link to="/kpis">KPIs</Link><ChevronRight size={13} />
          <Link to={`/goals/${goal.id}`}>{goal.name}</Link><ChevronRight size={13} />
          <Link to={`/kpis/${kpi.id}`}>{kpi.name} (organization)</Link><ChevronRight size={13} />
          {chain.map((c) => <span key={c.id} className="row gap-4"><Link to={`/kpis/${kpi.id}/${c.id}`}>{nodeFor(state, kpi, c).owner.name}</Link><ChevronRight size={13} /></span>)}
          <span>{owner.name}</span>
        </div>
        <div className="card card-pad">
          <div className="row top wrap gap-20">
            <Ring value={stats.progress} size={76} stroke={7} sub={alloc.leftDate ? 'closed' : 'progress'} />
            <div style={{ flex: 1, minWidth: 300 }}>
              <div className="row wrap gap-6 mb-8">
                <span className={`lvl-badge ${n.level}`}>{LEVEL_NAME[n.level]} KPI</span>
                <Badge tone="blue">{KPI_TYPES[kpi.type].label}</Badge>
                {!alloc.leftDate && notStarted && <Badge tone="gray">Not started · opens {fmtDate(maxISO(alloc.joinedDate, period.startDate, goal.startDate))}</Badge>}
                {alloc.leftDate && <Badge tone="red">{alloc.leftReason === 'left' ? 'Left' : alloc.leftReason === 'moved' ? 'Moved' : 'Removed'} {fmtDate(alloc.leftDate)}</Badge>}
              </div>
              <div className="row gap-10">
                {owner.person ? <Avatar name={owner.name} /> : <span className={`lvl ${n.level}`} style={{ width: 36, height: 36 }}><Icon size={18} /></span>}
                <div>
                  <h1 style={{ fontSize: 22 }}>{owner.name} — {kpi.name}</h1>
                  <div className="small muted">{owner.sub}</div>
                </div>
              </div>
              <div className="kv-grid mt-16">
                <div><div className="k">Target</div><div className="v">{kpi.type === 'completion' ? 'Fully achieved' : valueLabel(kpi, targetShown)}</div></div>
                <div><div className="k">Share of {n.parentName}</div><div className="v">{isSum ? `${fmtPct(alloc.percent, 2)} of ${valueLabel(kpi, parentT)}` : 'Same target as parent'}</div></div>
                <div><div className="k">Achieved</div><div className="v" style={{ color: 'var(--blue-700)' }}>{valueLabel(kpi, stats.current)}</div></div>
                <div><div className="k">{isSum ? 'Still to do' : 'Gap to target'}</div><div className="v">{alloc.leftDate ? 'closed' : kpi.type === 'completion' ? `${fmtPct(Math.max(0, 100 - stats.current), 0)}` : valueLabel(kpi, Math.max(0, stats.target - stats.current))}</div></div>
                <div><div className="k">{isSum ? `Contribution to ${n.parentName}` : 'Parent value'}</div><div className="v">{isSum ? (contribution === null ? '—' : `${fmtPct(contribution, 1)} of its result`) : valueLabel(kpi, n.parentStats.current)}</div></div>
                <div><div className="k">Period</div><div className="v">{fmtRange(alloc.joinedDate || period.startDate, alloc.leftDate || period.endDate)}</div></div>
                <div><div className="k">Last result</div><div className="v">{n.lastUpdate ? fmtDate(n.lastUpdate) : '—'} <span className="tiny muted">({n.updates})</span></div></div>
              </div>
            </div>
            <div className="col" style={{ minWidth: 210 }}>
              {mayUpdate && <button className="btn primary" disabled={!canUpdate} onClick={() => setModal({ t: 'update' })}><PencilLine size={16} /> Update result</button>}
              {block && <div className="tiny update-block">{block}</div>}
              {live && canManage && n.level !== 'individual' && <button className="btn primary" onClick={() => setModal({ t: 'add' })}><UserPlus size={16} /> Add member</button>}
              {editable && canManage && n.level !== 'individual' && (isSum || n.level === 'department') && <button className="btn secondary" onClick={() => setModal({ t: 'shares' })}><SlidersHorizontal size={15} /> {isSum ? 'Edit shares below' : 'Add teams'}</button>}
              {live && canManage && n.level === 'individual' && <button className="btn secondary" style={{ color: 'var(--red)' }} onClick={() => setModal({ t: 'remove' })}><UserMinus size={15} /> Remove / leaver</button>}
              <Link to={n.parentAlloc ? `/kpis/${kpi.id}/${n.parentAlloc.id}` : `/kpis/${kpi.id}`} className="btn ghost"><ArrowUpRight size={15} /> Open parent KPI</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><GitBranch size={18} color="var(--blue-600)" /><h3>Where this KPI sits</h3><span className="small muted">from the goal down to {owner.name}{n.children.length ? ' and the KPIs below it' : ''}. Click a row to open it.</span></div>
        <div className="card-body col gap-6">
          <div className="chain-row goal" onClick={() => navigate(`/goals/${goal.id}`)}>
            <span className="lvl kpi"><Gauge size={13} /></span>
            <div className="spacer"><div className="semi small">Goal: {goal.name}</div><div className="tiny muted">tracked on its own · 100% · {kpi.name} carries {kpi.weight}% of it</div></div>
          </div>
          <ArrowDown size={14} className="chain-arrow" />
          <ChainRow level="organization" name={`${state.settings.orgName} — ${kpi.name}`} sub="Organization" share="100%" s={org} to={`/kpis/${kpi.id}`} depth={0} />
          {chain.map((c, i) => {
            const cn = nodeFor(state, kpi, c)
            return <ChainRow key={c.id} level={c.level} name={cn.owner.name} sub={LEVEL_NAME[c.level]} share={isSum ? `${fmtPct(c.percent, 2)} of parent` : 'same target'} s={cn.stats} to={nodeLink(cn)} depth={i + 1} />
          })}
          <ChainRow current level={n.level} name={owner.name} sub={LEVEL_NAME[n.level]} share={isSum ? `${fmtPct(alloc.percent, 2)} of parent` : 'same target'} s={stats} depth={chain.length + 1} />
          {n.children.map((c) => {
            const cn = nodeFor(state, kpi, c)
            return <ChainRow key={c.id} level={c.level} name={`${cn.owner.name}${c.leftDate ? ' (left)' : ''}`} sub={LEVEL_NAME[c.level]} share={isSum ? `${fmtPct(c.percent, 2)} of this` : 'same target'} s={cn.stats} to={nodeLink(cn)} depth={chain.length + 2} />
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '0 20px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'children', label: n.children.length ? 'KPIs below' : 'Compared with siblings', icon: <GitBranch size={15} />, count: n.children.length || siblings.length },
              { key: 'chart', label: 'Progress', icon: <LineIcon size={15} /> },
              { key: 'updates', label: 'Results', icon: <ListChecks size={15} />, count: updates.length },
              { key: 'audit', label: 'Audit log', icon: <ScrollText size={15} />, count: audit.length },
            ]}
          />
        </div>
        {tab === 'children' && (
          n.children.length ? (
            <LevelTabs key={alloc.id} state={state} kpi={kpi} period={period} root={alloc} includeLeft tree={<NodeTable state={state} kpi={kpi} rows={n.children} title={`KPIs directly under ${owner.name}`} parentTarget={stats.target} />} />
          ) : (
            <NodeTable state={state} kpi={kpi} rows={[alloc, ...siblings]} highlight={alloc.id} title={`Everyone under ${n.parentName}`} parentTarget={parentT} />
          )
        )}
        {tab === 'chart' && (
          <div className="card-body">
            <div className="row mb-8 small muted"><span className="spacer">{owner.name}'s progress over period {period.index}</span></div>
            <LineChart points={progressSeries(state, kpi, period, alloc)} start={period.startDate} end={period.endDate} />
          </div>
        )}
        {tab === 'updates' && (
          <UpdateTable state={state} kpi={kpi} updates={updates} user={user} isAdmin={isAdmin} live={live} onEdit={(u) => setModal({ t: 'update', a: byId(state.allocations, u.allocationId), u })} onRequest={(u) => setModal({ t: 'request', u })} />
        )}
        {tab === 'audit' && <AuditTable state={state} entries={audit} />}
      </div>

      {modal?.t === 'update' && <UpdateModal alloc={modal.a || alloc} update={modal.u} onClose={() => setModal(null)} />}
      {modal?.t === 'add' && <AddMemberModal parent={alloc} onClose={() => setModal(null)} />}
      {modal?.t === 'shares' && <EditSharesModal kpi={kpi} parent={alloc} onClose={() => setModal(null)} />}
      {modal?.t === 'remove' && <LeaverModal staffId={alloc.unitId} allocId={alloc.id} onClose={() => setModal(null)} />}
      {modal?.t === 'request' && <RequestEditModal update={modal.u} onClose={() => setModal(null)} />}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Equal, Percent, Hash, Copy, Search, X, Users, Check, AlertCircle } from 'lucide-react'
import { NumInput, Seg, Avatar } from './ui'
import { fmtValue, round, sum, fmtPct } from '../lib/utils'

export const METHODS = [
  { value: 'equal', label: 'Split equally', icon: <Equal size={13} /> },
  { value: 'percent', label: 'By percentage', icon: <Percent size={13} /> },
  { value: 'amount', label: 'Enter amounts', icon: <Hash size={13} /> },
  { value: 'same', label: 'Same target for everyone', icon: <Copy size={13} /> },
]

export function equalize(rows, otherUsed = 0) {
  const n = rows.length
  if (!n) return rows
  const each = Math.max(0, (100 - otherUsed) / n)
  return rows.map((r) => ({ ...r, percent: round(each, 4) }))
}

export function defaultMethod(kpi) {
  return kpi.type === 'sum' ? 'equal' : 'same'
}

/**
 * Generic allocation table used at every level (departments, teams, people).
 * group = { method, rows: [{ unitId, percent, startDate, endDate }] }
 */
export default function AllocationEditor({
  kpi,
  parentTarget,
  parentLabel,
  units,
  group,
  onChange,
  selectable = true,
  otherUsed = 0,
  otherLabel = 'Already allocated',
  defaults,
  fieldId,
  error,
  emptyText = 'Nothing selected yet.',
  unitLabel = 'Unit',
}) {
  const sumKpi = kpi.type === 'sum'
  const g = group || { method: defaultMethod(kpi), rows: [] }
  const method = sumKpi ? (g.method === 'same' ? 'equal' : g.method) : 'same'
  const rows = g.rows
  const total = sum(rows.map((r) => Number(r.percent) || 0))
  const allocated = total + otherUsed
  const remaining = 100 - allocated
  const over = sumKpi && allocated > 100.0001
  const unit = kpi.type === 'completion' ? '%' : kpi.unit

  const set = (next) => onChange({ method, ...g, ...next })
  const withMethod = (m, rs) => (m === 'equal' ? equalize(rs, otherUsed) : rs)

  const toggle = (unitId) => {
    const exists = rows.find((r) => r.unitId === unitId)
    const next = exists ? rows.filter((r) => r.unitId !== unitId) : [...rows, { unitId, percent: sumKpi ? '' : null, startDate: defaults.startDate, endDate: defaults.endDate }]
    set({ method, rows: withMethod(method, next) })
  }
  const patchRow = (unitId, patch) => set({ method, rows: rows.map((r) => (r.unitId === unitId ? { ...r, ...patch } : r)) })

  const shown = selectable ? units : units.filter((u) => rows.some((r) => r.unitId === u.id))

  return (
    <div className={`card ${error ? 'invalid-box' : ''}`} data-field={fieldId}>
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <div>
          <div className="small muted">Distribute</div>
          <div className="bold">{parentLabel}</div>
        </div>
        <div className="spacer" />
        <Seg
          value={method}
          onChange={(m) => set({ method: m, rows: withMethod(m, rows) })}
          options={METHODS.map((m) => ({
            ...m,
            disabled: sumKpi ? m.value === 'same' : m.value !== 'same',
            title: sumKpi && m.value === 'same' ? 'Sum KPIs split the target. Use an Average KPI for a shared benchmark.' : !sumKpi && m.value !== 'same' ? `${kpi.type === 'average' ? 'Average' : 'Completion'} KPIs give everyone the same target.` : undefined,
          }))}
        />
      </div>

      <div className="scroll-x">
        <table className="table compact">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>{unitLabel}</th>
              {sumKpi ? (
                <>
                  <th style={{ width: 140 }}>Share of {parentLabel.split(' — ')[0]}</th>
                  <th style={{ width: 210 }}>Target amount</th>
                </>
              ) : (
                <th style={{ width: 200 }}>Target</th>
              )}
              <th style={{ width: 290 }}>Period</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="muted center" style={{ padding: 22 }}>
                  {emptyText}
                </td>
              </tr>
            )}
            {shown.map((u) => {
              const r = rows.find((x) => x.unitId === u.id)
              const on = !!r
              const pct = Number(r?.percent) || 0
              const amount = (parentTarget * pct) / 100
              const rowBad = on && sumKpi && error && !(pct > 0)
              return (
                <tr key={u.id} className={on ? '' : 'disabled'}>
                  <td>
                    {selectable ? (
                      <label className="check">
                        <input type="checkbox" checked={on} onChange={() => toggle(u.id)} />
                      </label>
                    ) : (
                      <button className="btn ghost icon xs" title="Remove" onClick={() => toggle(u.id)}>
                        <X size={14} />
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="row gap-6">
                      {u.avatar && <Avatar name={u.name} size="sm" />}
                      <div>
                        <div className="semi">{u.name}</div>
                        {u.sub && <div className="tiny muted">{u.sub}</div>}
                      </div>
                    </div>
                  </td>
                  {sumKpi ? (
                    <>
                      <td>
                        {on ? (
                          <div className="input-group">
                            <NumInput className="input sm pr" value={r.percent} invalid={rowBad} disabled={method !== 'percent'} min={0} max={100} onChange={(v) => patchRow(u.id, { percent: v })} />
                            <span className="addon">%</span>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {on ? (
                          method === 'amount' ? (
                            <div className="input-group">
                              <span className="addon left">{unit}</span>
                              <NumInput className="input sm pl" value={round(amount, 2)} invalid={rowBad} min={0} onChange={(v) => patchRow(u.id, { percent: v === '' ? '' : parentTarget ? (Number(v) / parentTarget) * 100 : 0 })} />
                            </div>
                          ) : (
                            <div>
                              <div className="bold mono">{fmtValue(unit, amount, false)}</div>
                              <div className="tiny muted">= {fmtPct(pct, 2)} of {fmtValue(unit, parentTarget)}</div>
                            </div>
                          )
                        ) : (
                          <span className="muted">—</span>
                        )}
                        {on && method === 'amount' && <div className="tiny muted mt-4">= {fmtPct(pct, 2)}</div>}
                      </td>
                    </>
                  ) : (
                    <td>{on ? <span className="badge blue">{kpi.type === 'completion' ? 'Fully achieved (100%)' : fmtValue(unit, Number(kpi.target))}</span> : <span className="muted">—</span>}</td>
                  )}
                  <td>
                    {on ? (
                      <div className="row gap-4">
                        <input type="date" className="input sm" value={r.startDate || ''} min={defaults.startDate} max={defaults.endDate} onChange={(e) => patchRow(u.id, { startDate: e.target.value })} />
                        <span className="muted">→</span>
                        <input type="date" className="input sm" value={r.endDate || ''} min={defaults.startDate} max={defaults.endDate} onChange={(e) => patchRow(u.id, { endDate: e.target.value })} />
                      </div>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AllocationSummary kpi={kpi} unit={unit} parentTarget={parentTarget} otherUsed={otherUsed} otherLabel={otherLabel} groupPct={total} count={rows.length} />
      {error && (
        <div className="err" style={{ padding: '0 16px 12px', color: 'var(--red)', fontSize: 12.5, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {!over && null}
    </div>
  )
}

export function AllocationSummary({ kpi, unit, parentTarget, otherUsed = 0, otherLabel, groupPct, count }) {
  if (kpi.type !== 'sum')
    return (
      <div className="alloc-summary">
        <Users size={16} color="var(--blue-600)" />
        <div className="small">
          <b>{count}</b> selected · every one carries the same target of{' '}
          <b>{kpi.type === 'completion' ? 'full completion' : fmtValue(unit, Number(kpi.target))}</b>. Results are <b>averaged</b> upwards.
        </div>
      </div>
    )
  const allocated = otherUsed + groupPct
  const remaining = 100 - allocated
  const over = allocated > 100.0001
  return (
    <div className="alloc-summary">
      <div style={{ flex: '1 1 260px', minWidth: 220 }}>
        <div className="stack-bar">
          {otherUsed > 0 && <span style={{ width: `${Math.min(100, otherUsed)}%`, background: '#93c5fd' }} title={`${otherLabel}: ${round(otherUsed, 2)}%`} />}
          <span style={{ width: `${Math.min(100 - Math.min(100, otherUsed), groupPct)}%`, background: over ? 'var(--red)' : 'var(--blue-600)' }} />
        </div>
        <div className="row gap-16 mt-8 tiny muted">
          {otherUsed > 0 && (
            <span className="row gap-4">
              <i className="legend-dot" style={{ background: '#93c5fd' }} /> {otherLabel} {round(otherUsed, 2)}%
            </span>
          )}
          <span className="row gap-4">
            <i className="legend-dot" style={{ background: over ? 'var(--red)' : 'var(--blue-600)' }} /> This step {round(groupPct, 2)}%
          </span>
          <span className="row gap-4">
            <i className="legend-dot" style={{ background: '#e8eef8', border: '1px solid #cdd7e8' }} /> Unallocated
          </span>
        </div>
      </div>
      <div>
        <div className="k">Allocated</div>
        <div className="v mono" style={{ color: over ? 'var(--red)' : 'var(--navy-800)' }}>
          {round(allocated, 2)}% <span className="small muted">· {fmtValue(unit, (parentTarget * allocated) / 100)}</span>
        </div>
      </div>
      <div>
        <div className="k">{over ? 'Over by' : 'Remaining'}</div>
        <div className="v mono" style={{ color: over ? 'var(--red)' : remaining < 0.01 ? 'var(--green)' : 'var(--amber)' }}>
          {round(Math.abs(remaining), 2)}% <span className="small muted">· {fmtValue(unit, (parentTarget * Math.abs(remaining)) / 100)}</span>
        </div>
      </div>
      {!over && remaining < 0.01 && (
        <span className="badge green">
          <Check size={12} /> Fully allocated
        </span>
      )}
    </div>
  )
}

/** Searchable multi-select of HR staff. People are never typed in — they come from the HR list. */
export function StaffPicker({ state, candidates, selectedIds, onToggle, disabledIds = [], title = 'Select people', showAllLabel, allCandidates, homeTeamId, teamFilter = false, defaultOpen = false }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(defaultOpen)
  const [showAll, setShowAll] = useState(false)
  const [tf, setTf] = useState('all')
  const list = showAll && allCandidates ? allCandidates : candidates
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return list
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.title.toLowerCase().includes(s))
      .filter((p) => tf === 'all' || (tf === 'none' ? !p.teamId : !!p.teamId))
      .sort((a, b) => (homeTeamId ? (b.teamId === homeTeamId) - (a.teamId === homeTeamId) : 0) || (!!a.teamId - !!b.teamId) || a.name.localeCompare(b.name))
  }, [list, q, tf, homeTeamId])
  const noTeam = list.filter((p) => !p.teamId).length
  const teamName = (p) => state.teams.find((t) => t.id === p.teamId)?.name
  const deptName = (p) => state.departments.find((d) => d.id === p.departmentId)?.name

  return (
    <div>
      <div className="row wrap">
        <button className="btn soft sm" onClick={() => setOpen(!open)}>
          <Users size={14} /> {title} ({selectedIds.length})
        </button>
        {selectedIds.length === 0 && <span className="small muted">Pick from the staff list synced from HR.</span>}
      </div>
      {open && (
        <div className="picker mt-8">
          <div className="row" style={{ padding: 8, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
              <input className="input sm" style={{ paddingLeft: 32 }} placeholder="Search staff by name or role…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            </div>
            {allCandidates && (
              <label className="check small">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> {showAllLabel}
              </label>
            )}
            {teamFilter && (
              <div className="seg">
                <button className={tf === 'all' ? 'on' : ''} onClick={() => setTf('all')}>All {list.length}</button>
                <button className={tf === 'none' ? 'on' : ''} onClick={() => setTf('none')}>No team {noTeam}</button>
                <button className={tf === 'team' ? 'on' : ''} onClick={() => setTf('team')}>In a team {list.length - noTeam}</button>
              </div>
            )}
            <button className="btn ghost xs" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
          <div className="picker-list">
            {filtered.length === 0 && <div className="muted small center" style={{ padding: 16 }}>No staff match “{q}”.</div>}
            {filtered.map((p) => {
              const on = selectedIds.includes(p.id)
              const dis = disabledIds.includes(p.id)
              return (
                <div key={p.id} className={`picker-item ${on ? 'on' : ''} ${dis ? 'disabled' : ''}`} onClick={() => !dis && onToggle(p.id)}>
                  <input type="checkbox" checked={on} disabled={dis} readOnly style={{ accentColor: 'var(--blue-600)' }} />
                  <Avatar name={p.name} size="sm" />
                  <div style={{ flex: 1 }}>
                    <div className="semi">{p.name}</div>
                    <div className="tiny muted">{p.title} · {deptName(p) || '—'}</div>
                  </div>
                  {homeTeamId && p.teamId !== homeTeamId && <span className="badge violet" title="Not a member of this team, but can contribute to it">outside this team · contributes here</span>}
                  {teamName(p) ? <span className="badge green">In {teamName(p)}</span> : <span className="badge gray">No team</span>}
                  {dis && <span className="tiny muted">already assigned</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

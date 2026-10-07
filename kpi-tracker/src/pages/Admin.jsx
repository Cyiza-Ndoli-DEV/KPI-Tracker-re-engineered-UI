import { useState } from 'react'
import { Settings, Lock, Unlock, X, Plus, ScrollText, Database, RefreshCw, Check, Undo2, Clock, Send, PencilLine, ShieldCheck, UserMinus, Users } from 'lucide-react'
import { useStore } from '../store'
import { Field, NumInput, Badge, Tabs, Empty, Avatar, Alert, useFeedback } from '../components/ui'
import { valueLabel } from '../components/KpiWidgets'
import { AuditTable } from './KpiDetail'
import { LeaverModal } from '../components/ChangeModals'
import { SetupPanel, OrgFitPanel } from './AdminSetup'
import { byId, unitName } from '../lib/calc'
import { fmtDate, fmtDateTime, timeAgo } from '../lib/utils'

export default function Admin() {
  const { state, grantEdit, revertEdit, rejectEdit, resetDemo } = useStore()
  const { toast, confirm } = useFeedback()
  const [section, setSection] = useState('setup')
  const [tab, setTab] = useState('pending')
  const [extendDays, setExtendDays] = useState({})
  const [leaver, setLeaver] = useState(false)
  const staffMoves = state.audit.filter((a) => ['Member left', 'Member moved out', 'Member removed'].includes(a.action))
  const leavers = state.staff.filter((s) => s.active === false)

  const pending = state.editRequests.filter((r) => r.status === 'pending')
  const granted = state.editRequests.filter((r) => r.status === 'granted')
  const history = state.editRequests.filter((r) => ['reverted', 'rejected'].includes(r.status))
  const list = tab === 'pending' ? pending : tab === 'granted' ? granted : history
  return (
    <div className="col gap-20">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Admin settings</h1>
          <div className="sub">Set up labels and percentages, Org Fit scores, edit requests, staff changes and the full audit trail.</div>
        </div>
      </div>

      <div className="card" style={{ padding: '0 12px' }}>
        <Tabs value={section} onChange={setSection} tabs={[
          { key: 'setup', label: 'Set up', icon: <Settings size={15} /> },
          { key: 'orgfit', label: 'Org Fit scores', icon: <Users size={15} /> },
          { key: 'requests', label: 'Edit requests', icon: <Lock size={15} />, count: pending.length || undefined },
          { key: 'staff', label: 'Staff changes', icon: <UserMinus size={15} /> },
          { key: 'audit', label: 'Audit log', icon: <ScrollText size={15} /> },
          { key: 'system', label: 'HR sync & demo', icon: <Database size={15} /> },
        ]} />
      </div>

      {section === 'setup' && <SetupPanel />}
      {section === 'orgfit' && <OrgFitPanel />}

      {section === 'requests' && (<>
      <div className="grid g-2">
        <div className="card">
          <div className="card-head"><ShieldCheck size={18} color="var(--blue-600)" /><h3>How locked updates are changed</h3></div>
          <div className="card-body">
            <div className="timeline">
              {[
                [Lock, `Update locks ${state.settings.editWindowDays} days after it is submitted`],
                [Send, 'The person clicks “Request edit” and gives a reason'],
                [Unlock, 'Admin extends the edit window for that user and KPI'],
                [PencilLine, 'The person makes the change (old and new value are logged)'],
                [Undo2, 'Admin reverts the window — the update is locked again'],
              ].map(([I, t], i) => (
                <div key={i} className="tl-item row gap-6 small"><I size={14} color="var(--blue-600)" /> {t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><Lock size={18} color="var(--blue-600)" /><h3>Edit requests</h3></div>
        <div style={{ padding: '0 20px' }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ key: 'pending', label: 'Pending', count: pending.length }, { key: 'granted', label: 'Window extended', count: granted.length }, { key: 'history', label: 'History', count: history.length }]} />
        </div>
        {list.length === 0 ? (
          <Empty icon={<Clock />} title={tab === 'pending' ? 'No pending requests' : tab === 'granted' ? 'No open edit windows' : 'Nothing here yet'} />
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Requested by</th><th>KPI · result</th><th>Reason</th><th>Status</th><th style={{ width: 280 }} /></tr></thead>
              <tbody>
                {list.map((r) => {
                  const u = byId(state.updates, r.updateId)
                  const kpi = byId(state.kpis, r.kpiId)
                  const alloc = u && byId(state.allocations, u.allocationId)
                  const person = byId(state.staff, r.requestedBy)
                  const editedSince = u?.editedAt && r.grantedAt && u.editedAt > r.grantedAt
                  return (
                    <tr key={r.id}>
                      <td><div className="row gap-6"><Avatar name={person?.name} size="sm" /><div><div className="semi">{person?.name}</div><div className="tiny muted">{timeAgo(r.requestedAt)}</div></div></div></td>
                      <td className="small"><b>{kpi?.name}</b><div className="muted">{alloc ? unitName(state, alloc) : ''} · {u ? `${fmtDate(u.date)} · ${kpi.type === 'sum' ? '+' : ''}${valueLabel(kpi, u.value)}` : 'update removed'}</div></td>
                      <td className="small" style={{ maxWidth: 280 }}>“{r.reason}”</td>
                      <td>
                        {r.status === 'pending' && <Badge tone="amber">Pending</Badge>}
                        {r.status === 'granted' && <><Badge tone="violet"><Unlock size={11} /> until {fmtDateTime(r.grantedUntil)}</Badge>{editedSince ? <div className="tiny" style={{ color: 'var(--green)', marginTop: 4 }}>✓ edited — ready to revert</div> : <div className="tiny muted mt-4">waiting for the edit</div>}</>}
                        {r.status === 'reverted' && <Badge tone="green"><Lock size={11} /> Reverted</Badge>}
                        {r.status === 'rejected' && <Badge tone="red">Rejected</Badge>}
                      </td>
                      <td className="right">
                        {r.status === 'pending' && (
                          <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                            <div className="input-group" style={{ width: 92 }}>
                              <NumInput className="input sm pr" value={extendDays[r.id] ?? 3} min={1} onChange={(v) => setExtendDays((x) => ({ ...x, [r.id]: v }))} />
                              <span className="addon">d</span>
                            </div>
                            <button className="btn primary sm" disabled={!u} onClick={() => { grantEdit(r.id, Number(extendDays[r.id] ?? 3) || 1); toast(`Edit window extended for ${person?.name}.`) }}><Unlock size={14} /> Extend</button>
                            <button className="btn ghost sm" onClick={() => { rejectEdit(r.id); toast('Request rejected.', 'warn') }}>Reject</button>
                          </div>
                        )}
                        {r.status === 'granted' && <button className="btn secondary sm" onClick={() => { revertEdit(r.id); toast('Edit window reverted — the update is locked again.') }}><Undo2 size={14} /> Revert (lock again)</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>)}

      {section === 'staff' && (<>
      <div className="card">
        <div className="card-head">
          <UserMinus size={18} color="var(--blue-600)" /><h3>Staff changes</h3>
          <span className="small muted">people who left, moved, or were taken off a KPI</span>
          <div className="spacer" />
          <button className="btn primary sm" onClick={() => setLeaver(true)}><UserMinus size={14} /> Record a leaver or a move</button>
        </div>
        {staffMoves.length === 0 ? (
          <Empty title="No staff changes yet">When someone leaves, their achievements stay in the totals and their unfinished target is shared out, handed over or left unallocated.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>When</th><th>Person → group</th><th>What happened</th><th>Before</th><th>After</th><th>By</th></tr></thead>
            <tbody>
              {staffMoves.slice(0, 12).map((a) => (
                <tr key={a.id}>
                  <td className="small nowrap">{fmtDateTime(a.at)}</td>
                  <td className="small semi">{a.subject}<div className="tiny muted">{byId(state.kpis, a.kpiId)?.name}</div></td>
                  <td className="small">{a.note}</td>
                  <td className="tiny muted" style={{ maxWidth: 220 }}>{a.oldValue}</td>
                  <td className="tiny" style={{ maxWidth: 320 }}>{a.newValue}</td>
                  <td className="small">{byId(state.staff, a.who)?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {leavers.length > 0 && <div className="card-pad small muted" style={{ borderTop: '1px solid var(--border)' }}>Inactive in the KPI Tracker: {leavers.map((s) => `${s.name} (left ${fmtDate(s.leftDate)})`).join(', ')}</div>}
      </div>
      </>)}
      {leaver && <LeaverModal onClose={() => setLeaver(false)} />}

      {section === 'audit' && (
      <div className="card">
        <div className="card-head"><ScrollText size={18} color="var(--blue-600)" /><h3>Audit log</h3><span className="small muted">every change: when, who, old value and new value</span></div>
        <AuditTable state={state} entries={state.audit} showKpi />
      </div>
      )}

      {section === 'system' && (
      <div className="grid g-2">
        <div className="card">
          <div className="card-head"><Database size={18} color="var(--blue-600)" /><h3>Synced from Pahappa HR</h3><Badge tone="green" dot>mock sync</Badge></div>
          <div className="card-body">
            <div className="grid g-3">
              <div className="stat" style={{ padding: 0 }}><div><div className="v">{state.departments.length}</div><div className="k">Departments</div></div></div>
              <div className="stat" style={{ padding: 0 }}><div><div className="v">{state.teams.length}</div><div className="k">Teams</div></div></div>
              <div className="stat" style={{ padding: 0 }}><div><div className="v">{state.staff.filter((s) => s.active !== false).length}</div><div className="k">Active staff</div></div></div>
            </div>
            <p className="small muted mt-12">Departments, users and roles come from HR. Teams can be created in the KPI Tracker (also from inside the setup wizard); people are never typed in.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><RefreshCw size={18} color="var(--blue-600)" /><h3>Demo data</h3></div>
          <div className="card-body">
            <p className="small muted mb-12">Everything you do in the prototype is kept in this browser. Reset to start the demo again from the original sample data.</p>
            <button
              className="btn danger"
              onClick={async () => {
                if (await confirm({ title: 'Reset all demo data?', message: 'All changes made in this browser are discarded and the original sample data is restored.', okLabel: 'Reset demo', danger: true })) {
                  resetDemo()
                  toast('Demo data restored.')
                }
              }}
            >
              <RefreshCw size={15} /> Reset demo data
            </button>
          </div>
        </div>
      </div>
      )}
      <Alert>Switch roles in the header to see the Department Head, Team Lead and Employee views.</Alert>
    </div>
  )
}

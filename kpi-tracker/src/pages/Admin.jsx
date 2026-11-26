import { useState } from 'react'
import { Settings, Lock, Unlock, ScrollText, Undo2, Clock, ClipboardCheck } from 'lucide-react'
import { useStore } from '../store'
import { NumInput, Badge, Tabs, Empty, Avatar, useFeedback } from '../components/ui'
import { valueLabel } from '../components/KpiWidgets'
import { AuditTable } from './KpiDetail'
import { SetupPanel } from './AdminSetup'
import KeeperTestSettings from './KeeperTestSettings'
import { byId, unitName } from '../lib/calc'
import { fmtDate, fmtDateTime, timeAgo } from '../lib/utils'

export default function Admin() {
  const { state, grantEdit, revertEdit, rejectEdit } = useStore()
  const { toast } = useFeedback()
  const [section, setSection] = useState('setup')
  const [tab, setTab] = useState('pending')
  const [extendDays, setExtendDays] = useState({})

  const pending = state.editRequests.filter((r) => r.status === 'pending')
  const granted = state.editRequests.filter((r) => r.status === 'granted')
  const history = state.editRequests.filter((r) => ['reverted', 'rejected'].includes(r.status))
  const list = tab === 'pending' ? pending : tab === 'granted' ? granted : history
  return (
    <div className="col gap-20">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Admin settings</h1>
        </div>
      </div>

      <div className="card" style={{ padding: '0 12px' }}>
        <Tabs value={section} onChange={setSection} tabs={[
          { key: 'setup', label: 'Set up', icon: <Settings size={15} /> },
          { key: 'keeper-test', label: 'Keeper Test', icon: <ClipboardCheck size={15} /> },
          { key: 'requests', label: 'Edit requests', icon: <Lock size={15} />, count: pending.length || undefined },
          { key: 'audit', label: 'Audit log', icon: <ScrollText size={15} /> },
        ]} />
      </div>

      {section === 'setup' && <SetupPanel />}
      {section === 'keeper-test' && <KeeperTestSettings />}

      {section === 'requests' && (<>
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

      {section === 'audit' && (
      <div className="card">
        <div className="card-head"><ScrollText size={18} color="var(--blue-600)" /><h3>Audit log</h3></div>
        <AuditTable state={state} entries={state.audit} showKpi />
      </div>
      )}

    </div>
  )
}

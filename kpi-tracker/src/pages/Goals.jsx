import { useState } from 'react'
import { Target, Wand2, FileClock } from 'lucide-react'
import { useStore } from '../store'
import { Link, Empty, SearchField } from '../components/ui'
import GoalsTable from '../components/GoalsTable'
import { byId, cycleGoals, KPI_TYPES } from '../lib/calc'
const goalStatuses = { ready: 'Ready', running: 'Running', stopped: 'Stopped', draft: 'Draft' }

export default function Goals() {
  const { state } = useStore()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const cycle = byId(state.cycles, state.viewCycleId)
  if (!cycle) return <Empty title="No review cycle selected" />
  const goals = cycleGoals(state, cycle.id)
  const query = search.trim().toLowerCase()
  const filtered = goals.filter((goal) => (status === 'all' || goal.status === status) &&
    (type === 'all' || goal.type === type) && goal.name.toLowerCase().includes(query))
  const hasFilters = Boolean(query || status !== 'all' || type !== 'all')
  const drafts = state.drafts.filter((d) => d.cycleId === cycle.id)
  const isAdmin = state.role === 'admin'
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Goals</h1>
        </div>
        <div className="spacer" />
        {isAdmin && drafts.length > 0 && <Link to="/drafts" className="btn secondary"><FileClock size={16} /> {drafts.length} draft{drafts.length > 1 ? 's' : ''}</Link>}
        {isAdmin && cycle.status !== 'ended' && <Link to="/wizard" className="btn primary"><Wand2 size={16} /> Set up a goal</Link>}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="row table-toolbar filter-toolbar">
          <SearchField label="Search goals" value={search} onChange={setSearch} />
          <label className="filter-field">Status
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {Object.entries(goalStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="filter-field">Type
            <select className="select" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All types</option>
              {Object.entries(KPI_TYPES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
            </select>
          </label>
          {hasFilters && <button type="button" className="btn ghost sm" onClick={() => { setSearch(''); setStatus('all'); setType('all') }}>Clear filters</button>}
        </div>
        {goals.length === 0 ? (
          <Empty icon={<Target />} title="No goals in this cycle" />
        ) : filtered.length === 0 ? (
          <Empty icon={<Target />} title="No goals match these filters" />
        ) : (
          <GoalsTable goals={filtered} deep={false} />
        )}
      </div>
    </div>
  )
}

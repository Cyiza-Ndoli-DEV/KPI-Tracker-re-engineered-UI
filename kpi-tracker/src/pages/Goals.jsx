import { Target, Wand2, FileClock } from 'lucide-react'
import { useStore } from '../store'
import { Link, Empty } from '../components/ui'
import GoalsTable from '../components/GoalsTable'
import { byId, cycleGoals } from '../lib/calc'

export default function Goals() {
  const { state } = useStore()
  const cycle = byId(state.cycles, state.viewCycleId)
  const goals = cycleGoals(state, cycle.id)
  const drafts = state.drafts.filter((d) => d.cycleId === cycle.id)
  const isAdmin = state.role === 'admin'
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Goals</h1>
          <div className="sub">Organization goals in {cycle.name}. Each goal is tracked on its own (100%). Expand a goal for its KPIs, and a KPI for who contributes.</div>
        </div>
        <div className="spacer" />
        {isAdmin && drafts.length > 0 && <Link to="/drafts" className="btn secondary"><FileClock size={16} /> {drafts.length} draft{drafts.length > 1 ? 's' : ''}</Link>}
        {isAdmin && cycle.status !== 'ended' && <Link to="/wizard" className="btn primary"><Wand2 size={16} /> Set up a goal</Link>}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        {goals.length === 0 ? (
          <Empty icon={<Target />} title="No goals in this cycle">Use the setup wizard to create the first one.</Empty>
        ) : (
          <GoalsTable goals={goals} />
        )}
      </div>
    </div>
  )
}

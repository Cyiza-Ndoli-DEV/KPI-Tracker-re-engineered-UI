import { Seg } from './ui'

/** Rank of each level in the hierarchy (goal 0 … person 5). */
export const RANK = { goal: 0, kpi: 1, organization: 1, department: 2, team: 3, individual: 4 }

/** "Show down to …" — collapses a hierarchy to any level in one click. */
export default function DepthControl({ value, onChange, levels = ['goal', 'kpi', 'department', 'team', 'individual'] }) {
  const LBL = { goal: 'Goals', kpi: 'KPIs', organization: 'Organization', department: 'Departments', team: 'Teams', individual: 'People' }
  return (
    <div className="row gap-6 depth-control">
      <span className="tiny muted semi">Show down to</span>
      <Seg value={value} onChange={onChange} options={levels.map((l) => ({ value: l, label: LBL[l] }))} />
    </div>
  )
}

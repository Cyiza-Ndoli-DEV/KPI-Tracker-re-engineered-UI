import { useStore } from '../store'
import { OrgFitPanel } from './AdminSetup'
import { byId } from '../lib/calc'

/** Organizational Fit scores — its own page in the side menu (moved out of Admin Settings). */
export default function OrgFit() {
  const { state } = useStore()
  const cycle = byId(state.cycles, state.viewCycleId)
  return (
    <div className="col gap-20">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Org Fit scores</h1>
          <div className="sub">Organizational Fit for everyone in {cycle.name}, from supervisor and peer ratings. It counts towards each person's final score.</div>
        </div>
      </div>
      <OrgFitPanel />
    </div>
  )
}

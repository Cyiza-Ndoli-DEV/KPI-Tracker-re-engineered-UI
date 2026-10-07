import { FileClock, Trash2, ArrowRight, Wand2, Copy } from 'lucide-react'
import { useStore } from '../store'
import { Empty, Link, Badge, useFeedback, navigate } from '../components/ui'
import { STEPS } from '../lib/draft'
import { byId } from '../lib/calc'
import { timeAgo, fmtDateTime } from '../lib/utils'

export default function Drafts() {
  const { state, deleteDraft } = useStore()
  const { confirm, toast } = useFeedback()
  const drafts = [...state.drafts].sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))

  const del = async (d) => {
    if (await confirm({ title: 'Delete this draft?', message: `“${d.goal.name || 'Untitled goal'}” and everything entered in it will be removed.`, okLabel: 'Delete draft', danger: true })) {
      deleteDraft(d.id)
      toast('Draft deleted.', 'warn')
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Drafts</h1>
          <div className="sub">Goals that are part-way through the setup wizard. Each one reopens at the step where you stopped.</div>
        </div>
        <div className="spacer" />
        <Link to="/wizard" className="btn primary"><Wand2 size={16} /> New goal</Link>
      </div>
      <div className="card">
        {drafts.length === 0 ? (
          <Empty icon={<FileClock />} title="No drafts">Anything you start in the wizard is saved here automatically.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Goal</th><th>Cycle</th><th>Where you stopped</th><th className="right">KPIs</th><th>Last saved</th><th /></tr></thead>
            <tbody>
              {drafts.map((d) => {
                const cycle = byId(state.cycles, d.cycleId)
                return (
                  <tr key={d.id} className="clickable" onClick={() => navigate(`/wizard?draft=${d.id}`)}>
                    <td>
                      <div className="bold">{d.goal.name || <span className="muted">Untitled goal</span>}</div>
                      <div className="row gap-6 mt-4">
                        {d.reusedFrom && <Badge tone="violet"><Copy size={10} /> reused</Badge>}
                      </div>
                    </td>
                    <td className="small">{cycle?.name}</td>
                    <td>
                      <div className="row gap-4">
                        {STEPS.map((s, i) => (
                          <span key={s.key} title={s.label} style={{ width: 22, height: 6, borderRadius: 4, background: i < d.step ? 'var(--blue-600)' : i === d.step ? 'var(--blue-400)' : '#e3e9f4' }} />
                        ))}
                      </div>
                      <div className="tiny muted mt-4">Step {d.step + 1} of {STEPS.length} · {STEPS[d.step].label}</div>
                    </td>
                    <td className="right">{d.kpis.length}</td>
                    <td className="small" title={fmtDateTime(d.savedAt)}>{timeAgo(d.savedAt)}<div className="tiny muted">by {byId(state.staff, d.createdBy)?.name}</div></td>
                    <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                      <button className="btn ghost sm" onClick={() => del(d)}><Trash2 size={14} /></button>
                      <Link to={`/wizard?draft=${d.id}`} className="btn primary sm">Continue <ArrowRight size={14} /></Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

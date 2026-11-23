import { currentUserId, useStore } from '../store'
import { useEffect, useState } from 'react'
import { Search, Star, Users } from 'lucide-react'
import { Avatar, Badge, Modal, ScoreDot, useFeedback } from '../components/ui'
import { assignedRatingSections, changedRatingSections, defaultRatingSetup, ratingCategoryType, ratingSection, ratingSetupError, ratingStatus, validRatings } from '../lib/orgFit'
import { band, byId, personScore } from '../lib/calc'
import { fmtDate, uid } from '../lib/utils'

/** Organizational Fit scores — its own page in the side menu (moved out of Admin Settings). */
export default function OrgFit() {
  const { state } = useStore()
  const cycle = byId(state.cycles, state.viewCycleId)
  const setup = state.orgFitSetup?.[cycle?.id] ?? defaultRatingSetup
  const [, refresh] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => refresh((tick) => tick + 1), 30000)
    return () => clearInterval(timer)
  }, [])
  const status = ratingStatus(setup)
  if (!cycle) return null
  return (
    <div className="col gap-20">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>{state.role === 'admin' ? 'Organizational Fit' : 'Ratings'}</h1>
        </div>
      </div>
      {state.role === 'admin'
        ? <AdminRatings key={cycle.id} cycle={cycle} setup={setup} status={status} />
        : <PersonalRatings key={cycle.id + ':' + currentUserId(state)} cycle={cycle} setup={setup} status={status} />}
    </div>
  )
}

function ratingWindow(setup, status) {
  if (status === 'Off') return 'Rating submissions are turned off.'
  if (status === 'Scheduled') return 'Ratings open on ' + fmtDate(setup.startDate) + '.'
  if (status === 'Closed') return 'Ratings closed on ' + fmtDate(setup.endDate) + '.'
  return setup.endDate ? 'Ratings are open through ' + fmtDate(setup.endDate) + '.' : 'Rating submissions are open.'
}

const adminTabs = ['Categories', 'Schedule', 'Scores']

function AdminRatings({ cycle, setup, status }) {
  const [tab, setTab] = useState('Categories')
  return (
    <>
      <nav className="row gap-6" aria-label="Rating settings sections">
        {adminTabs.map((name) => <button key={name} type="button" className={'btn ' + (tab === name ? 'primary' : '')}
          aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}
      </nav>
      {tab === 'Categories' && <RatingCategories cycle={cycle} setup={setup} />}
      {tab === 'Schedule' && <RatingSetup cycle={cycle} saved={setup} status={status} />}
      {tab === 'Scores' && <OrgFitPanel cycle={cycle} setup={setup} />}
    </>
  )
}

function RatingCategories({ cycle, setup }) {
  const { state, updateRatingSetup } = useStore()
  const { toast } = useFeedback()
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const entries = Object.entries(setup.categories)
  const hasRatings = (next) => {
    const sections = changedRatingSections(setup, next)
    return Object.values(state.orgFitSubmissions?.[cycle.id] || {}).some((submissions) =>
      sections.some((section) => submissions[section]))
  }

  function save(next, message) {
    updateRatingSetup(cycle.id, next)
    toast(message)
    setEditor(null)
    setDeleting(null)
  }

  const removeCategory = deleting ? { ...setup, categories: Object.fromEntries(entries.filter(([key]) => key !== deleting)) } : null
  if (removeCategory && entries.length === 1) removeCategory.enabled = false

  return (
    <section className="card">
      <div className="card-head">
        <h3>Rating categories</h3>
        <div className="spacer" />
        <button type="button" className="btn primary sm" onClick={() => setEditor({
          id: uid('rc'), category: { name: '', type: 'team', points: 5, dimensions: [['', '']] },
        })}>Add category</button>
      </div>
      {entries.length ? <div className="scroll-x"><table className="table">
        <thead><tr><th>Category</th><th>Reviewer type</th><th>Criteria</th><th>Points</th><th>Actions</th></tr></thead>
        <tbody>{entries.map(([id, category]) => (
          <tr key={id}>
            <td className="semi">{category.name}</td>
            <td>{defaultRatingSetup.categories[ratingCategoryType(id, category)].name}</td>
            <td>{category.dimensions.length}</td>
            <td>{category.points}</td>
            <td><div className="row gap-6">
              <button className="btn sm" onClick={() => setEditor({ id, category })}>Edit</button>
              <button className="btn sm" onClick={() => setDeleting(id)}>Delete</button>
            </div></td>
          </tr>
        ))}</tbody>
      </table></div> : <p className="rating-availability muted">No rating categories. Add a category to get started.</p>}
      {editor && <CategoryEditor setup={setup} editor={editor} hasRatings={hasRatings} onClose={() => setEditor(null)}
        onSave={(next) => save(next, 'Rating category saved')} />}
      {deleting && <Modal title={'Delete ' + setup.categories[deleting].name + '?'} onClose={() => setDeleting(null)} footer={
        <>
          <button className="btn" onClick={() => setDeleting(null)}>Cancel</button>
          <button className="btn primary" onClick={() => save(removeCategory, 'Rating category deleted')}>Delete category</button>
        </>
      }>
        <p>This removes the category from this cycle and recalculates scores.</p>
        {hasRatings(removeCategory) && <p>Existing submissions for this category will be archived.</p>}
        {entries.length === 1 && setup.enabled && <p>Submissions will turn off until another category is added and ratings are enabled again.</p>}
      </Modal>}
    </section>
  )
}

function CategoryEditor({ setup, editor, hasRatings, onSave, onClose }) {
  const [category, setCategory] = useState(editor.category)
  const next = { ...setup, categories: { ...setup.categories, [editor.id]: category } }
  const error = ratingSetupError(next)
  const replacing = hasRatings(next)
  return (
    <Modal title={setup.categories[editor.id] ? 'Edit category' : 'Add category'} size="lg" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={Boolean(error)} onClick={() => onSave(next)}>Save category</button>
      </>
    }>
      <div className="col gap-12">
        <label className="col gap-6 small">Category name
          <input className="input" value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} />
        </label>
        <div className="rating-settings-grid">
          <label className="col gap-6 small">Reviewer type
            <select className="input" value={ratingCategoryType(editor.id, category)} onChange={(event) => setCategory({ ...category, type: event.target.value })}>
              {Object.entries(defaultRatingSetup.categories).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}
            </select>
          </label>
          <label className="col gap-6 small">Points
            <input className="input" type="number" min="1" step="1" value={category.points || ''} onChange={(event) => setCategory({ ...category, points: Number(event.target.value) })} />
          </label>
        </div>
        {category.dimensions.map(([name, description], index) => {
          const changeCriterion = (nextCriterion) => setCategory((current) => ({
            ...current, dimensions: current.dimensions.map((criterion, i) => i === index ? nextCriterion : criterion),
          }))
          return (
            <div className="rating-settings-grid" key={index}>
              <label className="col gap-6 small">Criterion {index + 1}
                <input className="input" value={name} onChange={(event) => changeCriterion([event.target.value, description])} />
              </label>
              <label className="col gap-6 small">Description
                <input className="input" value={description} onChange={(event) => changeCriterion([name, event.target.value])} />
              </label>
              <button className="btn sm" aria-label={'Delete criterion ' + (index + 1)} disabled={category.dimensions.length === 1}
                onClick={() => setCategory({ ...category, dimensions: category.dimensions.filter((_, i) => i !== index) })}>Delete</button>
            </div>
          )
        })}
        <div><button className="btn sm" onClick={() => setCategory({ ...category, dimensions: [...category.dimensions, ['', '']] })}>Add criterion</button></div>
        {error && <p className="small" role="alert">{error}</p>}
        {replacing && <p className="small" role="status">Saving these changes archives existing submissions for this category. Reviewers will need to rate it again.</p>}
      </div>
    </Modal>
  )
}

function RatingSetup({ cycle, saved, status }) {
  const { updateRatingSetup } = useStore()
  const { toast } = useFeedback()
  const [draft, setDraft] = useState(saved)
  const error = ratingSetupError(draft)
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)

  return (
    <form className="card" onSubmit={(event) => {
      event.preventDefault()
      if (!changed || error) return
      updateRatingSetup(cycle.id, draft)
      toast('Rating settings saved')
    }}>
      <div className="card-head">
        <h3>Rating settings · {cycle.name}</h3>
        <div className="spacer" />
        <Badge tone={status === 'Open' ? 'green' : 'gray'}>{status}</Badge>
      </div>
      <div className="rating-setup col gap-16">
        <p className="small muted" aria-live="polite">{ratingWindow(saved, status)}</p>
        <label className="row gap-6 semi">
          <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
          Enable rating submissions
        </label>
        <div className="rating-settings-grid">
          <label className="col gap-6 small">Opening date
            <input className="input" type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
          </label>
          <label className="col gap-6 small">Closing date
            <input className="input" type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
          </label>
        </div>
        <p className="tiny muted">Dates are optional and use Kampala time. The closing date is included.</p>
        {error && <p className="small" role="alert">{error}</p>}
        <div><button className="btn primary" disabled={!changed || Boolean(error)}>Save rating settings</button></div>
      </div>
    </form>
  )
}

function OrgFitPanel({ cycle, setup }) {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const people = state.staff.filter((s) => s.active !== false && s.departmentId && s.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="card">
      <div className="card-head">
        <Users size={18} color="var(--blue-600)" /><h3>Organizational Fit scores · {cycle.name}</h3>
        <div className="spacer" />
        <div className="input-group" style={{ width: 200 }}><Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} /><input className="input sm" style={{ paddingLeft: 30 }} placeholder="Search person" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th>Person</th><th>Department / team</th><th className="center">KPI score</th><th className="center">Org Fit score</th><th className="center">Final score</th><th>Band</th><th>Details</th></tr></thead>
          <tbody>
            {people.map((p) => {
              const sc = personScore(state, p.id, cycle.id)
              return (
                <tr key={p.id}>
                  <td><div className="row gap-6"><Avatar name={p.name} size="sm" /><div><div className="semi small">{p.name}</div><div className="tiny muted">{p.title}{sc.isLead ? ' · team lead' : ''}</div></div></div></td>
                  <td className="small">{byId(state.departments, p.departmentId)?.name}{p.teamId ? ` · ${byId(state.teams, p.teamId)?.name}` : ''}</td>
                  <td className="center">{sc.kpiPart === null ? <span className="tiny muted">no KPIs</span> : <ScoreDot value={sc.kpiPart} title={sc.isLead ? `Average of ${sc.members} team members` : 'Average of own KPIs'} />}</td>
                  <td className="center">{sc.orgFit === null ? <span className="tiny muted">not rated yet</span> : <ScoreDot value={sc.orgFit} muted />}</td>
                  <td className="center">{sc.final === null ? <span className="tiny muted">—</span> : <ScoreDot value={sc.final} size="lg" />}</td>
                  <td>{sc.final === null ? <span className="tiny muted">—</span> : <Badge tone={band(state, sc.final).tone}>{band(state, sc.final).label}</Badge>}</td>
                  <td><button className="btn sm" aria-label={'View ratings for ' + p.name} onClick={() => setSelected(p)}>View ratings</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selected && <RatingResults employee={selected} setup={setup}
        submissions={state.orgFitSubmissions?.[cycle.id]?.[selected.id]} staff={state.staff}
        onClose={() => setSelected(null)} />}
    </div>
  )
}


function RatingResults({ employee, setup, submissions, staff, onClose }) {
  const sections = Object.entries(submissions || {}).flatMap(([section, reviewers]) => {
    const category = ratingSection(setup, section)
    return category && Object.keys(reviewers).length ? [{ section, category, reviewers }] : []
  })

  return (
    <Modal title="Rating results" sub={employee.name} size="rating-modal" onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      {sections.length ? (
        <div className="col gap-20">
          {sections.map(({ section, category, reviewers }) => (
            <section className="col gap-10" key={section}>
              <h3>{category.name}{(section === 'keeperSelf' || section.endsWith(':self')) && ' self-assessment'}</h3>
              {Object.entries(reviewers).map(([id, ratings]) => (
                <div key={id}>
                  <div className="semi">{byId(staff, id)?.name ?? id}{id === employee.id && ' (self)'}</div>
                  {category.dimensions.map(([name], index) => {
                    const stars = ratings[index]
                    return (
                      <div className="rating-dimension" key={index}>
                        <span>{name}</span>
                        <div>
                          <div className="rating-stars" aria-hidden="true">
                            {scale.map((word, position) => (
                              <Star key={word} size={18} color="#956100" fill={position < stars ? '#956100' : 'none'} />
                            ))}
                          </div>
                          <span className="tiny muted">{stars} of 5{scale[stars - 1] && ' · ' + scale[stars - 1]}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : <p className="small muted">No individual ratings have been submitted for this person in this cycle.</p>}
    </Modal>
  )
}

function PersonalRatings({ cycle, setup, status }) {
  const { state } = useStore()
  const [editing, setEditing] = useState(null)
  const reviewer = byId(state.staff, currentUserId(state))
  const submissions = state.orgFitSubmissions?.[cycle.id]
  const assignments = state.staff.flatMap((employee) => assignedRatingSections(setup, state, reviewer, employee).map((section) => ({
    employee, section, row: submissions?.[employee.id]?.[section]?.[reviewer.id],
  })))
  assignments.sort((a, b) => Number(b.employee.id === reviewer.id) - Number(a.employee.id === reviewer.id))

  return (
    <div className="card">
      <div className="card-head">
        <Users size={18} color="var(--blue-600)" /><h3>My rating assignments · {cycle.name}</h3>
      </div>
      <p className="rating-availability small muted" aria-live="polite">{ratingWindow(setup, status)}</p>
      {assignments.length ? (
        <div className="scroll-x">
          <table className="table">
            <thead><tr><th>Person</th><th>Assessment</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {assignments.map(({ employee, section, row }) => {
                const isSelf = employee.id === reviewer.id
                const category = ratingSection(setup, section)
                const name = isSelf ? category.name + ' self-assessment' : category.name
                return (
                  <tr key={employee.id + ':' + section}>
                    <td><div className="semi">{employee.name}{isSelf && ' (you)'}</div><div className="tiny muted">{employee.title}</div></td>
                    <td>{name}</td>
                    <td><Badge tone={row ? 'green' : 'gray'}>{row ? 'Submitted' : 'Pending'}</Badge></td>
                    <td>{(status === 'Open' || row) && <button className="btn sm" aria-label={(status !== 'Open' ? 'View ' : row ? 'Edit ' : 'Rate ') + employee.name + ' · ' + name}
                      onClick={() => setEditing({ employee, section, name, row })}>{status !== 'Open' ? 'View rating' : row ? 'Edit rating' : 'Rate'}</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="muted small" style={{ padding: 16 }}>You have no rating assignments for this cycle.</p>}
      {editing && <RatingForm cycle={cycle} setup={setup} status={status} assignment={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const scale = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']

function RatingForm({ cycle, setup, status, assignment, onClose }) {
  const { submitOrgFitRatings } = useStore()
  const { toast } = useFeedback()
  const { employee, section, name, row } = assignment
  const { dimensions } = ratingSection(setup, section)
  const readOnly = status !== 'Open'
  const [values, setValues] = useState(() => row?.slice() || Array(dimensions.length).fill(''))

  return (
    <Modal size="rating-modal" title={name} sub={employee.name + ' · ' + cycle.name} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
        {!readOnly && <button className="btn primary" disabled={!validRatings(setup, section, values)} onClick={() => {
          if (ratingStatus(setup) !== 'Open') {
            toast('The rating window has closed.', 'warn')
            return
          }
          submitOrgFitRatings(cycle.id, employee.id, section, values)
          toast('Rating submitted')
          onClose()
        }}>Submit rating</button>}
      </>
    }>
      {!readOnly && <p className="small muted">Choose a star for each criterion.</p>}
      <div>
        {dimensions.map(([label, description], index) => (
          <div className="rating-dimension" key={index}>
            <div>
              <div className="semi">{label}</div>
              <div className="small muted">{description}</div>
            </div>
            <div>
              <div className="rating-stars rating-stars-labeled" role="radiogroup" aria-label={label}>
                {scale.map((word, position) => {
                  const value = position + 1
                  return (
                    <label className="rating-star" key={word} title={word}>
                      <input type="radio" name={section + '-rating-' + index}
                        aria-label={value + ' of 5 — ' + word}
                        checked={values[index] === value} disabled={readOnly}
                        onChange={() => setValues((current) => current.map((rating, i) => i === index ? value : rating))} />
                      <Star size={20} fill={value <= values[index] ? 'currentColor' : 'none'} aria-hidden="true" />
                      <span className="rating-star-word" aria-hidden="true">{word}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

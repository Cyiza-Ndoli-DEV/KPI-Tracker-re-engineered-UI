import { currentUserId, useStore } from '../store'
import { useEffect, useState } from 'react'
import { CalendarClock, PencilLine, Star, Trash2, Users } from 'lucide-react'
import { Avatar, Badge, Field, Modal, ScoreDot, Tabs, useFeedback } from '../components/ui'
import { assignedRatingSections, changedRatingSections, criterionPoints, defaultRatingSetup, ratingCategoryType, ratingHistory, ratingSection, ratingSetupError, ratingStatus, starPoints, validRatings } from '../lib/orgFit'
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
      {tab === 'Scores' && <OrgFitPanel cycle={cycle} />}
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
              <button className="btn primary icon sm" title="Edit category" aria-label={'Edit ' + category.name} onClick={() => setEditor({ id, category })}><PencilLine size={14} aria-hidden="true" /></button>
              <button className="btn danger icon sm" title="Delete category" aria-label={'Delete ' + category.name} onClick={() => setDeleting(id)}><Trash2 size={14} aria-hidden="true" /></button>
            </div></td>
          </tr>
        ))}</tbody>
      </table></div> : <p className="rating-availability muted">No rating categories</p>}
      {editor && <CategoryEditor setup={setup} editor={editor} hasRatings={hasRatings} onClose={() => setEditor(null)}
        onSave={(next) => save(next, 'Rating category saved')} />}
      {deleting && <Modal title={'Delete ' + setup.categories[deleting].name + '?'} onClose={() => setDeleting(null)} footer={
        <>
          <button className="btn" onClick={() => setDeleting(null)}>Cancel</button>
          <button className="btn danger-solid icon" title="Confirm delete" aria-label="Confirm delete category" onClick={() => save(removeCategory, 'Rating category deleted')}><Trash2 size={16} aria-hidden="true" /></button>
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
          <label className="col gap-6 small">Category points
            <input className="input" type="number" min="1" step="1" value={category.points || ''} onChange={(event) => setCategory({ ...category, points: Number(event.target.value) })} />
          </label>
        </div>
        {category.dimensions.map(([name, description, points], index) => {
          const changeCriterion = (nextCriterion) => setCategory((current) => ({
            ...current, dimensions: current.dimensions.map((criterion, i) => i === index ? nextCriterion : criterion),
          }))
          return (
            <div className="rating-settings-grid" key={index}>
              <label className="col gap-6 small">Criterion {index + 1}
                <input className="input" value={name} onChange={(event) => changeCriterion([event.target.value, description, points])} />
              </label>
              <label className="col gap-6 small">Criterion points
                <input className="input" type="number" min="0" step="any" value={points ?? ''}
                  placeholder={formatRatingPoints(criterionPoints(category, index))}
                  onChange={(event) => changeCriterion([name, description, event.target.value === '' ? null : Number(event.target.value)])} />
              </label>
              <button className="btn danger icon sm" title="Delete criterion" aria-label={'Delete criterion ' + (index + 1)} disabled={category.dimensions.length === 1}
                onClick={() => setCategory({ ...category, dimensions: category.dimensions.filter((_, i) => i !== index) })}><Trash2 size={14} aria-hidden="true" /></button>
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
    <form className="card rating-schedule" onSubmit={(event) => {
      event.preventDefault()
      if (!changed || error) return
      updateRatingSetup(cycle.id, draft)
      toast('Rating settings saved')
    }}>
      <div className="card-head rating-schedule-head">
        <div className="rating-schedule-icon"><CalendarClock size={22} aria-hidden="true" /></div>
        <div>
          <h3>Rating schedule</h3>
          <div className="small muted">{cycle.name}</div>
        </div>
        <div className="spacer" />
        <div role="status">
          <Badge tone={status === 'Open' ? 'green' : status === 'Scheduled' ? 'amber' : 'red'} dot>{status === 'Off' ? 'Ratings off' : status}</Badge>
        </div>
      </div>
      <div className="rating-setup col gap-20">
        <label className="rating-schedule-switch">
          <span className="semi">Enable rating submissions</span>
          <input className="rating-switch" type="checkbox" role="switch" checked={draft.enabled}
            onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
        </label>
        <div className="rating-schedule-dates">
          <Field label="Start date" htmlFor="rating-start-date">
            <div className="rating-date-input" data-empty={!draft.startDate}>
              <input id="rating-start-date" className="input" type="date" name="startDate" value={draft.startDate}
                onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
              <span aria-hidden="true">Start date</span>
            </div>
          </Field>
          <Field label="End date" htmlFor="rating-end-date">
            <div className="rating-date-input" data-empty={!draft.endDate}>
              <input id="rating-end-date" className="input" type="date" name="endDate" value={draft.endDate} aria-invalid={Boolean(error)}
                aria-describedby={error ? 'rating-schedule-error' : undefined} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
              <span aria-hidden="true">End date</span>
            </div>
          </Field>
        </div>
        {error && <p className="small rating-schedule-error" id="rating-schedule-error" role="alert">{error}</p>}
      </div>
      <div className="row rating-schedule-actions">
        <button type="submit" className="btn primary" disabled={!changed || Boolean(error)}>Save schedule</button>
      </div>
    </form>
  )
}

const monthFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthLabel = (month) => month ? monthFormat.format(new Date(month + '-01T00:00:00Z')) : 'Undated ratings'

function OrgFitPanel({ cycle }) {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [month, setMonth] = useState('all')
  const [department, setDepartment] = useState('all')
  const [team, setTeam] = useState('all')
  const [submission, setSubmission] = useState('all')
  const [selected, setSelected] = useState(null)
  const history = ratingHistory(state, cycle.id)
  const months = [...new Set(history.map((entry) => entry.month))].sort().reverse()
  const ratings = month === 'all' ? history : history.filter((entry) => entry.month === month)
  const ratedPeople = new Set(ratings.map((entry) => entry.staffId))
  const teams = state.teams.filter((t) => department === 'all' || t.departmentId === department)
  const search = q.trim().toLowerCase()
  const people = state.staff.filter((s) => {
    const rated = ratedPeople.has(s.id)
    if (!rated && (month !== 'all' || s.active === false || !s.departmentId)) return false
    if (department !== 'all' && s.departmentId !== department) return false
    if (team !== 'all' && s.teamId !== team) return false
    if (month === 'all' && submission !== 'all' && rated !== (submission === 'submitted')) return false
    return [s.name, s.title].some((value) => value?.toLowerCase().includes(search))
  })
  return (
    <div className="card">
      <div className="card-head">
        <Users size={18} color="var(--blue-600)" /><h3>Organizational Fit scores · {cycle.name}</h3>
      </div>
      <div className="card-pad row wrap gap-12">
        <label className="filter-field">Rating month<select className="select" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All months</option>
          {months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
        </select></label>
        <label className="filter-field">Department<select className="select" value={department} onChange={(e) => { setDepartment(e.target.value); setTeam('all') }}>
          <option value="all">All departments</option>
          {state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select></label>
        <label className="filter-field">Team<select className="select" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="all">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label>
        {month === 'all' && <label className="filter-field">Rating submissions<select className="select" value={submission} onChange={(e) => setSubmission(e.target.value)}>
          <option value="all">Any status</option>
          <option value="submitted">Has submissions</option>
          <option value="missing">No submissions</option>
        </select></label>}
        <label className="filter-field">Search people<input type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} /></label>
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
      {!people.length && <p className="card-pad small muted">No people match these filters.</p>}
      {selected && <RatingResults employee={selected} month={month}
        ratings={ratings.filter((entry) => entry.staffId === selected.id)} staff={state.staff}
        onClose={() => setSelected(null)} />}
    </div>
  )
}


function RatingResults({ employee, month, ratings, staff, onClose }) {
  const [tab, setTab] = useState('details')
  const sections = new Map()
  const summaries = new Map()
  for (const entry of ratings) {
    const { category, section } = entry
    const key = JSON.stringify([entry.month, section, category.name, category.dimensions])
    if (!sections.has(key)) sections.set(key, [])
    sections.get(key).push(entry)
    const categoryKey = section === 'keeperSelf' ? 'keeperLead' : section.split(':')[0]
    if (!summaries.has(categoryKey)) summaries.set(categoryKey, { name: category.name, scores: [], criteria: new Map() })
    const summary = summaries.get(categoryKey)
    entry.ratings.forEach((stars, index) => {
      const [name] = category.dimensions[index]
      if (!summary.criteria.has(name)) summary.criteria.set(name, [])
      summary.criteria.get(name).push(stars)
      summary.scores.push(stars)
    })
  }
  const average = (scores) => (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(2)

  return (
    <Modal title="Rating results" sub={employee.name + ' · ' + (month === 'all' ? 'All months' : monthLabel(month))} size="rating-modal" onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'details', label: 'Details' }, { key: 'summary', label: 'Summary' }]} />
      {!ratings.length ? <p className="small muted">No individual ratings have been submitted for this person.</p> : tab === 'summary' ? (
        <div className="col gap-20 mt-12">
          {[...summaries].map(([key, { name, scores, criteria }]) => (
            <section key={key}>
              <div className="rating-dimension"><h3>{name}</h3><b>{average(scores)} / 5</b></div>
              {[...criteria].map(([criterion, values]) => (
                <div className="rating-dimension" key={criterion}><span>{criterion}</span><span>{average(values)} / 5</span></div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="col gap-20">
          {[...sections].sort(([, [a]], [, [b]]) => b.month.localeCompare(a.month)).map(([key, entries]) => {
            const { section, category, month: submittedMonth } = entries[0]
            return <section className="col gap-10" key={key}>
              {month === 'all' && <div className="small muted">{monthLabel(submittedMonth)}</div>}
              <h3>{category.name}{(section === 'keeperSelf' || section.endsWith(':self')) && ' self-assessment'}</h3>
              {entries.map(({ reviewerId: id, ratings }, index) => (
                <div key={id + ':' + index}>
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
          })}
        </div>
      )}
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
      <div className="rating-availability row wrap gap-12 small" aria-live="polite">
        <Badge tone={status === 'Open' ? 'green' : status === 'Scheduled' ? 'amber' : 'gray'} dot>{status}</Badge>
        {setup.startDate && <span>Start date {fmtDate(setup.startDate)}</span>}
        {setup.endDate && <span>End date {fmtDate(setup.endDate)}</span>}
      </div>
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
const formatRatingPoints = new Intl.NumberFormat('en', { maximumSignificantDigits: 8 }).format

function RatingForm({ cycle, setup, status, assignment, onClose }) {
  const { submitOrgFitRatings } = useStore()
  const { toast } = useFeedback()
  const { employee, section, name, row } = assignment
  const category = ratingSection(setup, section)
  const { dimensions } = category
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
      <div>
        {dimensions.map(([label], index) => (
          <div className="rating-dimension" key={index}>
            <div>
              <div className="semi">{label}</div>
            </div>
            <div>
              <div className="rating-stars rating-stars-labeled" role="radiogroup" aria-label={label}>
                {scale.map((word, position) => {
                  const value = position + 1
                  const points = formatRatingPoints(starPoints(criterionPoints(category, index), value))
                  return (
                    <label className="rating-star" key={word} title={word}>
                      <input type="radio" name={section + '-rating-' + index}
                        aria-label={value + ' of 5, ' + word + ', ' + points + ' points'}
                        checked={values[index] === value} disabled={readOnly}
                        onChange={() => setValues((current) => current.map((rating, i) => i === index ? value : rating))} />
                      <Star size={20} fill={value <= values[index] ? 'currentColor' : 'none'} aria-hidden="true" />
                      <span className="rating-star-word" aria-hidden="true">{word}</span>
                      <span className="rating-star-word" aria-hidden="true">{points} pts</span>
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

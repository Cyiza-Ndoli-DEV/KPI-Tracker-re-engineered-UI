export const keeper = [
  ['Growth', 'Leadership growth, reading, studies or certifications, and ability to train the team.'],
  ['Competency', 'Fulfills the expectations set for the role.'],
  ['Innovation', 'Brings original ideas to improve or create processes or products.'],
]

export const team = [
  ['Collaboration', 'Works with teammates to achieve team goals.'],
  ['Communication', 'Communicates promptly and appropriately through designated channels.'],
  ['Reliability & accountability', 'Takes responsibility and completes assignments on time.'],
  ['Flexibility & adaptability', 'Adapts to changes in strategy, products, pitches or schedules.'],
  ['Conflict resolution', 'Helps resolve disagreements within the team.'],
]

export const beliefs = [
  ['Self management', 'Manages emotions, behavior and time to stay productive and aligned with goals.'],
  ['Resource management', 'Uses resources efficiently while meeting the required standard.'],
  ['Humility', 'Recognizes personal limitations and values others.'],
  ['Problem solver', 'Identifies challenges and finds effective solutions.'],
  ['Team activities', 'Participates in team-building activities.'],
]


export const defaultRatingCategories = {
  keeperLead: { name: 'Keeper Test', dimensions: keeper, points: 15 },
  team: { name: 'Team Rating', dimensions: team, points: 5 },
  beliefs: { name: 'Company Beliefs', dimensions: beliefs, points: 20 },
}

export const defaultRatingSetup = { enabled: false, startDate: '', endDate: '', categories: defaultRatingCategories }

const ratingCalendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Kampala', dateStyle: 'short' })
export const ratingDate = () => ratingCalendar.format(new Date())

export function ratingStatus(setup, date = ratingDate()) {
  if (!setup.enabled) return 'Off'
  if (setup.startDate && date < setup.startDate) return 'Scheduled'
  if (setup.endDate && date > setup.endDate) return 'Closed'
  return 'Open'
}

export function ratingCategoryType(key, category) {
  return category.type ?? key
}

export function ratingSection(setup, section) {
  const key = section === 'keeperSelf' ? 'keeperLead' : section.split(':')[0]
  return setup.categories[key]
}

export function ratingHistory(state, cycleId) {
  if (state.orgFitRatingHistory?.[cycleId]) return state.orgFitRatingHistory[cycleId]
  const setup = state.orgFitSetup?.[cycleId] ?? defaultRatingSetup
  const snapshots = [
    ...(state.orgFitRatingArchive?.[cycleId] ?? []),
    { categories: setup.categories, submissions: state.orgFitSubmissions?.[cycleId] },
  ]
  return snapshots.flatMap(({ categories, submissions }) =>
    Object.entries(submissions ?? {}).flatMap(([staffId, sections]) =>
      Object.entries(sections).flatMap(([section, reviewers]) => {
        const category = ratingSection({ categories }, section)
        if (!category) return []
        return Object.entries(reviewers).map(([reviewerId, ratings]) =>
          ({ staffId, section, reviewerId, category, ratings, month: '' }))
      })))
}

function selfSection(key) {
  return key === 'keeperLead' ? 'keeperSelf' : key + ':self'
}

export function assignedRatingSections(setup, state, reviewer, employee) {
  const allowed = ratingAssignments(state, reviewer, employee)
  return Object.entries(setup.categories).flatMap(([key, category]) => {
    const type = ratingCategoryType(key, category)
    if (type === 'keeperLead' && allowed.includes('keeperSelf')) return [selfSection(key)]
    return allowed.includes(type) ? [key] : []
  })
}

export function criterionPoints(category, index) {
  return category.dimensions[index][2] ?? category.points / category.dimensions.length
}

export function starPoints(points, stars) {
  return points * stars / 5
}

export function changedRatingSections(previous, next) {
  return Object.entries(previous.categories).flatMap(([key, category]) => {
    const updated = next.categories[key]
    const type = ratingCategoryType(key, category)
    if (updated && type === ratingCategoryType(key, updated) &&
        JSON.stringify(category.dimensions.map(([name]) => name)) === JSON.stringify(updated.dimensions.map(([name]) => name))) return []
    return type === 'keeperLead' ? [key, selfSection(key)] : [key]
  })
}

function validDate(date) {
  if (date === '') return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(date + 'T00:00:00Z')
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function ratingSetupError(setup) {
  if (!validDate(setup.startDate) || !validDate(setup.endDate)) return 'Enter valid rating dates.'
  if (setup.startDate && setup.endDate && setup.startDate > setup.endDate) return 'The closing date must be on or after the opening date.'
  const entries = Object.entries(setup.categories)
  if (!entries.length && setup.enabled) return 'Add a category before enabling ratings.'
  for (const [key, category] of entries) {
    if (!Object.hasOwn(defaultRatingCategories, ratingCategoryType(key, category)) ||
        !Number.isInteger(category.points) || category.points < 1) return 'Choose a reviewer type and enter a positive whole number of points.'
    if (!category.name.trim() || !category.dimensions.length || category.dimensions.some(([name]) => !name.trim())) {
      return 'Give each category a name and at least one named criterion.'
    }
    if (category.dimensions.some((_, index) => {
      const points = criterionPoints(category, index)
      return !Number.isFinite(points) || points <= 0
    })) return 'Enter positive points for each criterion.'
  }
  return ''
}

export function ratingAssignments(state, reviewer, employee) {
  if (!reviewer?.departmentId || !employee?.departmentId || reviewer.active === false || employee.active === false) return []
  if (reviewer.id === employee.id) return ['keeperSelf', 'team']
  if (reviewer.departmentId !== employee.departmentId) return []

  const department = state.departments.find(({ id }) => id === employee.departmentId)
  const employeeTeam = state.teams.find(({ id }) => id === employee.teamId)
  const reviewerTeam = state.teams.find(({ id }) => id === reviewer.teamId)
  const sameGroup = employee.teamId
    ? reviewer.teamId === employee.teamId
    : !reviewer.teamId
  const ratesTeamLead = reviewerTeam?.leadId === employee.id
  const ratesHead = department?.headId === employee.id
  const departmentLead = department?.headId === reviewer.id
  const teamLead = employeeTeam?.leadId === reviewer.id
  const directReportOfHead = ratesHead && (!reviewer.teamId || reviewerTeam?.leadId === reviewer.id)

  const sections = []
  if (sameGroup || ratesTeamLead || ratesHead) sections.push('team')
  if (departmentLead || directReportOfHead) sections.push('keeperLead')
  if (teamLead || departmentLead || directReportOfHead) sections.push('beliefs')
  return sections
}

export function validRatings(setup, section, row) {
  const count = ratingSection(setup, section)?.dimensions.length
  return Array.isArray(row) && row.length === count &&
    Array.from(row).every((value) => Number.isInteger(value) && value >= 1 && value <= 5)
}

function sectionPoints(setup, section, rows) {
  const values = Object.values(rows || {})
  if (!values.length || !values.every((row) => validRatings(setup, section, row))) return null
  const category = ratingSection(setup, section)
  const weights = category.dimensions.map((_, index) => criterionPoints(category, index))
  const maxPerReviewer = weights.reduce((sum, points) => sum + points, 0)
  const total = values.reduce((sum, row) =>
    row.reduce((subtotal, stars, index) => subtotal + starPoints(weights[index], stars), sum), 0)
  return total / values.length / maxPerReviewer * category.points
}

export function fitPoints(setup, submissions, employeeId) {
  let earned = 0
  let maximum = 0
  for (const [key, category] of Object.entries(setup.categories)) {
    const type = ratingCategoryType(key, category)
    if (type === 'keeperLead' && !validRatings(setup, selfSection(key), submissions[selfSection(key)]?.[employeeId])) return null
    if (type === 'team' && !validRatings(setup, key, submissions[key]?.[employeeId])) return null
    const points = sectionPoints(setup, key, submissions[key])
    if (points === null) return null
    earned += points
    maximum += category.points
  }
  return maximum ? earned / maximum * 40 : null
}

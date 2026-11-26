export const keeperCriteria = [
  ['competency', 'Competency'],
  ['innovation', 'Innovation'],
  ['growth', 'Growth (Skills & Leadership)'],
]

export const keeperResponses = ['Yes', 'Maybe', 'No']
export const keeperQuestion = 'If I am leaving now, how hard would you fight for me to stay? Why?'
export const retentionKey = 'retention'

export function keeperItems(state) {
  return state.keeperTestFormItems ?? [...keeperCriteria, ...(state.keeperTestItems ?? []), [retentionKey, keeperQuestion]]
}

export function keeperReports(state, reviewerId) {
  if (!state.staff.some((person) => person.id === reviewerId && person.active !== false)) return []

  return state.staff.filter((person) => {
    if (person.id === reviewerId || person.active === false) return false
    const team = state.teams.find((item) => item.id === person.teamId)
    if (team?.leadId && team.leadId !== person.id) return team.leadId === reviewerId
    return state.departments.some((department) =>
      department.id === person.departmentId && department.headId === reviewerId)
  })
}

export function canSubmitKeeperTest(state, reviewerId) {
  return keeperReports(state, reviewerId).length > 0
}

export function validKeeperTest(items, answers, reasons) {
  return items.length > 0 && items.every(([key]) => keeperResponses.includes(answers?.[key]) &&
    typeof reasons?.[key] === 'string' && reasons[key].trim().length > 0)
}

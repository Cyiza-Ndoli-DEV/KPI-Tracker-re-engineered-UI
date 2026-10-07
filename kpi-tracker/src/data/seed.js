// Mock data for the prototype. Departments, teams and staff mimic what is synced from Pahappa HR.

const at = (date, time = '10:00') => new Date(`${date}T${time}:00`).toISOString()

export const ROLES = {
  admin: { label: 'Admin', userId: 's-joyce' },
  dept_head: { label: 'Department Head', userId: 's-grace' },
  team_lead: { label: 'Team Lead', userId: 's-brian' },
  employee: { label: 'Employee', userId: 's-sarah' },
  employee2: { label: 'Employee', userId: 's-ronald' },
}

/** Roles that see the employee experience (My KPIs, Rankings). */
export const isEmployeeRole = (role) => role === 'employee' || role === 'employee2'

export function createSeed() {
  const departments = [
    { id: 'd-sales', name: 'Sales', headId: 's-grace' },
    { id: 'd-cc', name: 'Customer Care', headId: 's-ruth' },
    { id: 'd-fin', name: 'Finance', headId: 's-samuel' },
    { id: 'd-it', name: 'IT', headId: 's-allan' },
  ]
  const teams = [
    { id: 't-a', name: 'Team A', departmentId: 'd-sales', leadId: 's-brian', description: 'Corporate clients' },
    { id: 't-b', name: 'Team B', departmentId: 'd-sales', leadId: 's-peter', description: 'SME & government' },
    { id: 't-c', name: 'Team C', departmentId: 'd-cc', leadId: 's-moses', description: 'Client support desk' },
  ]
  const P = (id, name, title, departmentId, teamId, joinedDate = '2023-03-01') => ({ id, name, title, departmentId, teamId, joinedDate, active: true })
  const staff = [
    P('s-joyce', 'Joyce Amongi', 'HR Manager (System Admin)', null, null, '2020-06-01'),
    P('s-grace', 'Grace Namutebi', 'Head of Sales', 'd-sales', null, '2020-01-15'),
    P('s-brian', 'Brian Okello', 'Sales Team Lead', 'd-sales', 't-a', '2021-04-01'),
    P('s-sarah', 'Sarah Nakato', 'Sales Executive', 'd-sales', 't-a', '2022-08-01'),
    P('s-daniel', 'Daniel Mugisha', 'Sales Executive', 'd-sales', 't-a', '2023-02-01'),
    P('s-joan', 'Joan Atim', 'Sales Executive', 'd-sales', 't-a', '2026-09-01'),
    P('s-peter', 'Peter Ssemakula', 'Sales Team Lead', 'd-sales', 't-b', '2021-07-01'),
    P('s-esther', 'Esther Akello', 'Account Manager', 'd-sales', 't-b', '2022-01-10'),
    P('s-ivan', 'Ivan Tumusiime', 'Account Manager', 'd-sales', 't-b', '2023-05-02'),
    P('s-mark', 'Mark Ochieng', 'Account Manager', 'd-sales', 't-b', '2026-09-15'),
    P('s-ruth', 'Ruth Nabirye', 'Head of Customer Care', 'd-cc', null, '2020-03-01'),
    P('s-moses', 'Moses Kato', 'Customer Care Lead', 'd-cc', 't-c', '2021-09-01'),
    P('s-aisha', 'Aisha Nansubuga', 'Support Agent', 'd-cc', 't-c', '2022-11-01'),
    P('s-patrick', 'Patrick Ouma', 'Support Agent', 'd-cc', 't-c', '2023-06-12'),
    P('s-hellen', 'Hellen Apio', 'Support Agent', 'd-cc', 't-c', '2026-09-20'),
    P('s-diana', 'Diana Achieng', 'Client Relations Officer', 'd-cc', null, '2022-02-14'),
    P('s-ronald', 'Ronald Kintu', 'Client Relations Officer', 'd-cc', 't-c', '2024-02-05'),
    P('s-samuel', 'Samuel Wasswa', 'Head of Finance', 'd-fin', null, '2020-02-01'),
    P('s-faith', 'Faith Nalwoga', 'Accountant', 'd-fin', null, '2022-05-03'),
    P('s-allan', 'Allan Byaruhanga', 'Head of IT', 'd-it', null, '2020-01-06'),
    P('s-kevin', 'Kevin Mutebi', 'Systems Engineer', 'd-it', null, '2021-10-11'),
    P('s-lydia', 'Lydia Kyomuhendo', 'Software Developer', 'd-it', null, '2023-01-09'),
  ]

  const thresholds = { needs: 50, meets: 70, exceeds: 90 }
  const cycles = [
    { id: 'c-2025', name: 'FY 2025 Review', startDate: '2025-01-01', endDate: '2025-12-31', status: 'ended', thresholds, createdAt: at('2024-12-10') },
    { id: 'c-2026', name: 'FY 2026 Review', startDate: '2026-01-01', endDate: '2026-12-31', status: 'active', thresholds, createdAt: at('2025-12-12'), activatedAt: at('2026-01-01', '08:00') },
  ]

  const goals = []
  const kpis = []
  const periods = []
  const allocations = []
  const updates = []
  const audit = []

  // tiny builders --------------------------------------------------------
  const alloc = (id, kpiId, periodId, parentId, level, unitId, percent, target, startDate, endDate, joinedDate) => {
    allocations.push({ id, kpiId, periodId, parentId, level, unitId, percent, target, startDate, endDate, joinedDate: joinedDate || startDate, createdAt: at(startDate, '08:00') })
    return id
  }
  let un = 0
  const upd = (allocationId, kpiId, periodId, by, date, value, extra = {}) => {
    const id = `u-${++un}`
    updates.push({ id, allocationId, kpiId, periodId, date, value, submittedAt: at(date, '16:30'), submittedBy: by, ...extra })
    return id
  }
  let an = 0
  const log = (a) => audit.push({ id: `au-${++an}`, ...a })

  // ===================== FY 2025 (ended) =====================
  goals.push({ id: 'g-rev25', cycleId: 'c-2025', name: 'Increase Revenue', description: 'Grow total revenue across all product lines.', type: 'sum', startDate: '2025-01-01', endDate: '2025-12-31', status: 'stopped', createdAt: at('2024-12-15'), startedAt: at('2025-01-02'), stoppedAt: at('2025-12-31', '18:00') })
  kpis.push({ id: 'k-rev25', goalId: 'g-rev25', name: 'Annual Revenue', description: 'Invoiced revenue (UGX)', type: 'sum', unit: 'UGX', startValue: 0, target: 800_000_000, weight: 100, startDate: '2025-01-01', endDate: '2025-12-31' })
  periods.push({ id: 'p-rev25', kpiId: 'k-rev25', index: 1, startDate: '2025-01-01', endDate: '2025-12-31', target: 800_000_000, status: 'closed', closedAt: '2025-12-31', closeReason: 'Cycle ended' })
  {
    const k = 'k-rev25'
    const p = 'p-rev25'
    const S = '2025-01-01'
    const E = '2025-12-31'
    alloc('a25-sales', k, p, null, 'department', 'd-sales', 70, 560_000_000, S, E)
    alloc('a25-ta', k, p, 'a25-sales', 'team', 't-a', 50, 280_000_000, S, E)
    alloc('a25-tb', k, p, 'a25-sales', 'team', 't-b', 50, 280_000_000, S, E)
    const people = [
      ['a25-brian', 'a25-ta', 's-brian', 100 / 3, 93_333_333, 98_000_000],
      ['a25-sarah', 'a25-ta', 's-sarah', 100 / 3, 93_333_333, 87_500_000],
      ['a25-daniel', 'a25-ta', 's-daniel', 100 / 3, 93_333_334, 71_000_000],
      ['a25-peter', 'a25-tb', 's-peter', 40, 112_000_000, 118_000_000],
      ['a25-esther', 'a25-tb', 's-esther', 30, 84_000_000, 80_200_000],
      ['a25-ivan', 'a25-tb', 's-ivan', 30, 84_000_000, 63_900_000],
    ]
    for (const [id, parent, sid, pct, tgt, final] of people) {
      alloc(id, k, p, parent, 'individual', sid, pct, tgt, S, E)
      // Sum KPI updates record what was achieved since the previous update
      const h1 = Math.round(final * 0.48)
      upd(id, k, p, sid, '2025-06-30', h1)
      upd(id, k, p, sid, '2025-12-20', final - h1)
    }
  }

  // ===================== FY 2026 (active) =====================
  const S = '2026-01-01'
  const E = '2026-12-31'

  let danielUpdate
  // ---- Goal 1: Increase Revenue (Sum) ----
  goals.push({ id: 'g-rev', cycleId: 'c-2026', name: 'Increase Revenue', description: 'Grow invoiced revenue to UGX 1 billion by the end of 2026.', type: 'sum', startDate: S, endDate: E, status: 'running', createdAt: at('2025-12-18'), startedAt: at('2026-01-02', '09:00') })
  kpis.push({ id: 'k-rev', goalId: 'g-rev', name: 'Annual Revenue', description: 'Total invoiced revenue from all clients.', type: 'sum', unit: 'UGX', startValue: 0, target: 1_000_000_000, weight: 70, startDate: S, endDate: E })
  periods.push({ id: 'p-rev-1', kpiId: 'k-rev', index: 1, startDate: S, endDate: E, target: 1_000_000_000, status: 'open' })
  {
    const k = 'k-rev'
    const p = 'p-rev-1'
    alloc('a-sales', k, p, null, 'department', 'd-sales', 60, 600_000_000, S, E)
    alloc('a-ta', k, p, 'a-sales', 'team', 't-a', 50, 300_000_000, S, E)
    alloc('a-tb', k, p, 'a-sales', 'team', 't-b', 50, 300_000_000, S, E)
    // Team A was re-split equally when Joan joined on 1 Sep (33.3% -> 25% each)
    alloc('a-brian', k, p, 'a-ta', 'individual', 's-brian', 25, 75_000_000, S, E)
    alloc('a-sarah', k, p, 'a-ta', 'individual', 's-sarah', 25, 75_000_000, S, E)
    alloc('a-daniel', k, p, 'a-ta', 'individual', 's-daniel', 25, 75_000_000, S, E)
    alloc('a-joan', k, p, 'a-ta', 'individual', 's-joan', 25, 75_000_000, '2026-09-01', E, '2026-09-01')
    alloc('a-peter', k, p, 'a-tb', 'individual', 's-peter', 40, 120_000_000, S, E)
    alloc('a-esther', k, p, 'a-tb', 'individual', 's-esther', 30, 90_000_000, S, E)
    alloc('a-ivan', k, p, 'a-tb', 'individual', 's-ivan', 30, 90_000_000, S, E)

    const series = {
      'a-brian': ['s-brian', [['2026-03-31', 18e6], ['2026-05-31', 34e6], ['2026-07-31', 49e6], ['2026-09-26', 62e6]]],
      'a-sarah': ['s-sarah', [['2026-04-15', 20e6], ['2026-06-30', 41e6], ['2026-09-20', 58e6]]],
      'a-daniel': ['s-daniel', [['2026-03-20', 12e6], ['2026-06-15', 30e6], ['2026-08-10', 49e6]]],
      'a-joan': ['s-joan', [['2026-09-18', 7e6], ['2026-09-25', 12e6]]],
      'a-peter': ['s-peter', [['2026-03-31', 25e6], ['2026-06-30', 52e6], ['2026-09-29', 70e6]]],
      'a-esther': ['s-esther', [['2026-05-10', 30e6], ['2026-08-31', 66e6]]],
      'a-ivan': ['s-ivan', [['2026-06-01', 20e6], ['2026-09-15', 41e6]]],
    }
    const ids = {}
    // series hold running totals; each update stores the amount achieved since the previous update
    for (const [aid, [sid, pts]] of Object.entries(series)) {
      let prev = 0
      for (const [d, total] of pts) {
        ids[`${aid}@${d}`] = upd(aid, k, p, sid, d, total - prev)
        prev = total
      }
    }

    // locked update + pending edit request (Daniel typed 49M instead of 54M)
    danielUpdate = ids['a-daniel@2026-08-10']

    log({ at: at('2026-01-02', '09:00'), who: 's-joyce', action: 'Goal started', goalId: 'g-rev', kpiId: 'k-rev', subject: 'Increase Revenue', oldValue: 'Ready', newValue: 'Running' })
    log({ at: at('2026-09-01', '09:20'), who: 's-grace', action: 'Member added (equal split)', goalId: 'g-rev', kpiId: 'k-rev', subject: 'Joan Atim → Team A', oldValue: 'Brian, Sarah, Daniel: 33.33% (UGX 100M) each', newValue: 'Brian, Sarah, Daniel, Joan: 25% (UGX 75M) each', note: 'Achievements kept; remaining targets reduced. Joan starts from 1 Sep 2026.' })
    for (const u of updates.filter((x) => x.kpiId === 'k-rev')) {
      log({ at: u.submittedAt, who: u.submittedBy, action: 'Result recorded', goalId: 'g-rev', kpiId: 'k-rev', allocationId: u.allocationId, subject: staff.find((s) => s.id === u.submittedBy)?.name, oldValue: '—', newValue: `+UGX ${(u.value / 1e6).toFixed(0)}M achieved (as of ${u.date})` })
    }
  }

  // second KPI on the same goal: the goal is 100%, Annual Revenue carries 70% of it and New clients 30%
  kpis.push({ id: 'k-cli', goalId: 'g-rev', name: 'New clients signed', description: 'New paying clients with a signed contract.', type: 'sum', unit: 'Clients', startValue: 0, target: 120, weight: 30, startDate: S, endDate: E })
  periods.push({ id: 'p-cli-1', kpiId: 'k-cli', index: 1, startDate: S, endDate: E, target: 120, status: 'open' })
  {
    const k = 'k-cli'
    const p = 'p-cli-1'
    alloc('ac-sales', k, p, null, 'department', 'd-sales', 100, 120, S, E)
    alloc('ac-ta', k, p, 'ac-sales', 'team', 't-a', 50, 60, S, E)
    alloc('ac-tb', k, p, 'ac-sales', 'team', 't-b', 50, 60, S, E)
    for (const [sid, t] of [['s-brian', 'ac-ta'], ['s-sarah', 'ac-ta'], ['s-daniel', 'ac-ta'], ['s-peter', 'ac-tb'], ['s-esther', 'ac-tb'], ['s-ivan', 'ac-tb']]) {
      alloc(`ac-${sid.slice(2)}`, k, p, t, 'individual', sid, 33.33, 20, S, E)
    }
    const signed = {
      's-brian': [['2026-04-30', 6], ['2026-07-31', 5], ['2026-09-26', 4]],
      's-sarah': [['2026-05-15', 7], ['2026-09-20', 6]],
      's-daniel': [['2026-06-15', 4], ['2026-08-10', 3]],
      's-peter': [['2026-04-30', 5], ['2026-09-29', 7]],
      's-esther': [['2026-06-30', 8], ['2026-08-31', 4]],
      's-ivan': [['2026-06-01', 3], ['2026-09-15', 5]],
    }
    for (const [sid, pts] of Object.entries(signed)) for (const [d, v] of pts) upd(`ac-${sid.slice(2)}`, k, p, sid, d, v)
  }

  // ---- Goal 2: Improve Customer Satisfaction (Average) ----
  goals.push({ id: 'g-csat', cycleId: 'c-2026', name: 'Improve Customer Satisfaction', description: 'Lift the average customer satisfaction score from 70% to 84%.', type: 'average', startDate: S, endDate: E, status: 'running', createdAt: at('2025-12-18'), startedAt: at('2026-01-02', '09:05') })
  kpis.push({ id: 'k-csat', goalId: 'g-csat', name: 'Satisfaction score', description: 'Average post-interaction survey score.', type: 'average', unit: '%', startValue: 70, target: 84, weight: 100, startDate: S, endDate: E })
  periods.push({ id: 'p-csat-1', kpiId: 'k-csat', index: 1, startDate: S, endDate: '2026-06-30', target: 84, status: 'closed', closedAt: '2026-06-30', closeReason: 'End of KPI period (H1)' })
  periods.push({ id: 'p-csat-2', kpiId: 'k-csat', index: 2, startDate: '2026-07-01', endDate: E, target: 84, status: 'open' })
  for (const [p, ps, pe, suffix] of [['p-csat-1', S, '2026-06-30', '1'], ['p-csat-2', '2026-07-01', E, '2']]) {
    const k = 'k-csat'
    alloc(`acs${suffix}-cc`, k, p, null, 'department', 'd-cc', null, 84, ps, pe)
    alloc(`acs${suffix}-tc`, k, p, `acs${suffix}-cc`, 'team', 't-c', null, 84, ps, pe)
    alloc(`acs${suffix}-moses`, k, p, `acs${suffix}-tc`, 'individual', 's-moses', null, 84, ps, pe)
    alloc(`acs${suffix}-aisha`, k, p, `acs${suffix}-tc`, 'individual', 's-aisha', null, 84, ps, pe)
    alloc(`acs${suffix}-patrick`, k, p, `acs${suffix}-tc`, 'individual', 's-patrick', null, 84, ps, pe)
    alloc(`acs${suffix}-diana`, k, p, `acs${suffix}-cc`, 'individual', 's-diana', null, 84, ps, pe)
  }
  upd('acs1-moses', 'k-csat', 'p-csat-1', 's-moses', '2026-03-28', 74)
  upd('acs1-moses', 'k-csat', 'p-csat-1', 's-moses', '2026-06-25', 78)
  upd('acs1-aisha', 'k-csat', 'p-csat-1', 's-aisha', '2026-06-20', 81)
  upd('acs1-patrick', 'k-csat', 'p-csat-1', 's-patrick', '2026-06-28', 74)
  upd('acs1-diana', 'k-csat', 'p-csat-1', 's-diana', '2026-06-26', 77)
  upd('acs2-moses', 'k-csat', 'p-csat-2', 's-moses', '2026-08-15', 79)
  upd('acs2-moses', 'k-csat', 'p-csat-2', 's-moses', '2026-09-28', 82)
  upd('acs2-aisha', 'k-csat', 'p-csat-2', 's-aisha', '2026-09-10', 83)
  upd('acs2-patrick', 'k-csat', 'p-csat-2', 's-patrick', '2026-09-12', 76)
  upd('acs2-diana', 'k-csat', 'p-csat-2', 's-diana', '2026-09-20', 80)
  log({ at: at('2026-07-01', '08:30'), who: 's-joyce', action: 'KPI restarted', goalId: 'g-csat', kpiId: 'k-csat', subject: 'Satisfaction score', oldValue: 'Period 1 (1 Jan – 30 Jun) closed', newValue: 'Period 2 (1 Jul – 31 Dec) opened with same setup', note: 'H1 results kept in history.' })

  // ---- Goal 3: Improve Employee Compliance (Completion) ----
  goals.push({ id: 'g-comp', cycleId: 'c-2026', name: 'Improve Employee Compliance', description: 'Every employee completes the mandatory compliance and data-protection training.', type: 'completion', startDate: S, endDate: E, status: 'running', createdAt: at('2025-12-18'), startedAt: at('2026-01-02', '09:10') })
  kpis.push({ id: 'k-comp', goalId: 'g-comp', name: 'Mandatory training', description: 'Data protection, anti-fraud and workplace safety modules.', type: 'completion', unit: '%', startValue: 0, target: 100, weight: 100, startDate: S, endDate: E })
  periods.push({ id: 'p-comp-1', kpiId: 'k-comp', index: 1, startDate: S, endDate: E, target: 100, status: 'open' })
  {
    const k = 'k-comp'
    const p = 'p-comp-1'
    alloc('acp-fin', k, p, null, 'department', 'd-fin', null, 100, S, E)
    alloc('acp-it', k, p, null, 'department', 'd-it', null, 100, S, E)
    alloc('acp-samuel', k, p, 'acp-fin', 'individual', 's-samuel', null, 100, S, E)
    alloc('acp-faith', k, p, 'acp-fin', 'individual', 's-faith', null, 100, S, E)
    alloc('acp-allan', k, p, 'acp-it', 'individual', 's-allan', null, 100, S, E)
    alloc('acp-kevin', k, p, 'acp-it', 'individual', 's-kevin', null, 100, S, E)
    alloc('acp-lydia', k, p, 'acp-it', 'individual', 's-lydia', null, 100, S, E)
    upd('acp-allan', k, p, 's-allan', '2026-06-30', 100, { completion: 'full' })
    upd('acp-samuel', k, p, 's-samuel', '2026-07-15', 100, { completion: 'full' })
    upd('acp-faith', k, p, 's-faith', '2026-08-20', 50, { completion: 'partial' })
    upd('acp-kevin', k, p, 's-kevin', '2026-09-05', 75, { completion: 'partial' })
    upd('acp-lydia', k, p, 's-lydia', '2026-09-18', 0, { completion: 'none', reason: 'Training portal access was delayed; session booked for October.' })
  }

  // ---- Goal 4: Improve Client Communication (Completion, two KPIs) ----
  // Org -> Customer Care -> Team C -> people (+ Diana directly under the department). Ronald has no result yet.
  goals.push({ id: 'g-cc', cycleId: 'c-2026', name: 'Improve Client Communication', description: 'Every client-facing person is trained and follows the same feedback follow-up procedure.', type: 'completion', startDate: S, endDate: E, status: 'running', createdAt: at('2025-12-18'), startedAt: at('2026-01-02', '09:15') })
  for (const [k, name, desc] of [
    ['k-cc1', 'Client communication training', 'Complete the client communication and etiquette course.'],
    ['k-cc2', 'Client feedback follow-up procedure', 'Apply the new procedure: every complaint answered within 48 hours and logged.'],
  ]) {
    const p = `p-${k}`
    kpis.push({ id: k, goalId: 'g-cc', name, description: desc, type: 'completion', unit: '%', startValue: 0, target: 100, weight: 50, startDate: S, endDate: E })
    periods.push({ id: p, kpiId: k, index: 1, startDate: S, endDate: E, target: 100, status: 'open' })
    alloc(`${k}-cc`, k, p, null, 'department', 'd-cc', null, 100, S, E)
    alloc(`${k}-tc`, k, p, `${k}-cc`, 'team', 't-c', null, 100, S, E)
    for (const sid of ['s-moses', 's-aisha', 's-patrick', 's-ronald']) alloc(`${k}-${sid.slice(2)}`, k, p, `${k}-tc`, 'individual', sid, null, 100, S, E)
    alloc(`${k}-diana`, k, p, `${k}-cc`, 'individual', 's-diana', null, 100, S, E)
  }
  upd('k-cc1-moses', 'k-cc1', 'p-k-cc1', 's-moses', '2026-08-20', 100, { completion: 'full' })
  upd('k-cc1-aisha', 'k-cc1', 'p-k-cc1', 's-aisha', '2026-09-10', 75, { completion: 'partial' })
  upd('k-cc1-patrick', 'k-cc1', 'p-k-cc1', 's-patrick', '2026-09-25', 25, { completion: 'partial' })
  upd('k-cc1-diana', 'k-cc1', 'p-k-cc1', 's-diana', '2026-09-02', 100, { completion: 'full' })
  upd('k-cc2-moses', 'k-cc2', 'p-k-cc2', 's-moses', '2026-09-15', 50, { completion: 'partial' })
  upd('k-cc2-diana', 'k-cc2', 'p-k-cc2', 's-diana', '2026-09-30', 0, { completion: 'none', reason: 'Procedure document not yet shared with the walk-in desk.' })
  log({ at: at('2026-01-02', '09:15'), who: 's-joyce', action: 'Goal started', goalId: 'g-cc', subject: 'Improve Client Communication', oldValue: 'Ready', newValue: 'Running' })

  const editRequests = [
    { id: 'er-1', updateId: danielUpdate, kpiId: 'k-rev', requestedBy: 's-daniel', reason: 'Typo: I achieved UGX 24M in that update, not 19M.', requestedAt: at('2026-09-22', '11:15'), status: 'pending' },
  ]

  // ---- A draft goal in the wizard, stopped at step 3 (Departments) ----
  const drafts = [
    {
      id: 'dr-seed',
      cycleId: 'c-2026',
      step: 2,
      createdBy: 's-joyce',
      savedAt: at('2026-09-30', '15:40'),
      goal: { name: 'Grow Digital Channels', description: 'Increase the share of clients served through online channels.', type: 'sum', startDate: '2026-10-01', endDate: E },
      kpis: [{ key: 'kd1', name: 'New online clients', description: '', type: 'sum', unit: 'Clients', startValue: 0, target: 400, weight: 100, startDate: '2026-10-01', endDate: E }],
      depts: { kd1: { method: 'percent', rows: [{ unitId: 'd-sales', percent: 50, startDate: '2026-10-01', endDate: E }] } },
      teams: {},
      people: {},
    },
  ]

  return {
    version: 9,
    settings: {
      orgName: 'Pahappa',
      editWindowDays: 30,
      partialPresets: [25, 50, 75],
      bands: [
        { key: 'exceeds', label: 'Exceeds expectations', min: 100, tone: 'green' },
        { key: 'meets', label: 'Meets expectations', min: 70, tone: 'blue' },
        { key: 'needs', label: 'Needs improvement', min: 50, tone: 'amber' },
        { key: 'below', label: 'Below expectations', min: 0, tone: 'red' },
      ],
      scoring: { kpiWeight: 70, orgFitWeight: 30 },
      staleDays: 30,
      pipBelow: 50,
    },
    // Organizational Fit score (0–100) per cycle and person — in production calculated from supervisor and peer ratings
    orgFit: {
      'c-2026': { 's-grace': 85, 's-brian': 80, 's-sarah': 78, 's-daniel': 70, 's-joan': 75, 's-peter': 72, 's-esther': 82, 's-ivan': 65, 's-ruth': 88, 's-moses': 84, 's-aisha': 90, 's-patrick': 68, 's-samuel': 86, 's-faith': 74, 's-allan': 83, 's-kevin': 77, 's-lydia': 60, 's-ronald': 76, 's-mark': 79, 's-hellen': 81, 's-diana': 80 },
    },
    role: 'admin',
    viewCycleId: 'c-2026',
    departments,
    teams,
    staff,
    cycles,
    goals,
    kpis,
    periods,
    allocations,
    updates,
    editRequests,
    audit,
    drafts,
  }
}

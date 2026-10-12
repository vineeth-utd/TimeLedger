// Shared fixtures for the weekly report check and eval scripts: realistic M1 facts built with the
// real deterministic builder from synthetic daily summaries. Imported after the "@/" loader is
// registered by the calling script. Synthetic data only.
const { buildWeeklyReportData } = await import('@/lib/analytics/reportMetrics.js')

const PERIODS = {
  report: { weekStartDate: '2026-10-05', weekEndDate: '2026-10-11' },
  prior: { weekStartDate: '2026-09-28', weekEndDate: '2026-10-04' },
}
const DAYS = {
  report: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'],
  prior: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
}

// sub: [subId, subName, mainId, mainName, reportMinutes, priorMinutes, activeDays(report), activeDays(prior)]
function summariesFor(subs) {
  const rows = []
  for (const [subId, name, mainId, mainName, reportMin, priorMin, reportDays = 5, priorDays = 5] of subs) {
    const subCategory = { name, mainCategoryId: mainId, mainCategory: { name: mainName } }
    for (const [week, total, days] of [['report', reportMin, reportDays], ['prior', priorMin, priorDays]]) {
      if (!total) continue
      const dates = DAYS[week].slice(0, days)
      const base = Math.floor(total / dates.length)
      dates.forEach((summaryDate, i) => {
        const totalMinutes = base + (i === 0 ? total - base * dates.length : 0)
        rows.push({ summaryDate, subCategoryId: subId, totalMinutes, totalActivities: 1 + (i % 2), subCategory })
      })
    }
  }
  return rows
}

const target = (mainId, mainName, weekStartDate, targetMinutes) => ({
  weekStartDate,
  mainCategoryId: mainId,
  targetMinutes,
  mainCategory: { name: mainName },
})
const both = (mainId, name, minutes, priorMinutes = minutes) => [
  target(mainId, name, PERIODS.report.weekStartDate, minutes),
  target(mainId, name, PERIODS.prior.weekStartDate, priorMinutes),
]
const facts = (subs, targets = []) =>
  buildWeeklyReportData({ summaries: summariesFor(subs), targets, periods: PERIODS, timezone: 'America/Phoenix' })

const typicalSubs = [
  [1, 'Coding', 10, 'Work', 1120, 980],
  [2, 'Meetings', 10, 'Work', 300, 360],
  [3, 'Code Review', 10, 'Work', 130, 90],
  [4, 'Gym', 20, 'Health', 215, 280],
  [5, 'Running', 20, 'Health', 60, 90],
  [6, 'Reading', 30, 'Learning', 150, 120],
  [7, 'System Design Course', 30, 'Learning', 240, 200],
  [8, 'Gaming', 40, 'Leisure', 180, 150],
  [9, 'Movies', 40, 'Leisure', 140, 100],
  [10, 'Chores', 50, 'Personal', 210, 230],
]

const typicalTargets = [...both(10, 'Work', 1500, 1500), ...both(20, 'Health', 360, 360), ...both(30, 'Learning', 420, 360)]

// Raw daily summaries/targets behind `typical`, for fake-database checks.
export const TYPICAL_RAW = { summaries: summariesFor(typicalSubs), targets: typicalTargets, periods: PERIODS }

export const FIXTURES = {
  typical: facts(typicalSubs, typicalTargets),
  noPriorWeek: facts(typicalSubs.map(([a, b, c, d, r]) => [a, b, c, d, r, 0, 5, 0]), both(10, 'Work', 1500)),
  workDropLeisureUp: facts(
    [
      [1, 'Coding', 10, 'Work', 420, 1300],
      [2, 'Meetings', 10, 'Work', 120, 350],
      [8, 'Gaming', 40, 'Leisure', 760, 200],
      [9, 'Movies', 40, 'Leisure', 380, 90],
      [4, 'Gym', 20, 'Health', 90, 240],
    ],
    both(10, 'Work', 1500)
  ),
  allTargetsMet: facts(
    [
      [1, 'Coding', 10, 'Work', 1500, 1400],
      [4, 'Gym', 20, 'Health', 360, 330],
      [6, 'Reading', 30, 'Learning', 420, 400],
    ],
    [...both(10, 'Work', 1500), ...both(20, 'Health', 360), ...both(30, 'Learning', 420)]
  ),
  sparse: facts(
    [
      [1, 'Coding', 10, 'Work', 150, 600, 2, 5],
      [4, 'Gym', 20, 'Health', 45, 120, 1, 3],
    ],
    both(10, 'Work', 1200)
  ),
  manyCategories: facts(
    Array.from({ length: 12 }, (_, m) =>
      Array.from({ length: 3 }, (_, s) => [
        100 + m * 3 + s,
        `Sub Category ${m + 1}.${s + 1}`,
        100 + m,
        `Main Category ${m + 1}`,
        60 + ((m * 37 + s * 19) % 180),
        50 + ((m * 29 + s * 23) % 200),
      ])
    ).flat(),
    Array.from({ length: 6 }, (_, m) => both(100 + m, `Main Category ${m + 1}`, 300, 300)).flat()
  ),
  emptyWeek: facts([[1, 'Coding', 10, 'Work', 0, 500]], both(10, 'Work', 1500)),
}

// A schema-valid model reply for the `typical` fixture, used by offline checks.
export const VALID_REPLY = {
  overview: 'You logged 2745 min this week, 145 min more than the prior week, with Work at 1550 min against a 1500 min target.',
  mainCategoryInsights: [
    {
      mainCategoryId: 10,
      headline: 'Work finished above target',
      observed: 'Work reached 1550 min against a 1500 min target (103%), up 120 min from the prior week.',
      targetCommentary: 'The target was exceeded by 50 min.',
      possibleExplanation: 'Extra coding time might reflect a deadline, though TimeLedger cannot tell.',
    },
    {
      mainCategoryId: 20,
      headline: 'Health fell below target',
      observed: 'Health was 275 min against a 360 min target, down 95 min from the prior week.',
      targetCommentary: null,
      possibleExplanation: null,
    },
  ],
  subCategoryInsights: [
    {
      subCategoryId: 4,
      headline: 'Gym time dropped',
      observed: 'Gym went from 280 min to 215 min, a change of -65 min.',
      possibleExplanation: null,
    },
  ],
  observations: [{ observed: 'Leisure rose from 250 min to 320 min while Health fell.', possibleExplanation: null }],
  recommendations: [
    {
      title: 'Protect two gym sessions',
      action: 'Block two 45 minute gym sessions early in the week before work fills the calendar.',
      rationale: 'Health ended 85 min short of its target and Gym fell by 65 min.',
      mainCategoryId: 20,
      subCategoryId: 4,
    },
  ],
  dataNotes: [],
}

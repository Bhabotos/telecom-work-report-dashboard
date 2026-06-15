export default function handler(req, res) {
  return res.status(200).json({
    rows: [],
    totals: {
      total_tasks: 0,
      total_count: 0,
      total_duct: 0,
      total_oh: 0,
      total_ug: 0
    },
    planners: [],
    projects: [],
    taskTypes: [],
    dailyTrend: [],
    managementSummary: "No monthly report data found.",
    topPlanner: null,
    topProject: null
  });
}
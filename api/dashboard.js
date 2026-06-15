export default function handler(req, res) {
  return res.status(200).json({
    totals: {
      total_tasks: 5,
      total_count: 125,
      total_duct: 850,
      total_oh: 42,
      total_ug: 83,
      active_projects: 3,
      planner_count: 4,
      today_reports: 2,
      monthly_reports: 5
    },
    dailyTrend: [
      { name: "2026-06-10", value: 20 },
      { name: "2026-06-11", value: 35 },
      { name: "2026-06-12", value: 30 },
      { name: "2026-06-13", value: 40 }
    ],
    monthlyTrend: [
      { name: "Jun", value: 125, duct: 850 }
    ],
    taskTypes: [
      { name: "SPR Feedback", value: 45 },
      { name: "Impact Analysis", value: 52 },
      { name: "Port Planning", value: 28 }
    ],
    fiber: [
      { name: "OH", value: 42 },
      { name: "UG", value: 83 }
    ],
    projects: [
      { name: "Backbone Planning", value: 60 },
      { name: "ISP T-Joint", value: 45 },
      { name: "OH to UG Shifting", value: 20 }
    ],
    planners: [
      { name: "Bhabotos", value: 55 },
      { name: "Ahsan", value: 30 },
      { name: "Sohel", value: 25 },
      { name: "Anik", value: 15 }
    ]
  });
}
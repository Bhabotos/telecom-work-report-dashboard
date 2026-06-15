export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password } = req.body || {};

  if (email === "admin@telecom.local" && password === "Admin@123") {
    return res.status(200).json({
      token: "demo-admin-token",
      user: {
        id: 1,
        name: "Admin",
        email: "admin@telecom.local",
        role: "admin",
        plannerId: null
      }
    });
  }

  return res.status(401).json({ message: "Invalid email or password" });
}
export default function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader("Content-Type", "application/json");

  if (path === "/api/meta" || path === "/meta") {
    return res.status(200).json({
      planners: [
        { id: 1, name: "Bhabotos" },
        { id: 2, name: "Ahsan" },
        { id: 3, name: "Sohel" },
        { id: 4, name: "Anik" }
      ],
      projects: [
        { id: 1, name: "Backbone Planning" },
        { id: 2, name: "ISP T-Joint" },
        { id: 3, name: "OH to UG Shifting" }
      ],
      taskTypes: [
        { id: 1, name: "SPR Feedback" },
        { id: 2, name: "Impact Analysis" },
        { id: 3, name: "Port Planning" },
        { id: 4, name: "Execution Follow-up" }
      ]
    });
  }

  if (path === "/api/dashboard" || path === "/dashboard") {
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

  if (path.startsWith("/api/reports/daily") || path.startsWith("/reports/daily")) {
    return res.status(200).json({
      rows: [],
      taskTypes: [],
      planners: []
    });
  }

  if (path.startsWith("/api/reports/monthly") || path.startsWith("/reports/monthly")) {
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

  if (path.startsWith("/api/reports") || path.startsWith("/reports")) {
    return res.status(200).json({
      rows: [],
      pagination: {
        total: 0,
        pages: 1
      }
    });
  }

  return res.status(404).json({
    message: `API route not found: ${path}`
  });
}
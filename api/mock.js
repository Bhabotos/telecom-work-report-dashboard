function json(res, data, status = 200) {
  res.setHeader("Content-Type", "application/json");
  return res.status(status).json(data);
}

const meta = {
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
};

const dashboard = {
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
};

export default function handler(req, res) {
  try {
    const url = new URL(req.url, "https://example.com");
    const route = url.searchParams.get("route");

    if (route === "meta") {
      return json(res, meta);
    }

    if (route === "dashboard") {
      return json(res, dashboard);
    }

    if (route === "reports-daily") {
      return json(res, {
        rows: [],
        taskTypes: [],
        planners: []
      });
    }

    if (route === "reports-monthly") {
      return json(res, {
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

    if (route === "reports") {
      if (req.method === "POST") {
        return json(res, {
          message: "Report submitted successfully"
        });
      }

      return json(res, {
        rows: [],
        pagination: {
          total: 0,
          pages: 1
        }
      });
    }

    if (route === "users") {
      if (req.method === "POST") {
        return json(res, {
          message: "User created successfully"
        });
      }

      return json(res, []);
    }

    if (route === "master") {
      return json(res, {
        message: "Master data saved successfully"
      });
    }

    if (route === "export") {
      return json(res, {
        message: "Export API is not connected yet"
      }, 501);
    }

    return json(res, {
      message: "API route not found",
      route
    }, 404);
  } catch (error) {
    return json(res, {
      message: "API crashed",
      error: error.message
    }, 500);
  }
}
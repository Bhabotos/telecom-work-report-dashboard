export default function handler(req, res) {
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
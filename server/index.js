import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { initializeDatabase, all, get, run, transaction } from "./db.js";
import { authenticate, allowRoles, signToken } from "./auth.js";
import { buildFilters, normalizeReport, reportSelect } from "./reporting.js";

dotenv.config();
initializeDatabase();

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const audit = (userId, action, entityType, entityId, details = {}) =>
  run(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (:user_id, :action, :entity_type, :entity_id, :details)`,
    { user_id: userId, action, entity_type: entityType, entity_id: entityId, details: JSON.stringify(details) }
  );

app.get("/api/health", (_req, res) => res.json({ status: "ok", date: new Date().toISOString() }));

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = get("SELECT * FROM users WHERE email = :email", { email });
  if (!user || !user.active || !bcrypt.compareSync(String(req.body.password || ""), user.password_hash)) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  audit(user.id, "login", "user", user.id);
  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role, plannerId: user.planner_id }
  });
});

app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: req.user }));

app.get("/api/meta", authenticate, (req, res) => {
  res.json({
    planners: all("SELECT id, name, employee_id FROM planners WHERE active = 1 ORDER BY name"),
    projects: all("SELECT id, name FROM projects WHERE active = 1 ORDER BY name"),
    taskTypes: all("SELECT id, name FROM task_types WHERE active = 1 ORDER BY name")
  });
});

const masterConfig = {
  planners: { table: "planners", fields: ["name", "employee_id"] },
  projects: { table: "projects", fields: ["name"] },
  "task-types": { table: "task_types", fields: ["name"] }
};

app.get("/api/master/:type", authenticate, (req, res) => {
  const config = masterConfig[req.params.type];
  if (!config) return res.status(404).json({ message: "Unknown master type" });
  res.json(all(`SELECT * FROM ${config.table} ORDER BY name`));
});

app.post("/api/master/:type", authenticate, allowRoles("admin"), (req, res) => {
  const config = masterConfig[req.params.type];
  if (!config) return res.status(404).json({ message: "Unknown master type" });
  const data = Object.fromEntries(config.fields.map((field) => [field, String(req.body[field] || "").trim()]));
  if (!data.name) return res.status(400).json({ message: "Name is required" });
  const columns = config.fields.join(", ");
  const values = config.fields.map((field) => `:${field}`).join(", ");
  const result = run(`INSERT INTO ${config.table} (${columns}) VALUES (${values})`, data);
  audit(req.user.id, "create", config.table, Number(result.lastInsertRowid), data);
  res.status(201).json(get(`SELECT * FROM ${config.table} WHERE id = :id`, { id: Number(result.lastInsertRowid) }));
});

app.put("/api/master/:type/:id", authenticate, allowRoles("admin"), (req, res) => {
  const config = masterConfig[req.params.type];
  if (!config) return res.status(404).json({ message: "Unknown master type" });
  const data = Object.fromEntries(config.fields.map((field) => [field, String(req.body[field] || "").trim()]));
  data.id = Number(req.params.id);
  data.active = req.body.active === false || req.body.active === 0 ? 0 : 1;
  const assignments = config.fields.map((field) => `${field} = :${field}`).join(", ");
  run(`UPDATE ${config.table} SET ${assignments}, active = :active WHERE id = :id`, data);
  audit(req.user.id, "update", config.table, data.id, data);
  res.json(get(`SELECT * FROM ${config.table} WHERE id = :id`, { id: data.id }));
});

app.get("/api/users", authenticate, allowRoles("admin"), (_req, res) => {
  res.json(all(`
    SELECT u.id, u.name, u.email, u.role, u.planner_id, u.active, u.created_at, p.name AS planner_name
    FROM users u LEFT JOIN planners p ON p.id = u.planner_id ORDER BY u.name
  `));
});

app.post("/api/users", authenticate, allowRoles("admin"), (req, res) => {
  const data = {
    name: String(req.body.name || "").trim(),
    email: String(req.body.email || "").trim().toLowerCase(),
    password_hash: bcrypt.hashSync(String(req.body.password || ""), 12),
    role: req.body.role,
    planner_id: req.body.planner_id ? Number(req.body.planner_id) : null
  };
  if (!data.name || !data.email || String(req.body.password || "").length < 8) {
    return res.status(400).json({ message: "Name, email, and an 8-character password are required" });
  }
  if (!["admin", "manager", "planner"].includes(data.role)) return res.status(400).json({ message: "Invalid role" });
  if (data.role === "planner" && !data.planner_id) return res.status(400).json({ message: "Planner profile is required" });
  const result = run(
    `INSERT INTO users (name, email, password_hash, role, planner_id)
     VALUES (:name, :email, :password_hash, :role, :planner_id)`,
    data
  );
  audit(req.user.id, "create", "user", Number(result.lastInsertRowid), { email: data.email, role: data.role });
  res.status(201).json({ id: Number(result.lastInsertRowid), name: data.name, email: data.email, role: data.role });
});

app.put("/api/users/:id", authenticate, allowRoles("admin"), (req, res) => {
  const id = Number(req.params.id);
  const current = get("SELECT * FROM users WHERE id = :id", { id });
  if (!current) return res.status(404).json({ message: "User not found" });
  const data = {
    id,
    name: String(req.body.name || current.name).trim(),
    email: String(req.body.email || current.email).trim().toLowerCase(),
    role: req.body.role || current.role,
    planner_id: req.body.planner_id ? Number(req.body.planner_id) : null,
    active: req.body.active === false || req.body.active === 0 ? 0 : 1
  };
  run(
    `UPDATE users SET name=:name, email=:email, role=:role, planner_id=:planner_id,
     active=:active, updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
    data
  );
  if (req.body.password) {
    if (String(req.body.password).length < 8) return res.status(400).json({ message: "Password must be 8 characters" });
    run("UPDATE users SET password_hash=:hash WHERE id=:id", { id, hash: bcrypt.hashSync(req.body.password, 12) });
  }
  audit(req.user.id, "update", "user", id, { email: data.email, role: data.role, active: data.active });
  res.json({ message: "User updated" });
});

app.delete("/api/users/:id", authenticate, allowRoles("admin"), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ message: "You cannot deactivate your own account" });
  run("UPDATE users SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=:id", { id });
  audit(req.user.id, "deactivate", "user", id);
  res.json({ message: "User deactivated" });
});

app.get("/api/reports", authenticate, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 20));
  const { where, params } = buildFilters(req.query, req.user);
  const search = String(req.query.search || "").trim();
  const searchClause = search
    ? `${where ? " AND" : " WHERE"} (p.name LIKE :search OR pr.name LIKE :search OR t.name LIKE :search OR r.remarks LIKE :search)`
    : "";
  if (search) params.search = `%${search}%`;
  const sortMap = {
    date: "r.report_date", planner: "p.name", project: "pr.name", task: "t.name",
    count: "r.work_count", created: "r.created_at"
  };
  const sort = sortMap[req.query.sort] || "r.report_date";
  const direction = req.query.direction === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;
  const rows = all(`${reportSelect}${where}${searchClause} ORDER BY ${sort} ${direction}, r.id DESC LIMIT :limit OFFSET :offset`, {
    ...params, limit, offset
  });
  const total = get(`
    SELECT COUNT(*) AS total FROM daily_reports r
    JOIN planners p ON p.id=r.planner_id JOIN projects pr ON pr.id=r.project_id
    JOIN task_types t ON t.id=r.task_type_id ${where}${searchClause}
  `, params).total;
  res.json({ rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

app.get("/api/reports/:id", authenticate, (req, res) => {
  const { where, params } = buildFilters({}, req.user);
  const row = get(`${reportSelect}${where}${where ? " AND" : " WHERE"} r.id = :id`, { ...params, id: Number(req.params.id) });
  if (!row) return res.status(404).json({ message: "Report not found" });
  res.json(row);
});

app.post("/api/reports", authenticate, (req, res) => {
  const data = normalizeReport(req.body);
  if (req.user.role === "planner") data.planner_id = req.user.planner_id;
  if (!data.planner_id) return res.status(400).json({ message: "Your account is not linked to a planner" });
  data.created_by = req.user.id;
  const fields = Object.keys(data);
  const result = run(
    `INSERT INTO daily_reports (${fields.join(", ")}) VALUES (${fields.map((field) => `:${field}`).join(", ")})`,
    data
  );
  const id = Number(result.lastInsertRowid);
  audit(req.user.id, "create", "daily_report", id);
  res.status(201).json({ id, message: "Daily report submitted successfully" });
});

app.put("/api/reports/:id", authenticate, (req, res) => {
  const id = Number(req.params.id);
  const current = get("SELECT * FROM daily_reports WHERE id=:id", { id });
  if (!current) return res.status(404).json({ message: "Report not found" });
  if (req.user.role === "planner" && current.planner_id !== req.user.planner_id) {
    return res.status(403).json({ message: "You can edit only your own reports" });
  }
  const data = normalizeReport(req.body);
  if (req.user.role === "planner") data.planner_id = req.user.planner_id;
  data.id = id;
  const assignments = Object.keys(data).filter((key) => key !== "id").map((key) => `${key}=:${key}`).join(", ");
  run(`UPDATE daily_reports SET ${assignments}, status='submitted', updated_at=CURRENT_TIMESTAMP WHERE id=:id`, data);
  audit(req.user.id, "update", "daily_report", id);
  res.json({ message: "Report updated successfully" });
});

app.delete("/api/reports/:id", authenticate, allowRoles("admin"), (req, res) => {
  const id = Number(req.params.id);
  run("DELETE FROM daily_reports WHERE id=:id", { id });
  audit(req.user.id, "delete", "daily_report", id);
  res.json({ message: "Report deleted" });
});

app.post("/api/reports/:id/review", authenticate, allowRoles("admin", "manager"), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  const comment = String(req.body.comment || "").trim();
  if (!["approved", "changes_requested", "submitted"].includes(status)) {
    return res.status(400).json({ message: "Invalid review status" });
  }
  run(
    `UPDATE daily_reports SET status=:status, manager_comment=:comment, approved_by=:approved_by,
     approved_at=CASE WHEN :status='approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
     updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
    { id, status, comment, approved_by: req.user.id }
  );
  if (comment) run("INSERT INTO report_remarks (report_id,user_id,comment) VALUES (:id,:user_id,:comment)", {
    id, user_id: req.user.id, comment
  });
  audit(req.user.id, "review", "daily_report", id, { status, comment });
  res.json({ message: "Review saved" });
});

function summaryPayload(query, user) {
  const { where, params } = buildFilters(query, user);
  const totals = get(`
    SELECT COUNT(*) AS total_tasks, COALESCE(SUM(work_count),0) AS total_count,
      COALESCE(SUM(duct_length_meter),0) AS total_duct,
      COALESCE(SUM(four_f_oh+six_f_oh+twelve_f_oh+twentyfour_f_oh+fortyeight_f_oh),0) AS total_oh,
      COALESCE(SUM(twentyfour_f_ug+fortyeight_f_ug+ninetysix_f_ug+onefortyfour_f+twosixteen_f_ug),0) AS total_ug,
      COUNT(DISTINCT project_id) AS active_projects, COUNT(DISTINCT planner_id) AS planner_count,
      SUM(CASE WHEN report_date=date('now','localtime') THEN 1 ELSE 0 END) AS today_reports,
      SUM(CASE WHEN month=strftime('%Y-%m','now','localtime') THEN 1 ELSE 0 END) AS monthly_reports
    FROM daily_reports r ${where}
  `, params);
  const group = (column, join, name, limit = 50) => all(`
    SELECT ${name} AS name, COUNT(*) AS reports, COALESCE(SUM(r.work_count),0) AS value,
      COALESCE(SUM(r.duct_length_meter),0) AS duct
    FROM daily_reports r ${join} ${where}
    GROUP BY ${column} ORDER BY value DESC LIMIT ${limit}
  `, params);
  const dailyTrend = all(`
    SELECT r.report_date AS name, SUM(r.work_count) AS value, COUNT(*) AS reports
    FROM daily_reports r ${where} GROUP BY r.report_date ORDER BY r.report_date
  `, params);
  const monthlyTrend = all(`
    SELECT r.month AS name, SUM(r.work_count) AS value, SUM(r.duct_length_meter) AS duct, COUNT(*) AS reports
    FROM daily_reports r ${where} GROUP BY r.month ORDER BY r.month
  `, params);
  return {
    totals,
    dailyTrend,
    monthlyTrend,
    planners: group("r.planner_id", "JOIN planners p ON p.id=r.planner_id", "p.name"),
    projects: group("r.project_id", "JOIN projects p ON p.id=r.project_id", "p.name"),
    taskTypes: group("r.task_type_id", "JOIN task_types t ON t.id=r.task_type_id", "t.name"),
    fiber: [{ name: "OH", value: totals.total_oh }, { name: "UG", value: totals.total_ug }]
  };
}

app.get("/api/dashboard", authenticate, (req, res) => res.json(summaryPayload(req.query, req.user)));

app.get("/api/reports/daily/:date", authenticate, (req, res) => {
  const query = { ...req.query, date_from: req.params.date, date_to: req.params.date };
  const { where, params } = buildFilters(query, req.user);
  res.json({ date: req.params.date, ...summaryPayload(query, req.user), rows: all(`${reportSelect}${where} ORDER BY p.name, pr.name`, params) });
});

app.get("/api/reports/monthly/:month", authenticate, (req, res) => {
  const query = { ...req.query, month: req.params.month };
  const { where, params } = buildFilters(query, req.user);
  const payload = summaryPayload(query, req.user);
  const topPlanner = payload.planners[0] || null;
  const topProject = payload.projects[0] || null;
  res.json({
    month: req.params.month,
    ...payload,
    topPlanner,
    topProject,
    managementSummary: `${payload.totals.total_tasks} reports recorded ${payload.totals.total_count} work units and ${payload.totals.total_duct} meters of duct work.`,
    rows: all(`${reportSelect}${where} ORDER BY r.report_date, p.name`, params)
  });
});

function exportRows(query, user) {
  const { where, params } = buildFilters(query, user);
  return all(`${reportSelect}${where} ORDER BY r.report_date, p.name`, params);
}

const excelColumns = [
  ["Date", "report_date"], ["Month", "month"], ["Planner Name", "planner_name"],
  ["Project Name", "project_name"], ["Task Type", "task_type"], ["Count", "work_count"],
  ["Remarks", "remarks"], ["4F OH", "four_f_oh"], ["Duct Length meter", "duct_length_meter"],
  ["6F OH", "six_f_oh"], ["12F OH", "twelve_f_oh"], ["24F OH", "twentyfour_f_oh"],
  ["48F OH", "fortyeight_f_oh"], ["24F UG", "twentyfour_f_ug"], ["48F UG", "fortyeight_f_ug"],
  ["96F UG", "ninetysix_f_ug"], ["144F", "onefortyfour_f"], ["216F UG", "twosixteen_f_ug"],
  ["Total OH", "total_oh"], ["Total UG", "total_ug"], ["Status", "status"],
  ["Created By", "created_by_name"], ["Created Time", "created_at"], ["Updated Time", "updated_at"]
];

app.get("/api/export/daily-excel", authenticate, asyncRoute(async (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!date || date.length > 20) return res.status(400).json({ message: "A valid report date is required" });
  const rows = exportRows({ date_from: date, date_to: date }, req.user);
  const taskTotals = new Map();
  const plannerTotals = new Map();
  rows.forEach((row) => {
    taskTotals.set(row.task_type, (taskTotals.get(row.task_type) || 0) + row.work_count);
    plannerTotals.set(row.planner_name, (plannerTotals.get(row.planner_name) || 0) + row.work_count);
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Daily Work Report", { views: [{ state: "frozen", ySplit: 3 }] });
  worksheet.mergeCells("A1:I1");
  worksheet.getCell("A1").value = "Daily work Report";
  worksheet.getCell("A1").font = { bold: true, size: 14 };
  worksheet.getCell("A2").value = "select date";
  worksheet.getCell("B2").value = date;
  const headers = ["Date", "Month", "Year", "Month Key", "Planner Name", "Project Name", "Task Type", "Count", "Remarks"];
  worksheet.getRow(3).values = headers;
  const monthKey = rows[0]?.month || (/^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "");
  const [monthYear, monthNumber] = monthKey.split("-").map(Number);
  const monthName = monthNumber
    ? new Date(monthYear, monthNumber - 1, 1).toLocaleString("en-US", { month: "long" })
    : "";
  rows.forEach((row) => worksheet.addRow([
    row.report_date, monthName, monthYear || "", row.month, row.planner_name,
    row.project_name, row.task_type, row.work_count, row.remarks
  ]));

  const summaryStart = Math.max(17, worksheet.rowCount + 3);
  worksheet.getCell(`A${summaryStart}`).value = "Task Type";
  worksheet.getCell(`B${summaryStart}`).value = "Work Quantity";
  [...taskTotals.entries()].forEach(([name, value], index) => {
    worksheet.getCell(`A${summaryStart + index + 1}`).value = name;
    worksheet.getCell(`B${summaryStart + index + 1}`).value = value;
  });
  worksheet.getCell(`D${summaryStart}`).value = "Planner";
  worksheet.getCell(`E${summaryStart}`).value = "Work Quantity";
  [...plannerTotals.entries()].forEach(([name, value], index) => {
    worksheet.getCell(`D${summaryStart + index + 1}`).value = name;
    worksheet.getCell(`E${summaryStart + index + 1}`).value = value;
  });

  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF78A9B5" } };
  [worksheet.getRow(3), worksheet.getRow(summaryStart)].forEach((row) => row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = headerFill;
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  }));
  worksheet.columns = [
    { width: 14 }, { width: 12 }, { width: 10 }, { width: 13 }, { width: 22 },
    { width: 34 }, { width: 28 }, { width: 11 }, { width: 55 }
  ];
  worksheet.autoFilter = { from: "A3", to: "I3" };
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="daily-work-report-${date}.xlsx"`);
  res.send(buffer);
}));

app.get("/api/export/excel", authenticate, asyncRoute(async (req, res) => {
  const rows = exportRows(req.query, req.user).map((row) =>
    Object.fromEntries(excelColumns.map(([label, key]) => [label, row[key]]))
  );
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Daily Reports", { views: [{ state: "frozen", ySplit: 1 }] });
  worksheet.columns = excelColumns.map(([header]) => ({ header, key: header, width: Math.max(14, header.length + 2) }));
  worksheet.addRows(rows);
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123B6D" } };
  });
  worksheet.autoFilter = { from: "A1", to: `${worksheet.getColumn(excelColumns.length).letter}1` };
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="telecom-work-report-${Date.now()}.xlsx"`);
  res.send(buffer);
}));

app.get("/api/export/pdf", authenticate, (req, res) => {
  const rows = exportRows(req.query, req.user);
  const summary = summaryPayload(req.query, req.user);
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="telecom-work-report-${Date.now()}.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).fillColor("#123b6d").text("Telecom Infrastructure Work Report");
  doc.moveDown(0.4).fontSize(10).fillColor("#333").text(
    `Reports: ${summary.totals.total_tasks}   Count: ${summary.totals.total_count}   Duct: ${summary.totals.total_duct} m   OH: ${summary.totals.total_oh}   UG: ${summary.totals.total_ug}`
  );
  doc.moveDown();
  rows.slice(0, 150).forEach((row, index) => {
    if (doc.y > 540) doc.addPage();
    doc.fontSize(8).fillColor(index % 2 ? "#333" : "#123b6d").text(
      `${row.report_date} | ${row.planner_name} | ${row.project_name} | ${row.task_type} | Count ${row.work_count} | Duct ${row.duct_length_meter}m`,
      { continued: false }
    );
  });
  if (rows.length > 150) doc.moveDown().text(`PDF table limited to 150 of ${rows.length} rows. Use Excel for the full dataset.`);
  doc.end();
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.use((error, _req, res, _next) => {
  console.error(error);
  const message = error.code?.startsWith("SQLITE_CONSTRAINT") ? "This value already exists or is referenced by other records" : error.message;
  res.status(error.status || 400).json({ message: message || "Unexpected server error" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Telecom reporting API listening on http://localhost:${port}`));

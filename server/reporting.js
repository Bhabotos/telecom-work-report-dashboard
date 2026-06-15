export const numericFields = [
  "work_count", "four_f_oh", "duct_length_meter", "six_f_oh", "twelve_f_oh",
  "twentyfour_f_oh", "fortyeight_f_oh", "twentyfour_f_ug", "fortyeight_f_ug",
  "ninetysix_f_ug", "onefortyfour_f", "twosixteen_f_ug"
];

export const reportSelect = `
  SELECT r.*, p.name AS planner_name, pr.name AS project_name, t.name AS task_type,
    u.name AS created_by_name,
    (r.four_f_oh + r.six_f_oh + r.twelve_f_oh + r.twentyfour_f_oh + r.fortyeight_f_oh) AS total_oh,
    (r.twentyfour_f_ug + r.fortyeight_f_ug + r.ninetysix_f_ug + r.onefortyfour_f + r.twosixteen_f_ug) AS total_ug
  FROM daily_reports r
  JOIN planners p ON p.id = r.planner_id
  JOIN projects pr ON pr.id = r.project_id
  JOIN task_types t ON t.id = r.task_type_id
  JOIN users u ON u.id = r.created_by
`;

export function monthFromDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw new Error("Date must use YYYY-MM-DD");
  return value.slice(0, 7);
}

export function normalizeReport(body) {
  const data = {
    report_date: body.report_date,
    month: monthFromDate(body.report_date),
    planner_id: Number(body.planner_id),
    project_id: Number(body.project_id),
    task_type_id: Number(body.task_type_id),
    remarks: String(body.remarks || "").trim()
  };
  for (const field of numericFields) {
    const value = Number(body[field] || 0);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a non-negative number`);
    data[field] = value;
  }
  if (!data.planner_id || !data.project_id || !data.task_type_id) {
    throw new Error("Planner, project, and task type are required");
  }
  return data;
}

export function buildFilters(query, user, alias = "r") {
  const clauses = [];
  const params = {};
  const add = (condition, key, value) => {
    if (value !== undefined && value !== "") {
      clauses.push(condition);
      params[key] = value;
    }
  };
  add(`${alias}.report_date >= :date_from`, "date_from", query.date_from);
  add(`${alias}.report_date <= :date_to`, "date_to", query.date_to);
  add(`${alias}.month = :month`, "month", query.month);
  add(`${alias}.planner_id = :planner_id`, "planner_id", query.planner_id ? Number(query.planner_id) : undefined);
  add(`${alias}.project_id = :project_id`, "project_id", query.project_id ? Number(query.project_id) : undefined);
  add(`${alias}.task_type_id = :task_type_id`, "task_type_id", query.task_type_id ? Number(query.task_type_id) : undefined);
  if (query.category === "oh") clauses.push(`(${alias}.four_f_oh + ${alias}.six_f_oh + ${alias}.twelve_f_oh + ${alias}.twentyfour_f_oh + ${alias}.fortyeight_f_oh) > 0`);
  if (query.category === "ug") clauses.push(`(${alias}.twentyfour_f_ug + ${alias}.fortyeight_f_ug + ${alias}.ninetysix_f_ug + ${alias}.onefortyfour_f + ${alias}.twosixteen_f_ug) > 0`);
  if (user.role === "planner") {
    clauses.push(`${alias}.planner_id = :owned_planner_id`);
    params.owned_planner_id = user.planner_id || -1;
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
}

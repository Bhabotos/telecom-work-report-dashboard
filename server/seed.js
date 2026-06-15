import path from "node:path";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { initializeDatabase, get, run, transaction } from "./db.js";

initializeDatabase();

const clean = (value) => String(value || "").trim();
const source = path.resolve("./sample-data/source-report.xlsx");
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(source);
const sheet = workbook.getWorksheet("Daily Task Tracker") || workbook.worksheets[0];
const headerRow = sheet.getRow(2);
const headers = [];
headerRow.eachCell({ includeEmpty: true }, (cell, column) => {
  headers[column] = clean(cell.text);
});
const rows = [];
sheet.eachRow((row, rowNumber) => {
  if (rowNumber <= 2) return;
  const record = {};
  headers.forEach((header, column) => {
    if (header) record[header] = row.getCell(column).value ?? "";
  });
  rows.push(record);
});

const number = (value) => Number(value) || 0;
const isoDate = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = clean(value);
  const parts = text.split(/[-/]/).map(Number);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const yearFirst = a > 1900;
    const year = yearFirst ? a : c < 100 ? 2000 + c : c;
    const month = b;
    const day = yearFirst ? c : a;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return "";
};
const findHeader = (row, candidates) => {
  const entry = Object.entries(row).find(([key]) => candidates.some((candidate) => clean(key).toLowerCase() === candidate));
  return entry?.[1] ?? "";
};
const ensure = (table, name) => {
  const existing = get(`SELECT id FROM ${table} WHERE name = :name COLLATE NOCASE`, { name });
  if (existing) return existing.id;
  return Number(run(`INSERT INTO ${table} (name) VALUES (:name)`, { name }).lastInsertRowid);
};

const adminEmail = process.env.ADMIN_EMAIL || "admin@telecom.local";
let admin = get("SELECT id FROM users WHERE email=:email", { email: adminEmail });
if (!admin) {
  admin = {
    id: Number(run(
      `INSERT INTO users (name,email,password_hash,role) VALUES (:name,:email,:password_hash,'admin')`,
      {
        name: process.env.ADMIN_NAME || "System Administrator",
        email: adminEmail,
        password_hash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "Admin@123", 12)
      }
    ).lastInsertRowid)
  };
}

let imported = 0;
const shouldImport = get("SELECT COUNT(*) AS total FROM daily_reports").total === 0;
if (shouldImport) transaction(() => {
  for (const row of rows) {
    const date = isoDate(findHeader(row, ["date"]));
    const plannerName = clean(findHeader(row, ["planner name"]));
    const projectName = clean(findHeader(row, ["project name"]));
    const taskType = clean(findHeader(row, ["task type"]));
    if (!date || !plannerName || !projectName || !taskType) continue;
    const plannerId = ensure("planners", plannerName);
    const projectId = ensure("projects", projectName);
    const taskTypeId = ensure("task_types", taskType);
    run(`
      INSERT INTO daily_reports (
        report_date, month, planner_id, project_id, task_type_id, work_count, remarks,
        four_f_oh, duct_length_meter, six_f_oh, twelve_f_oh, twentyfour_f_oh,
        fortyeight_f_oh, twentyfour_f_ug, fortyeight_f_ug, ninetysix_f_ug,
        onefortyfour_f, twosixteen_f_ug, created_by
      ) VALUES (
        :report_date, :month, :planner_id, :project_id, :task_type_id, :work_count, :remarks,
        :four_f_oh, :duct_length_meter, :six_f_oh, :twelve_f_oh, :twentyfour_f_oh,
        :fortyeight_f_oh, :twentyfour_f_ug, :fortyeight_f_ug, :ninetysix_f_ug,
        :onefortyfour_f, :twosixteen_f_ug, :created_by
      )
    `, {
      report_date: date,
      month: date.slice(0, 7),
      planner_id: plannerId,
      project_id: projectId,
      task_type_id: taskTypeId,
      work_count: number(findHeader(row, ["count"])),
      remarks: clean(findHeader(row, ["remarks"])),
      four_f_oh: number(findHeader(row, ["4f oh"])),
      duct_length_meter: number(findHeader(row, ["duct length meter", "duct length(m)"])),
      six_f_oh: number(findHeader(row, ["6f oh"])),
      twelve_f_oh: number(findHeader(row, ["12f oh"])),
      twentyfour_f_oh: number(findHeader(row, ["24f oh"])),
      fortyeight_f_oh: number(findHeader(row, ["48f oh"])),
      twentyfour_f_ug: number(findHeader(row, ["24f ug"])),
      fortyeight_f_ug: number(findHeader(row, ["48f ug"])),
      ninetysix_f_ug: number(findHeader(row, ["96f ug"])),
      onefortyfour_f: number(findHeader(row, ["144f"])),
      twosixteen_f_ug: number(findHeader(row, ["216f ug"])),
      created_by: admin.id
    });
    imported += 1;
  }
});

for (const planner of ["Bhabotos", "Sohel Rana", "Anik"]) {
  const plannerRow = get("SELECT id FROM planners WHERE name=:name COLLATE NOCASE", { name: planner });
  if (!plannerRow) continue;
  const email = `${planner.toLowerCase().replace(/\s+/g, ".")}@telecom.local`;
  if (!get("SELECT id FROM users WHERE email=:email", { email })) {
    run(
      `INSERT INTO users (name,email,password_hash,role,planner_id)
       VALUES (:name,:email,:password_hash,'planner',:planner_id)`,
      { name: planner, email, password_hash: bcrypt.hashSync("Planner@123", 12), planner_id: plannerRow.id }
    );
  }
}

if (!get("SELECT id FROM users WHERE email='manager@telecom.local'")) {
  run(
    `INSERT INTO users (name,email,password_hash,role)
     VALUES ('Planning Manager','manager@telecom.local',:hash,'manager')`,
    { hash: bcrypt.hashSync("Manager@123", 12) }
  );
}

console.log(`Imported ${imported} report rows from ${path.basename(source)}.`);
console.log("Demo manager: manager@telecom.local / Manager@123");
console.log("Demo planner: bhabotos@telecom.local / Planner@123");

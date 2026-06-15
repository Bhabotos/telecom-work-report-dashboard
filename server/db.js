import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";

dotenv.config();

const databasePath = path.resolve(process.env.DATABASE_PATH || "./data/telecom-reports.sqlite");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

export function initializeDatabase() {
  const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  db.exec(schema);
  db.exec(`
    UPDATE daily_reports
    SET report_date = '20' || substr(report_date, 7, 2) || '-' || substr(report_date, 4, 2) || '-' || substr(report_date, 1, 2),
        month = '20' || substr(report_date, 7, 2) || '-' || substr(report_date, 4, 2)
    WHERE report_date GLOB '[0-9][0-9]-[0-9][0-9]-[0-9][0-9]';
  `);
}

export function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}

export function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}

export function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}

export function transaction(callback) {
  db.exec("BEGIN");
  try {
    const value = callback();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

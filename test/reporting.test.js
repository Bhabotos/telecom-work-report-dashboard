import test from "node:test";
import assert from "node:assert/strict";
import { monthFromDate, normalizeReport } from "../server/reporting.js";

test("month is generated from ISO report date", () => {
  assert.equal(monthFromDate("2026-06-08"), "2026-06");
});

test("negative telecom quantities are rejected", () => {
  assert.throws(() => normalizeReport({
    report_date: "2026-06-08",
    planner_id: 1,
    project_id: 1,
    task_type_id: 1,
    work_count: -1
  }), /non-negative/);
});

test("numeric blanks normalize to zero", () => {
  const result = normalizeReport({
    report_date: "2026-06-08",
    planner_id: 1,
    project_id: 1,
    task_type_id: 1
  });
  assert.equal(result.work_count, 0);
  assert.equal(result.twosixteen_f_ug, 0);
});

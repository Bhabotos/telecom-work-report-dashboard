PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'planner')),
  planner_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (planner_id) REFERENCES planners(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS planners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  employee_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  month TEXT NOT NULL,
  planner_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  task_type_id INTEGER NOT NULL,
  work_count REAL NOT NULL DEFAULT 0 CHECK (work_count >= 0),
  remarks TEXT NOT NULL DEFAULT '',
  four_f_oh REAL NOT NULL DEFAULT 0 CHECK (four_f_oh >= 0),
  duct_length_meter REAL NOT NULL DEFAULT 0 CHECK (duct_length_meter >= 0),
  six_f_oh REAL NOT NULL DEFAULT 0 CHECK (six_f_oh >= 0),
  twelve_f_oh REAL NOT NULL DEFAULT 0 CHECK (twelve_f_oh >= 0),
  twentyfour_f_oh REAL NOT NULL DEFAULT 0 CHECK (twentyfour_f_oh >= 0),
  fortyeight_f_oh REAL NOT NULL DEFAULT 0 CHECK (fortyeight_f_oh >= 0),
  twentyfour_f_ug REAL NOT NULL DEFAULT 0 CHECK (twentyfour_f_ug >= 0),
  fortyeight_f_ug REAL NOT NULL DEFAULT 0 CHECK (fortyeight_f_ug >= 0),
  ninetysix_f_ug REAL NOT NULL DEFAULT 0 CHECK (ninetysix_f_ug >= 0),
  onefortyfour_f REAL NOT NULL DEFAULT 0 CHECK (onefortyfour_f >= 0),
  twosixteen_f_ug REAL NOT NULL DEFAULT 0 CHECK (twosixteen_f_ug >= 0),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'changes_requested')),
  manager_comment TEXT NOT NULL DEFAULT '',
  approved_by INTEGER,
  approved_at TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (planner_id) REFERENCES planners(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (task_type_id) REFERENCES task_types(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS report_remarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_date ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reports_month ON daily_reports(month);
CREATE INDEX IF NOT EXISTS idx_reports_planner ON daily_reports(planner_id);
CREATE INDEX IF NOT EXISTS idx_reports_project ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_task_type ON daily_reports(task_type_id);

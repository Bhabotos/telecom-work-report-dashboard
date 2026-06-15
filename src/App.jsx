import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { api, download, queryString, token } from "./api.js";

const AuthContext = createContext(null);
const ToastContext = createContext(() => {});
const colors = ["#1367a8", "#de3346", "#17a673", "#f2a93b", "#6f5bd3", "#1e91a8"];
const fiberFields = [
  ["four_f_oh", "4F OH"], ["six_f_oh", "6F OH"], ["twelve_f_oh", "12F OH"],
  ["twentyfour_f_oh", "24F OH"], ["fortyeight_f_oh", "48F OH"],
  ["twentyfour_f_ug", "24F UG"], ["fortyeight_f_ug", "48F UG"],
  ["ninetysix_f_ug", "96F UG"], ["onefortyfour_f", "144F"], ["twosixteen_f_ug", "216F UG"]
];
const emptyForm = {
  report_date: new Date().toISOString().slice(0, 10), planner_id: "", project_id: "", task_type_id: "",
  work_count: 0, remarks: "", duct_length_meter: 0,
  ...Object.fromEntries(fiberFields.map(([key]) => [key, 0]))
};

function useAuth() {
  return useContext(AuthContext);
}

function useToast() {
  return useContext(ToastContext);
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const notify = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500);
  };
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast ${toast.type}`} key={toast.id}>
            <span>{toast.type === "error" ? "!" : "✓"}</span>
            <p>{toast.message}</p>
            <button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("telecom_user") || "null"));
  const value = {
    user,
    login(data) {
      localStorage.setItem("telecom_token", data.token);
      localStorage.setItem("telecom_user", JSON.stringify(data.user));
      setUser(data.user);
    },
    logout() {
      localStorage.removeItem("telecom_token");
      localStorage.removeItem("telecom_user");
      setUser(null);
    }
  };
  return (
    <AuthContext.Provider value={value}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/*" element={user && token() ? <Shell /> : <Navigate to="/login" />} />
        </Routes>
      </ToastProvider>
    </AuthContext.Provider>
  );
}

function AnimatedValue({ value }) {
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  const suffix = typeof value === "string" ? value.replace(/[\d,.\s-]/g, "") : "";
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(numeric)) return;
    const started = performance.now();
    const duration = 500;
    let frame;
    const update = (now) => {
      const progress = Math.min((now - started) / duration, 1);
      setDisplay(numeric * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [numeric]);
  if (!Number.isFinite(numeric)) return value;
  return `${format(display)}${suffix ? ` ${suffix}` : ""}`;
}

function LoadingSpinner({ label = "Loading" }) {
  return <span className="button-loading"><i />{label}</span>;
}

function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-card">
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="form-actions">
          <button className="button secondary" onClick={onCancel}>Cancel</button>
          <button className={`button ${danger ? "danger-button" : "primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function SearchableSelect({ value, options, onChange, placeholder, disabled, error }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => String(item.id) === String(value));
  const [query, setQuery] = useState(selected?.name || "");
  const root = useRef(null);
  useEffect(() => setQuery(selected?.name || ""), [selected?.name]);
  useEffect(() => {
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const filtered = options.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className={`search-select ${open ? "open" : ""} ${error ? "invalid" : ""}`} ref={root}>
      <input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        aria-expanded={open}
      />
      {!disabled && <button type="button" tabIndex="-1" onClick={() => setOpen(!open)}>⌄</button>}
      {open && !disabled && (
        <div className="search-options">
          {filtered.length ? filtered.map((item) => (
            <button type="button" className={String(item.id) === String(value) ? "selected" : ""} key={item.id} onClick={() => {
              onChange(item.id);
              setQuery(item.name);
              setOpen(false);
            }}>{item.name}</button>
          )) : <span>No matching option</span>}
        </div>
      )}
    </div>
  );
}

function ExportButton({ path, filename, children, className = "button secondary" }) {
  const notify = useToast();
  const [loading, setLoading] = useState(false);
  const runExport = async () => {
    setLoading(true);
    try {
      await download(path, filename);
      notify("Export completed");
    } catch (error) {
      notify(error.message || "Export failed", "error");
    } finally {
      setLoading(false);
    }
  };
  return <button className={className} disabled={loading} onClick={runExport}>{loading ? <LoadingSpinner label="Exporting" /> : children}</button>;
}

function downloadChartImage(container, title) {
  const svg = container?.querySelector("svg");
  if (!svg) throw new Error("Chart image is not available");
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "admin@telecom.local", password: "Admin@123" });
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    try {
      const result = await api("/auth/login", { method: "POST", body: JSON.stringify(form) });
      auth.login(result);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-mark">T</div>
        <p>Network Planning Operations</p>
        <h1>Daily work reporting built for telecom infrastructure teams.</h1>
        <ul><li>Planner submissions</li><li>Management analytics</li><li>Excel and PDF reporting</li></ul>
      </section>
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">Secure portal</span>
        <h2>Sign in</h2>
        <p>Use your assigned work reporting account.</p>
        {error && <div className="alert error">{error}</div>}
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <button className="button primary">Sign in</button>
        <small>Demo admin: admin@telecom.local / Admin@123</small>
      </form>
    </main>
  );
}

const nav = [
  ["Dashboard", "/", "▦"], ["Daily Report Entry", "/entry", "+"], ["Daily Report", "/daily", "D"],
  ["Monthly Report", "/monthly", "M"], ["Data Table", "/reports", "≡"],
  ["Planner Summary", "/planner-summary", "P"], ["Project Summary", "/project-summary", "J"],
  ["Settings", "/settings", "⚙"], ["User Management", "/users", "U"], ["Export Center", "/exports", "⇩"]
];

function Shell() {
  const auth = useAuth();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const title = nav.find((item) => item[1] === location.pathname)?.[0] || "Telecom Work Report";
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="logo"><div className="brand-mark small">T</div><div><strong>TelecomOps</strong><span>Work Reporting</span></div></div>
        <nav>
          {nav.filter(([label]) => (label !== "User Management" || auth.user.role === "admin")).map(([label, path, icon]) => (
            <NavLink key={path} to={path} end={path === "/"} onClick={() => setMenu(false)}>
              <i>{icon}</i><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user"><b>{auth.user.name}</b><span>{auth.user.role}</span><button onClick={auth.logout}>Sign out</button></div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenu(!menu)}>☰</button>
          <div><span className="eyebrow">Infrastructure planning</span><h1>{title}</h1></div>
          <div className="top-user"><span>{auth.user.name}</span><b>{auth.user.role[0].toUpperCase()}</b></div>
        </header>
        <main className="content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="entry" element={<ReportForm />} />
            <Route path="daily" element={<GeneratedReport type="daily" />} />
            <Route path="monthly" element={<GeneratedReport type="monthly" />} />
            <Route path="reports" element={<ReportTable />} />
            <Route path="planner-summary" element={<Dashboard focus="planners" />} />
            <Route path="project-summary" element={<Dashboard focus="projects" />} />
            <Route path="settings" element={<Settings />} />
            <Route path="users" element={auth.user.role === "admin" ? <Users /> : <Navigate to="/" />} />
            <Route path="exports" element={<ExportCenter />} />
          </Routes>
        </main>
      </section>
    </div>
  );
}

function useMeta() {
  const [meta, setMeta] = useState({ planners: [], projects: [], taskTypes: [] });
  const refresh = () => api("/meta").then(setMeta).catch(() => {});
  useEffect(refresh, []);
  return [meta, refresh];
}

function Filters({ value, onChange, meta }) {
  const notify = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const update = (next) => {
    onChange(next);
    notify("Filter applied", "info");
  };
  const reset = () => {
    onChange({});
    notify("Filter reset", "info");
  };
  const badges = [
    value.date_from && `From: ${value.date_from}`, value.date_to && `To: ${value.date_to}`, value.month && `Month: ${value.month}`,
    value.planner_id && `Planner: ${meta.planners.find((item) => String(item.id) === String(value.planner_id))?.name}`,
    value.project_id && `Project: ${meta.projects.find((item) => String(item.id) === String(value.project_id))?.name}`,
    value.task_type_id && `Task: ${meta.taskTypes.find((item) => String(item.id) === String(value.task_type_id))?.name}`,
    value.category && `Fiber: ${value.category.toUpperCase()}`
  ].filter(Boolean);
  const field = (key, label, type = "text", options) => (
    <label>{label}
      {options ? <select value={value[key] || ""} onChange={(e) => update({ ...value, [key]: e.target.value })}>
        <option value="">All</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select> : <input type={type} value={value[key] || ""} onChange={(e) => update({ ...value, [key]: e.target.value })} />}
    </label>
  );
  return (
    <section className={`filter-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="section-heading"><div><span className="eyebrow">Live filters</span><h2>Reporting scope</h2></div><div className="filter-actions"><button className="text-button" onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Show" : "Hide"}</button><button className="text-button" onClick={reset}>Reset</button></div></div>
      {!collapsed && <div className="filter-grid">
        {field("date_from", "From date", "date")}{field("date_to", "To date", "date")}{field("month", "Month", "month")}
        {field("planner_id", "Planner", "text", meta.planners)}{field("project_id", "Project", "text", meta.projects)}
        {field("task_type_id", "Task type", "text", meta.taskTypes)}
        <label>Fiber category<select value={value.category || ""} onChange={(e) => update({ ...value, category: e.target.value })}>
          <option value="">OH and UG</option><option value="oh">OH only</option><option value="ug">UG only</option>
        </select></label>
      </div>}
      {!!badges.length && <div className="filter-badges">{badges.map((badge) => <span key={badge}>{badge}</span>)}</div>}
    </section>
  );
}

function Dashboard({ focus }) {
  const [meta] = useMeta();
  const [filters, setFilters] = useState({});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    setError("");
    const timer = setTimeout(() => api(`/dashboard?${queryString(filters)}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)), 150);
    return () => clearTimeout(timer);
  }, [filters]);
  if (!data && loading) return <DashboardSkeleton />;
  if (error && !data) return <Loading error={error} />;
  const kpis = [
    ["Total Tasks", data.totals.total_tasks, "blue"], ["Total Work Count", data.totals.total_count, "red"],
    ["Duct Length", `${format(data.totals.total_duct)} m`, "green"], ["OH Fiber", format(data.totals.total_oh), "purple"],
    ["UG Fiber", format(data.totals.total_ug), "orange"], ["Active Projects", data.totals.active_projects, "blue"],
    ["Planner Count", data.totals.planner_count, "green"], ["Today's Reports", data.totals.today_reports, "red"],
    ["Monthly Reports", data.totals.monthly_reports, "purple"]
  ];
  return (
    <>
      <Filters value={filters} onChange={setFilters} meta={meta} />
      <section className={`kpi-grid ${loading ? "refreshing" : ""}`}>{kpis.map(([label, value, tone]) => <article className={`kpi ${tone}`} key={label} title={`${label} for the current filter scope`}><span>{label}</span><strong><AnimatedValue value={value} /></strong><small>Current filter scope</small></article>)}</section>
      {!data.totals.total_tasks ? <EmptyState title="No data found" message="No dashboard records match the selected filters." /> : <section className={`chart-grid ${loading ? "refreshing" : ""}`}>
        <ChartCard title="Daily task trend" wide hasData={data.dailyTrend.length}><ResponsiveContainer><LineChart data={data.dailyTrend}><Grid /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Line name="Work count" type="monotone" dataKey="value" stroke="#1367a8" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Monthly work summary" hasData={data.monthlyTrend.length}><ResponsiveContainer><BarChart data={data.monthlyTrend}><Grid /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar name="Work count" dataKey="value" fill="#1367a8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Task type distribution" hasData={data.taskTypes.length}><ResponsiveContainer><PieChart><Pie data={data.taskTypes.slice(0, 8)} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88}>{data.taskTypes.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></ChartCard>
        <ChartCard title="OH vs UG fiber" hasData={data.fiber.some((item) => item.value > 0)}><ResponsiveContainer><BarChart data={data.fiber}><Grid /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar name="Fiber quantity" dataKey="value" fill="#de3346" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Duct length monthly trend" hasData={data.monthlyTrend.some((item) => item.duct > 0)}><ResponsiveContainer><AreaChart data={data.monthlyTrend}><defs><linearGradient id="duct" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#17a673" stopOpacity={0.7}/><stop offset="95%" stopColor="#17a673" stopOpacity={0}/></linearGradient></defs><Grid /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Area name="Duct length" dataKey="duct" stroke="#17a673" fill="url(#duct)" /></AreaChart></ResponsiveContainer></ChartCard>
        <Ranking title={focus === "projects" ? "All projects" : "Top 10 projects"} rows={data.projects} />
        <Ranking title={focus === "planners" ? "All planners" : "Top 10 planners"} rows={data.planners} />
      </section>}
    </>
  );
}

function Grid() {
  return <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />;
}
function ChartCard({ title, children, wide, hasData = true }) {
  const notify = useToast();
  const container = useRef(null);
  const save = () => {
    try {
      downloadChartImage(container.current, title);
      notify("Chart image downloaded");
    } catch (error) {
      notify(error.message, "error");
    }
  };
  return <article className={`chart-card ${wide ? "wide" : ""}`} ref={container}><div className="section-heading"><h2>{title}</h2><button className="chart-download no-print" onClick={save} disabled={!hasData} title={`Download ${title} image`}>Download</button></div><div className="chart-body">{hasData ? children : <EmptyState title="Empty chart" message="No data found for this chart." compact />}</div></article>;
}
function Ranking({ title, rows }) {
  const max = Math.max(...rows.map((row) => Number(row.value)), 1);
  return <article className="chart-card"><div className="section-heading"><h2>{title}</h2></div><div className="ranking">{rows.length ? rows.slice(0, 10).map((row, i) => <div key={row.name}><b>{i + 1}</b><span><em>{row.name}</em><i style={{ width: `${(row.value / max) * 100}%` }} /></span><strong>{format(row.value)}</strong></div>) : <EmptyState title="No data found" message="No ranking data matches the filters." compact />}</div></article>;
}

function ReportForm({ initial, onSaved }) {
  const auth = useAuth();
  const notify = useToast();
  const [meta] = useMeta();
  const [form, setForm] = useState({ ...emptyForm, ...initial });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => { if (initial) setForm({ ...emptyForm, ...initial }); }, [initial]);
  useEffect(() => {
    if (auth.user.role === "planner" && auth.user.plannerId) setForm((current) => ({ ...current, planner_id: auth.user.plannerId }));
  }, [auth.user]);
  const totals = useMemo(() => ({
    oh: ["four_f_oh", "six_f_oh", "twelve_f_oh", "twentyfour_f_oh", "fortyeight_f_oh"].reduce((sum, key) => sum + Number(form[key] || 0), 0),
    ug: ["twentyfour_f_ug", "fortyeight_f_ug", "ninetysix_f_ug", "onefortyfour_f", "twosixteen_f_ug"].reduce((sum, key) => sum + Number(form[key] || 0), 0),
    duct: Number(form.duct_length_meter || 0)
  }), [form]);
  const set = (key, value) => {
    setForm({ ...form, [key]: value });
    if (errors[key]) setErrors({ ...errors, [key]: "" });
  };
  const validate = () => {
    const next = {};
    if (!form.report_date) next.report_date = "Date is required";
    if (!form.planner_id) next.planner_id = "Planner Name is required";
    if (!form.project_id) next.project_id = "Project Name is required";
    if (!form.task_type_id) next.task_type_id = "Task Type is required";
    ["work_count", "duct_length_meter", ...fiberFields.map(([field]) => field)].forEach((field) => {
      const value = Number(form[field] || 0);
      if (!Number.isFinite(value) || value < 0) next[field] = "Enter a non-negative number";
    });
    setErrors(next);
    if (Object.keys(next).length) notify("Required field missing", "error");
    return !Object.keys(next).length;
  };
  const reset = () => {
    setForm({ ...emptyForm, planner_id: auth.user.role === "planner" ? auth.user.plannerId : "" });
    setErrors({});
    setMessage("");
    setError("");
    setResetOpen(false);
    notify("Form reset", "info");
  };
  const submit = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const editing = Boolean(form.id);
      const result = await api(`/reports${editing ? `/${form.id}` : ""}`, { method: editing ? "PUT" : "POST", body: JSON.stringify(form) });
      setMessage(result.message);
      notify(editing ? "Report updated successfully" : "Report submitted successfully");
      if (!editing) setForm({ ...emptyForm, planner_id: auth.user.role === "planner" ? auth.user.plannerId : "" });
      onSaved?.();
    } catch (err) {
      setError(err.message);
      notify(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <>
      <ConfirmDialog open={resetOpen} title="Reset report form?" message="All unsaved values in the existing fields will be cleared." confirmLabel="Reset" onCancel={() => setResetOpen(false)} onConfirm={reset} />
      <form className="panel report-form" onSubmit={submit} noValidate>
        <div className="section-heading"><div><span className="eyebrow">{form.id ? "Update submission" : "New submission"}</span><h2>Daily work details</h2></div><span className="month-chip">{form.report_date ? new Date(`${form.report_date}T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" }) : "Month auto-generated"}</span></div>
        {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <label className={errors.report_date ? "field-invalid" : ""}>Date<input type="date" value={form.report_date} onChange={(e) => set("report_date", e.target.value)} aria-invalid={Boolean(errors.report_date)} />{errors.report_date && <small className="field-error">{errors.report_date}</small>}</label>
          <label className={errors.planner_id ? "field-invalid" : ""}>Planner<SearchableSelect value={form.planner_id} disabled={auth.user.role === "planner"} options={meta.planners} onChange={(value) => set("planner_id", value)} placeholder="Search planner" error={errors.planner_id} />{errors.planner_id && <small className="field-error">{errors.planner_id}</small>}</label>
          <label className={errors.project_id ? "field-invalid" : ""}>Project<SearchableSelect value={form.project_id} options={meta.projects} onChange={(value) => set("project_id", value)} placeholder="Search project" error={errors.project_id} />{errors.project_id && <small className="field-error">{errors.project_id}</small>}</label>
          <label className={errors.task_type_id ? "field-invalid" : ""}>Task type<SearchableSelect value={form.task_type_id} options={meta.taskTypes} onChange={(value) => set("task_type_id", value)} placeholder="Search task type" error={errors.task_type_id} />{errors.task_type_id && <small className="field-error">{errors.task_type_id}</small>}</label>
          <NumberInput label="Count" field="work_count" form={form} set={set} error={errors.work_count} />
          <NumberInput label="Duct Length meter" field="duct_length_meter" form={form} set={set} error={errors.duct_length_meter} />
        </div>
        <h3 className="subheading">Fiber quantities</h3>
        <div className="fiber-grid">{fiberFields.map(([field, label]) => <NumberInput key={field} label={label} field={field} form={form} set={set} error={errors[field]} />)}</div>
        <div className="calculation-strip" aria-live="polite">
          <div><span>Total OH quantity</span><strong>{format(totals.oh)}</strong></div>
          <div><span>Total UG quantity</span><strong>{format(totals.ug)}</strong></div>
          <div><span>Total duct length</span><strong>{format(totals.duct)} m</strong></div>
        </div>
        <label>Remarks<textarea rows="4" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Task ID, route, segment, issue, or management note" /></label>
        <div className="form-actions"><button type="button" className="button secondary" disabled={submitting} onClick={() => setResetOpen(true)}>Clear</button><button className="button primary" disabled={submitting}>{submitting ? <LoadingSpinner label={form.id ? "Updating" : "Submitting"} /> : form.id ? "Update report" : "Submit report"}</button></div>
      </form>
    </>
  );
}
function NumberInput({ label, field, form, set, error }) {
  return <label className={error ? "field-invalid" : ""}>{label}<input type="number" min="0" step="any" value={form[field]} onChange={(e) => set(field, e.target.value)} aria-invalid={Boolean(error)} />{error && <small className="field-error">{error}</small>}</label>;
}

function ReportTable() {
  const auth = useAuth();
  const notify = useToast();
  const [meta] = useMeta();
  const [filters, setFilters] = useState({ page: 1, limit: 20 });
  const [data, setData] = useState({ rows: [], pagination: {} });
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    return api(`/reports?${queryString(filters)}`).then((result) => {
      setData(result);
      if (!result.rows.length) notify("No data found", "info");
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { const timer = setTimeout(load, 150); return () => clearTimeout(timer); }, [filters]);
  const remove = async () => {
    try {
      await api(`/reports/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      notify("Report deleted successfully");
      load();
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const review = async (id, status) => {
    const comment = prompt("Manager comment (optional):") || "";
    try {
      await api(`/reports/${id}/review`, { method: "POST", body: JSON.stringify({ status, comment }) });
      notify("Report review saved");
      load();
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const sort = (key) => {
    const direction = filters.sort === key && filters.direction === "asc" ? "desc" : "asc";
    setFilters({ ...filters, sort: key, direction, page: 1 });
  };
  const header = (label, key) => <th><button className="sort-header" onClick={() => sort(key)}>{label}<span>{filters.sort === key ? (filters.direction === "asc" ? "↑" : "↓") : "↕"}</span></button></th>;
  return (
    <>
      <ConfirmDialog open={Boolean(deleting)} title="Delete report?" message="This will permanently delete the selected report. This action cannot be undone." confirmLabel="Delete" danger onCancel={() => setDeleting(null)} onConfirm={remove} />
      {viewing && <ReportDetailsModal report={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} />}
      {editing && <div className="modal"><div className="modal-card"><button className="modal-close" onClick={() => setEditing(null)}>×</button><ReportForm initial={editing} onSaved={() => { setEditing(null); load(); }} /></div></div>}
      <Filters value={filters} onChange={(value) => setFilters({ ...value, page: 1, limit: filters.limit })} meta={meta} />
      <section className="panel">
        <div className="table-toolbar"><input placeholder="Search planner, project, task, remarks..." value={filters.search || ""} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} /><div><ExportButton path={`/export/excel?${queryString(filters)}`} filename="telecom-report.xlsx">Excel</ExportButton><ExportButton path={`/export/pdf?${queryString(filters)}`} filename="telecom-report.pdf">PDF</ExportButton></div></div>
        {error && <div className="alert error">{error}</div>}
        <div className={`table-wrap ${loading ? "table-loading" : ""}`}><table><thead><tr>{header("Date", "date")}{header("Planner", "planner")}{header("Project", "project")}{header("Task Type", "task")}{header("Count", "count")}<th>Duct</th><th>OH</th><th>UG</th><th>Status</th><th>Remarks</th><th>Actions</th></tr></thead>
          <tbody>{loading ? <TableSkeleton columns={11} /> : data.rows.length ? data.rows.map((row) => <tr key={row.id}><td>{row.report_date}</td><td>{row.planner_name}</td><td>{row.project_name}</td><td>{row.task_type}</td><td>{format(row.work_count)}</td><td>{format(row.duct_length_meter)}</td><td>{format(row.total_oh)}</td><td>{format(row.total_ug)}</td><td><span className={`status ${row.status}`}>{row.status.replace("_", " ")}</span></td><td className="remarks" title={row.remarks || ""}>{row.remarks || "-"}</td><td><div className="row-actions"><button onClick={() => setViewing(row)}>View</button><button onClick={() => setEditing(row)}>Edit</button>{["admin", "manager"].includes(auth.user.role) && <button onClick={() => review(row.id, "approved")}>Approve</button>}{auth.user.role === "admin" && <button className="danger" onClick={() => setDeleting(row)}>Delete</button>}</div></td></tr>) : <tr><td colSpan="11"><EmptyState title="Empty table" message="No report found for the selected search or filters." compact /></td></tr>}</tbody>
        </table></div>
        <div className="pagination"><span>{data.pagination.total || 0} records</span><div><button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button><b>Page {filters.page} of {data.pagination.pages || 1}</b><button disabled={filters.page >= (data.pagination.pages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button></div></div>
      </section>
    </>
  );
}

function ReportDetailsModal({ report, onClose, onEdit }) {
  const exportQuery = queryString({
    date_from: report.report_date,
    date_to: report.report_date,
    planner_id: report.planner_id,
    project_id: report.project_id,
    task_type_id: report.task_type_id
  });
  const details = [
    ["Date", report.report_date], ["Month", report.month], ["Planner Name", report.planner_name],
    ["Project Name", report.project_name], ["Task Type", report.task_type], ["Count", format(report.work_count)],
    ["Remarks", report.remarks || "-"], ["4F OH", format(report.four_f_oh)], ["Duct Length meter", format(report.duct_length_meter)],
    ["6F OH", format(report.six_f_oh)], ["12F OH", format(report.twelve_f_oh)], ["24F OH", format(report.twentyfour_f_oh)],
    ["48F OH", format(report.fortyeight_f_oh)], ["24F UG", format(report.twentyfour_f_ug)], ["48F UG", format(report.fortyeight_f_ug)],
    ["96F UG", format(report.ninetysix_f_ug)], ["144F", format(report.onefortyfour_f)], ["216F UG", format(report.twosixteen_f_ug)],
    ["Created By", report.created_by_name], ["Created Time", report.created_at], ["Updated Time", report.updated_at]
  ];
  return (
    <div className="modal details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="details-card">
        <div className="section-heading"><div><span className="eyebrow">Existing report information</span><h2 id="details-title">Report Details</h2></div><button className="modal-close inline-close" onClick={onClose}>×</button></div>
        <div className="details-grid">{details.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className="form-actions no-print">
          <button className="button secondary" onClick={onClose}>Close</button>
          <button className="button secondary" onClick={onEdit}>Edit</button>
          <button className="button secondary" onClick={() => print()}>Print</button>
          <ExportButton path={`/export/pdf?${exportQuery}`} filename={`report-${report.id}.pdf`} className="button primary">Download</ExportButton>
        </div>
      </section>
    </div>
  );
}

function GeneratedReport({ type }) {
  const notify = useToast();
  const location = useLocation();
  const requestedValue = new URLSearchParams(location.search).get(type === "daily" ? "date" : "month");
  const defaultValue = type === "daily" ? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 7);
  const [value, setValue] = useState(requestedValue || defaultValue);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    return api(`/reports/${type}/${value}`).then((result) => {
      setData(result);
      if (!result.rows.length) notify("No report found", "info");
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [value, type]);
  if (!data && loading) return <Loading />;
  if (error) return <Loading error={error} />;
  const qs = type === "daily" ? `date_from=${value}&date_to=${value}` : `month=${value}`;
  const selectedDate = type === "daily" ? new Date(`${value}T00:00:00`) : null;
  const monthName = selectedDate?.toLocaleString("en-US", { month: "long" });
  const year = selectedDate?.getFullYear();
  return (
    <section className={`report-document ${loading ? "refreshing" : ""}`}>
      <div className="report-controls no-print"><label>{type === "daily" ? "Report date" : "Report month"}<input type={type === "daily" ? "date" : "month"} value={value} onChange={(e) => setValue(e.target.value)} /></label><div><ExportButton path={type === "daily" ? `/export/daily-excel?date=${value}` : `/export/excel?${qs}`} filename={`${type}-report.xlsx`}>Excel</ExportButton><ExportButton path={`/export/pdf?${qs}`} filename={`${type}-report.pdf`}>PDF</ExportButton><button className="button primary" onClick={() => print()}>Print</button></div></div>
      <header className="report-header"><div className="brand-mark small">T</div><div><span>Telecom Infrastructure Planning</span><h1>{type === "daily" ? "Daily Work Report" : "Monthly Management Report"}</h1><p>{value}</p></div></header>
      {!data.rows.length && <EmptyState title="No report found" message={`No ${type} report information is available for the selected ${type === "daily" ? "date" : "month"}.`} />}
      {type === "daily" && <div className="selected-report-date"><span>Select date</span><strong>{value}</strong></div>}
      {type === "monthly" && <div className="report-kpis"><div><span>Submitted reports</span><strong>{data.totals.total_tasks}</strong></div><div><span>Total count</span><strong>{format(data.totals.total_count)}</strong></div><div><span>Duct length</span><strong>{format(data.totals.total_duct)} m</strong></div><div><span>OH / UG</span><strong>{format(data.totals.total_oh)} / {format(data.totals.total_ug)}</strong></div></div>}
      {type === "monthly" && <div className="management-summary"><b>Management summary</b><p>{data.managementSummary}</p><span>Top planner: {data.topPlanner?.name || "-"} | Highest work project: {data.topProject?.name || "-"}</span></div>}
      {type === "daily" ? (
        <>
          <div className="table-wrap proposed-report-table"><table><thead><tr><th>Date</th><th>Month</th><th>Year</th><th>Month Key</th><th>Planner Name</th><th>Project Name</th><th>Task Type</th><th>Count</th><th>Remarks</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id}><td>{row.report_date}</td><td>{monthName}</td><td>{year}</td><td>{row.month}</td><td>{row.planner_name}</td><td>{row.project_name}</td><td>{row.task_type}</td><td>{format(row.work_count)}</td><td>{row.remarks}</td></tr>)}</tbody></table></div>
          <div className="daily-output-grid">
            <div className="daily-summary-tables"><SummaryTable title="Task Type" valueLabel="Work Quantity" rows={data.taskTypes} /><SummaryTable title="Planner" valueLabel="Work Quantity" rows={data.planners} /></div>
            <ChartCard title="Work Quantity vs. Task Type"><ResponsiveContainer><BarChart data={data.taskTypes} margin={{ bottom: 35 }}><Grid /><XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} height={70} /><YAxis /><Tooltip /><Bar dataKey="value" name="Work Quantity" fill="#1d6988" /></BarChart></ResponsiveContainer></ChartCard>
          </div>
        </>
      ) : (
        <>
          <div className="report-sections"><SummaryTable title="Planner-wise summary" rows={data.planners} /><SummaryTable title="Project-wise summary" rows={data.projects} /><SummaryTable title="Task type summary" rows={data.taskTypes} /></div>
          <ChartCard title="Monthly trend"><ResponsiveContainer><LineChart data={data.dailyTrend}><Grid /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line dataKey="value" stroke="#de3346" strokeWidth={3} /></LineChart></ResponsiveContainer></ChartCard>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Planner</th><th>Project</th><th>Task</th><th>Count</th><th>Duct</th><th>Remarks</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id}><td>{row.report_date}</td><td>{row.planner_name}</td><td>{row.project_name}</td><td>{row.task_type}</td><td>{format(row.work_count)}</td><td>{format(row.duct_length_meter)}</td><td>{row.remarks}</td></tr>)}</tbody></table></div>
        </>
      )}
    </section>
  );
}
function SummaryTable({ title, valueLabel, rows }) {
  return <section className={valueLabel ? "proposed-summary" : ""}><h3>{title}{valueLabel && <span>{valueLabel}</span>}</h3>{rows.slice(0, 10).map((row) => <div className="summary-line" key={row.name}><span>{row.name}</span><b>{format(row.value)}</b></div>)}</section>;
}

function Settings() {
  const auth = useAuth();
  const [meta, refresh] = useMeta();
  const [type, setType] = useState("projects");
  const [name, setName] = useState("");
  const list = type === "planners" ? meta.planners : type === "projects" ? meta.projects : meta.taskTypes;
  const add = async (e) => {
    e.preventDefault();
    await api(`/master/${type}`, { method: "POST", body: JSON.stringify({ name }) });
    setName(""); refresh();
  };
  return <section className="panel"><div className="section-heading"><div><span className="eyebrow">Master data</span><h2>Reporting configuration</h2></div></div>
    <div className="tabs">{["projects", "task-types", "planners"].map((item) => <button className={type === item ? "active" : ""} onClick={() => setType(item)} key={item}>{item.replace("-", " ")}</button>)}</div>
    {auth.user.role === "admin" && <form className="inline-form" onSubmit={add}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${type.replace("-", " ")}`} required /><button className="button primary">Add</button></form>}
    <div className="master-list">{list.map((item) => <div key={item.id}><span>{item.name}</span><b>Active</b></div>)}</div>
  </section>;
}

function Users() {
  const [meta] = useMeta();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "planner", planner_id: "" });
  const load = () => api("/users").then(setUsers);
  useEffect(load, []);
  const submit = async (e) => {
    e.preventDefault(); await api("/users", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", email: "", password: "", role: "planner", planner_id: "" }); load();
  };
  return <div className="split-layout"><form className="panel" onSubmit={submit}><div className="section-heading"><h2>Add user</h2></div><label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Temporary password<input type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="planner">Planner</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label>{form.role === "planner" && <label>Planner profile<select value={form.planner_id} onChange={(e) => setForm({ ...form, planner_id: e.target.value })} required><option value="">Select planner</option>{meta.planners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<button className="button primary">Create user</button></form>
    <section className="panel"><div className="section-heading"><h2>System users</h2></div><div className="user-list">{users.map((u) => <div key={u.id}><b>{u.name}</b><span>{u.email}</span><em>{u.role}</em><i className={u.active ? "online" : ""}>{u.active ? "Active" : "Inactive"}</i></div>)}</div></section></div>;
}

function ExportCenter() {
  const [meta] = useMeta();
  const [filters, setFilters] = useState({});
  return <><Filters value={filters} onChange={setFilters} meta={meta} /><section className="export-grid"><article><b>XLSX</b><h2>Excel workbook</h2><p>Full filtered dataset with telecom columns, calculated OH/UG totals, status, and audit timestamps.</p><ExportButton path={`/export/excel?${queryString(filters)}`} filename="telecom-report.xlsx" className="button primary">Download Excel</ExportButton></article><article><b>PDF</b><h2>Management PDF</h2><p>Printable filtered summary with key totals and up to 150 detailed work lines.</p><ExportButton path={`/export/pdf?${queryString(filters)}`} filename="telecom-report.pdf" className="button primary">Download PDF</ExportButton></article></section></>;
}

function Loading({ error }) {
  return <div className="loading">{error ? <div className="alert error">{error}</div> : <><i /><span>Loading report data...</span></>}</div>;
}
function EmptyState({ title, message, compact }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}><i>–</i><h3>{title}</h3><p>{message}</p></div>;
}
function DashboardSkeleton() {
  return <><section className="filter-panel skeleton-panel"><div className="skeleton line wide" /><div className="filter-grid">{Array.from({ length: 7 }, (_, index) => <div className="skeleton field" key={index} />)}</div></section><section className="kpi-grid">{Array.from({ length: 9 }, (_, index) => <article className="kpi skeleton-card" key={index}><div className="skeleton line" /><div className="skeleton value" /><div className="skeleton line short" /></article>)}</section><section className="chart-grid"><article className="chart-card wide"><div className="skeleton chart" /></article><article className="chart-card"><div className="skeleton chart" /></article><article className="chart-card"><div className="skeleton chart" /></article></section></>;
}
function TableSkeleton({ columns }) {
  return Array.from({ length: 6 }, (_, row) => <tr className="skeleton-row" key={row}>{Array.from({ length: columns }, (__, column) => <td key={column}><span className="skeleton line" /></td>)}</tr>);
}
function format(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default App;

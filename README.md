# Telecom Daily and Monthly Work Report Dashboard

Full-stack reporting system for telecom infrastructure planning teams. The included seed imports the real `Infra BKB Monthly Report (9).xlsx` format from `sample-data/source-report.xlsx`.

## Project Structure

```text
telecom-work-report-dashboard/
|-- data/                         # SQLite database generated locally
|-- dist/                         # Production React build
|-- sample-data/
|   `-- source-report.xlsx        # Source workbook used by the seed
|-- server/
|   |-- auth.js                   # JWT authentication and RBAC middleware
|   |-- db.js                     # Node built-in SQLite connection
|   |-- index.js                  # Express API, reports, analytics, exports
|   |-- reporting.js              # Validation, filtering, calculated fields
|   |-- schema.sql                # Database schema and indexes
|   |-- seed.js                   # Workbook import and demo accounts
|   `-- setup.js                  # Database and first admin creation
|-- src/
|   |-- api.js                    # Authenticated API client and downloads
|   |-- App.jsx                   # Pages, forms, dashboards, charts, tables
|   |-- main.jsx                  # React entry point
|   `-- styles.css                # Responsive corporate dashboard design
|-- test/
|   `-- reporting.test.js         # Validation and month calculation tests
|-- .env.example
|-- package.json
`-- vite.config.js
```

## Database Schema

- `users`: email login, password hash, role, linked planner, active status
- `planners`: planner master list and employee ID
- `projects`: managed project names
- `task_types`: managed task types
- `daily_reports`: source workbook fields, status, comments, creator, timestamps
- `report_remarks`: manager/admin report comments
- `audit_logs`: login, create, update, review, delete, and admin actions

`daily_reports.month` is stored as `YYYY-MM` and generated from `report_date`. OH and UG totals are calculated in report queries:

- OH: 4F + 6F + 12F + 24F + 48F OH
- UG: 24F + 48F + 96F + 144F + 216F UG

## Frontend Pages

- `/` Dashboard with KPIs, filters, charts, and rankings
- `/entry` Daily report submission and edit form
- `/daily` Daily report generator, print, Excel, and PDF
- `/monthly` Monthly management report and trends
- `/reports` Searchable, sortable, paginated report table
- `/planner-summary` Planner performance view
- `/project-summary` Project performance view
- `/settings` Planner, project, and task type masters
- `/users` Admin-only user management
- `/exports` Filtered Excel and PDF export center

## API List

### Authentication

- `POST /api/auth/login`
- `GET /api/auth/me`

### Users and Master Data

- `GET|POST /api/users`
- `PUT|DELETE /api/users/:id`
- `GET|POST /api/master/:type`
- `PUT /api/master/:type/:id`
- `GET /api/meta`

Master types: `planners`, `projects`, `task-types`.

### Reports

- `POST /api/reports`
- `GET /api/reports`
- `GET|PUT|DELETE /api/reports/:id`
- `POST /api/reports/:id/review`
- `GET /api/reports/daily/:date`
- `GET /api/reports/monthly/:month`
- `GET /api/dashboard`

Report list and dashboard APIs accept `date_from`, `date_to`, `month`, `planner_id`, `project_id`, `task_type_id`, and `category=oh|ug`. The report list additionally accepts `search`, `page`, `limit`, `sort`, and `direction`.

### Exports

- `GET /api/export/excel`
- `GET /api/export/pdf`

The same report filters can be supplied to both export endpoints.

## Local Installation

Requires Node.js 24 or newer because the project uses Node's built-in SQLite driver.

```powershell
cd C:\Users\Bhabotos-Kumar\telecom-work-report-dashboard
npm.cmd install
Copy-Item .env.example .env
npm.cmd run db:setup
npm.cmd run db:seed
npm.cmd run dev
```

Open `http://localhost:5173`.

Production mode:

```powershell
npm.cmd run build
npm.cmd start
```

Open `http://localhost:4000`.

## Environment Example

```env
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=12h
DATABASE_PATH=./data/telecom-reports.sqlite
CLIENT_ORIGIN=http://localhost:5173
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@telecom.local
ADMIN_PASSWORD=Admin@123
```

Change `JWT_SECRET` and `ADMIN_PASSWORD` before a real deployment.

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@telecom.local` | `Admin@123` |
| Manager | `manager@telecom.local` | `Manager@123` |
| Planner | `bhabotos@telecom.local` | `Planner@123` |

The admin account is created by `npm run db:setup`. Manager and planner demo accounts are created by `npm run db:seed`.

## GitHub and Deployment

Create a repository and push:

```powershell
git init
git add .
git commit -m "Build telecom work report dashboard"
git branch -M main
git remote add origin https://github.com/YOUR-USER/telecom-work-report-dashboard.git
git push -u origin main
```

### Netlify Frontend

This application cannot run entirely on Netlify in its current form. The Express API uses a writable SQLite database, while a Netlify frontend deployment is static. Deploy the API first to Render, Railway, or a Node VPS with persistent storage, then deploy the React frontend to Netlify.

1. Deploy the backend using the server instructions below.
2. Set the backend `CLIENT_ORIGIN` to the final Netlify URL, for example `https://your-site.netlify.app`.
3. In Netlify, select **Add new project** and import this Git repository.
4. Netlify will read `netlify.toml` and use:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. In **Project configuration > Environment variables**, add:

```env
VITE_API_URL=https://your-backend.example.com
```

Do not add `/api` to `VITE_API_URL`. Trigger a new deploy after changing the variable.

### Vercel Frontend

The frontend is React 19 with Vite. The existing Express and SQLite backend should run on Render, Railway, or a Node VPS because the SQLite file requires persistent writable storage.

Deploy the backend first, then import this Git repository into Vercel with:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Node.js version: `24.x`

Add this Vercel environment variable for Production and Preview:

```env
VITE_API_URL=https://your-backend.example.com
```

Do not include `/api` or a trailing slash. Environment variable changes require a new deployment.

Configure the backend with:

```env
CLIENT_ORIGIN=https://your-project.vercel.app
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=12h
DATABASE_PATH=/path-on-persistent-disk/telecom-reports.sqlite
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@telecom.local
ADMIN_PASSWORD=replace-with-a-secure-password
```

Run `npm run db:setup` once against the persistent production database before signing in. Use the configured `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first login. `vercel.json` contains the SPA fallback required for React Router routes.

For Render, Railway, or a Node VPS:

1. Use Node 24 or newer.
2. Build command: `npm install && npm run build && npm run db:setup`
3. Start command: `npm start`
4. Set all production environment variables.
5. Attach persistent storage and point `DATABASE_PATH` to that mounted disk.
6. Run `npm run db:seed` once only when sample data is required.

SQLite is suitable for a small planning team on one server. For multiple application instances or larger workloads, migrate the schema to PostgreSQL and keep the same API/UI contracts.

## Verification

```powershell
npm.cmd test
npm.cmd run build
npm.cmd audit
```

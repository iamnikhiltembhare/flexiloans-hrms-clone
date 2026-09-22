# FlexiLoans HRMS Portal (clone)

A front-end clone of the FlexiLoans HR portal (uKnowva), rebuilt as a modern
React single-page app. Everything runs on mock data - there is no backend,
no API and no real employee information in this repository.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production build
```

### Test logins

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Super Admin | `nikhil.tembhare` | `demo1234` | Everything, including organisation settings and System Admin |
| HR Professional | `hr.manager` | `FlexiHR@2026` | Self-service + Employees, Recruitment, Helpdesk, Reports |
| Employee | `rohan.sharma` | `FlexiEmp@2026` | Self-service only - no HR tools |

Click a row on the login screen to fill the form; wrong credentials are rejected.
Accounts, roles and permissions live in `src/data/accounts.js`.

### Roles and permissions

Each role holds a list of permission keys. Enforcement happens in two places:

- `src/components/Sidebar.jsx` - nav items declare the permission they need, so
  a role never sees a module it cannot open.
- `src/App.jsx` - every route is wrapped in a `<Require perm>` guard, so a
  restricted URL typed directly renders the access-denied screen.

The dashboard is role-specific (`src/pages/Dashboard.jsx` dispatches on the
account's `dashboard` key):

| Role | Dashboard |
|------|-----------|
| Super Admin | Platform console - sign-in activity, system health, integrations, audit trail, admin shortcuts |
| HR Professional | People ops - approval queue, headcount, attrition, attendance, celebrations |
| Employee | Self-service - my hours, leave balance, payslip, announcements, holidays, goals |

To add a role, add an entry to `ROLES` in `src/data/accounts.js` and give it a
`perms` array; nothing else needs to change.

## Stack

| Layer     | Choice                          |
|-----------|---------------------------------|
| Framework | React 19 + Vite                 |
| Routing   | react-router-dom 7              |
| Styling   | Tailwind CSS 3 (brand tokens)   |
| Charts    | Recharts                        |
| Icons     | lucide-react                    |

## Modules

**Overview** - Dashboard (headcount, attendance, approvals, celebrations), Announcements

**My workspace** - Attendance (daily log, team view, holiday calendar), Leave
(balances, apply, approvals), Payroll (payslips, salary structure, tax
declaration), Documents, Performance (goals, competencies, review history),
My Profile

**People ops** - Employee directory with detail pages, Recruitment
(requisitions, pipeline, funnel), Helpdesk (ticketing with SLA), Reports
(workforce, attrition, scheduled reports), Settings (preferences, roles,
organisation, leave policy)

## Project layout

```
src/
  components/   Layout, Sidebar, Topbar, Logo, shared UI kit (ui.jsx)
  context/      AuthContext - mock session held in sessionStorage
  data/mock.js  All seed data: employees, attendance, leave, payroll, ...
  pages/        One file per module
```

## Brand

Colours and type follow the FlexiLoans design system - navy `#1B365D` for
structure, cyan `#00B4D8` for actions and accents, Inter for text and DM Mono
for numeric data. Tokens live in `tailwind.config.js` and `src/index.css`.

## Notes

- Interactions are local state only: approving leave, resolving a ticket or
  submitting a leave request updates the UI and resets on reload.
- Names, IDs, salaries and documents are fabricated for the demo.
- To point this at a real API, replace the imports from `src/data/mock.js`
  with fetch calls - the page components take plain arrays and objects.

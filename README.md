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
| Super Admin | `admin` | `Admin@2026` | Everything, including organisation settings and System Admin |
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

**My workspace** - Attendance (daily log, team view, holiday calendar), Holiday
Calendar 2026 (year grid, company holidays, optional holidays with apply), Leave
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

- Changes persist in `localStorage` (see `src/lib/persist.js`), so they survive
  a reload and a browser restart. Storage is per browser and per device and is
  never shared between people. Settings has a Reset that clears it all.
- Names, IDs, salaries and documents are fabricated for the demo.
- To point this at a real API, replace the imports from `src/data/mock.js`
  with fetch calls - the page components take plain arrays and objects.


## Holiday calendar

`src/data/holidays.js` carries the 2026 India calendar: 17 company (gazetted)
holidays and 30 optional / restricted holidays, following the DoPT list for
2026. Employees may apply for any two optional holidays; applying creates a
normal leave request that the manager approves.

Dates that depend on moon sighting (the two Eids, Muharram, Milad-un-Nabi,
Jamat-Ul-Vida) are flagged `lunar: true` and may shift by a day.

### Live sync with Google Calendar

Google publishes national holiday calendars publicly, so Calendar API v3 can be
read with an API key alone - no OAuth and no backend, and the endpoint sends
CORS headers so the browser calls it directly.

1. Google Cloud Console -> enable **Google Calendar API**
2. Create an API key; restrict it by HTTP referrer and to the Calendar API
3. Add it to `.env`:

```
VITE_GOOGLE_API_KEY=your_api_key_here
```

The Holiday Calendar page then pulls the public *Holidays in India* calendar,
caches it in `localStorage` for 12 hours, and shows a green "Synced from Google
Calendar" banner. Without a key - or if the request fails - it falls back to the
bundled list and says so. Other regions are available in
`HOLIDAY_CALENDARS` in `src/lib/googleCalendar.js`.

Note that the API key would be visible in the client bundle. That is acceptable
for a referrer-restricted, read-only public-calendar key; anything broader
belongs behind a server.

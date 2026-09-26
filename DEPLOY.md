# Getting the HRMS demo live

Goal: a public URL you can open in a meeting, that rebuilds itself on every
push to `main`, while the repository stays **private**.

Host: **Netlify** - free, deploys from private repos, auto-builds on push.

## Why not github.io

GitHub Pages on a free account only publishes from **public** repositories;
Pages from a private repo needs GitHub Pro or Team. A public repo would expose
the FlexiLoans branding, the uKnowva reference and the three demo passwords in
`src/data/accounts.js`. Netlify avoids the trade-off.

`.github/workflows/deploy.yml` is in the repo anyway - if you later go public
or move to Pro, Pages will work with the same auto-deploy behaviour.

## One-time setup (about 10 minutes)

### 1. Push to GitHub

```bash
cd "/Users/nikhil.tembhare/Chrome Download/GitHub Projects/HRMS Cloned"
git push -u origin main
```

If prompted for a password: GitHub no longer accepts account passwords over
HTTPS. Create a token at **github.com -> Settings -> Developer settings ->
Personal access tokens -> Fine-grained**, grant `Contents: read and write` on
this repository, and paste it as the password. Keychain remembers it.

Check the repo is **Private** under Settings -> General.

### 2. Create the Netlify site

1. **app.netlify.com** -> sign up with GitHub.
2. **Add new site -> Import an existing project -> GitHub**.
3. Authorise Netlify; choose **Only select repositories** and pick
   `flexiloans-hrms-clone`.
4. Netlify reads `netlify.toml` and fills in the build settings itself:
   build `npm run build`, publish `dist`, Node 22.
5. Before the first deploy, under **Environment variables**, add
   `VITE_PUBLIC_DEMO` = `true`. This makes it the neutral demo site.
6. **Deploy**. First build takes two to three minutes.

### 3. Name it

**Site configuration -> Site details -> Change site name** ->
`flexiloans-hrms-demo`, giving you:

```
https://flexiloans-hrms-demo.netlify.app
```

### 3b. Add the live (FlexiLoans-branded) site

Repeat step 2 with the **same repository**, but skip step 5: leave
`VITE_PUBLIC_DEMO` unset. Name it `flexiloans-hrms-live`:

```
https://flexiloans-hrms-live.netlify.app
```

Both sites rebuild on every push to `main`. The only difference between them
is that one environment variable. `netlify.toml` must not set it, because
values in the file override the Netlify UI.

### 4. Check it

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `admin` | `Admin@2026` |
| HR Professional | `hr.manager` | `FlexiHR@2026` |
| Employee | `rohan.sharma` | `FlexiEmp@2026` |

## From then on it is automatic

```bash
git add -A && git commit -m "what changed" && git push
```

Netlify rebuilds and the live URL updates in about two minutes. Pull requests
get their own preview URL. **Deploys -> pick an older one -> Publish deploy**
rolls back instantly.

## Before showing it outside the team

The site is reachable by anyone with the link even though the repo is private.

- All data is fabricated; no real records are in the build.
- The passwords are in the JavaScript bundle. Fine for a demo, but it is not
  authentication.
- `VITE_PUBLIC_DEMO=true` (set on the demo site in the Netlify UI) switches it to a
  neutral identity - Northbridge Financial - and shows a prototype banner.
  The live site leaves it unset and shows FlexiLoans branding.
- Netlify password protection is a paid feature; on free, keep the URL
  unlisted.

## Vercel instead

1. **vercel.com -> Add New -> Project -> Import** the repo.
2. Preset **Vite**, build `npm run build`, output `dist`.
3. Environment variable `VITE_PUBLIC_DEMO` = `true`.
4. Deploy. `vercel.json` is already in the repo.

## Backend API (full-stack mode)

The app runs in one of two modes, chosen at build time:

| Build | `VITE_API_BASE_URL` | Data |
|-------|---------------------|------|
| Offline demo (demo site, `npm run dev`) | unset | In the browser only; demo logins shown on the sign-in page |
| Full stack (live site, Android app) | the API URL | On the server; real sign-in, shared between users |

A full-stack build contains no passwords. The server hashes them (scrypt) on
first start, signs 12-hour session tokens, rate-limits failed logins, and
checks every change against the user's role - an employee cannot approve
leave or see anyone else's requests, whatever the app sends.

Code: `server/app.js` (routes), `server/rules.js` (validation and
permissions), `src/lib/actions.js` (the state changes, shared with the app).

### Hosted: Netlify Functions + Netlify Blobs

Site `flexiloans-hrms-api` -> `https://flexiloans-hrms-api.netlify.app`.
Data is stored in Netlify Blobs; nothing else to provision.

One-time: **Site configuration -> Environment variables -> Add a variable**
`HRMS_TOKEN_SECRET`, scope *Functions*, value: 48+ random characters, e.g. from

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then redeploy (functions only read variables at deploy time):

```bash
netlify deploy --prod --no-build --site flexiloans-hrms-api \
  --dir server/public --functions server/functions
```

Check: `https://flexiloans-hrms-api.netlify.app/api/health` returns `{"ok":true}`.
Until the secret is set every route answers 503 "Server not configured".

### Anywhere else: Node + SQLite

```bash
HRMS_TOKEN_SECRET=... npm run server   # http://localhost:8787, data in server/data/hrms.db
npm run test:server                    # API tests against an in-memory database
```

On Render or similar: start command `npm run server`, Node 22.13+, a
persistent disk mounted where `HRMS_DB` points, `NODE_ENV=production`.

## Android app

Capacitor wraps the full-stack build into a native Android app
(`com.flexiloans.hrms`): bottom navigation, bottom-sheet dialogs,
pull-to-refresh, edge-to-edge layout, the hardware back button, haptics and a
branded splash screen. It talks to the hosted API (see `.env.android`).

### Getting the APK

Every push to `main` runs `.github/workflows/android.yml`, which builds the
APK and publishes it to the **android-latest** release:

```
https://github.com/iamnikhiltembhare/flexiloans-hrms-clone/releases/tag/android-latest
```

Open that on the phone, download `FlexiLoans-HRMS.apk`, and allow installs
from the browser when Android asks. Newer builds install over older ones.

The APK is signed with a committed *debug* key so every build can update the
last. For the Play Store, create a private release key, keep it out of git,
and build `assembleRelease` / `bundleRelease` with it.

### Building locally

Needs JDK 21 and the Android SDK (Android Studio provides both):

```bash
npm run build:android          # web bundle for Android + cap sync
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
npx cap open android           # or open the project in Android Studio
```

`npm run android:icons` regenerates the launcher icons and splash screens
from the logo mark.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173, offline demo, FlexiLoans branding
npm run build
npm run lint
```

For full stack locally, run `npm run server` and start the app with
`VITE_API_BASE_URL=http://localhost:8787 npm run dev`.

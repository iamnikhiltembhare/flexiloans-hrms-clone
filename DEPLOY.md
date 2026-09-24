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
4. Netlify reads `netlify.toml` and fills in the settings itself: build
   `npm run build`, publish `dist`, Node 22, `VITE_PUBLIC_DEMO=true`.
5. **Deploy**. First build takes two to three minutes.

### 3. Name it

**Site configuration -> Site details -> Change site name** ->
`flexiloans-hrms-demo`, giving you:

```
https://flexiloans-hrms-demo.netlify.app
```

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
- `VITE_PUBLIC_DEMO=true` (set in `netlify.toml`) switches the deploy to a
  neutral identity - Northbridge Financial - and shows a prototype banner.
  Remove that variable for a FlexiLoans-branded deploy.
- Netlify password protection is a paid feature; on free, keep the URL
  unlisted.

## Vercel instead

1. **vercel.com -> Add New -> Project -> Import** the repo.
2. Preset **Vite**, build `npm run build`, output `dist`.
3. Environment variable `VITE_PUBLIC_DEMO` = `true`.
4. Deploy. `vercel.json` is already in the repo.

## Local development is unchanged

```bash
npm install
npm run dev      # http://localhost:5173, FlexiLoans branding
npm run build
npm run lint
```

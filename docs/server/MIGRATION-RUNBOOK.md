# MAYA — Vercel → Google Cloud Migration Runbook

Everything runs in project **pro-maya** on the $25K credits billing account.
The frontend keeps calling the same `/api/...` paths — Firebase Hosting rewrites
them to Cloud Run, so index.html needed zero path changes.

**What's in this package**

- `Front End/index.html` — v11.29 (bug fixes + cleanup, see CHANGELOG at bottom)
- `Migration/cloud-run/` — the API service (server.js, package.json, Dockerfile)
- `firebase.json` + `.firebaserc` — Hosting config (sits at the MAYA folder root)

---

## Phase 0 — One-time tool setup (~10 min)

Install on your Mac if you don't have them:

```bash
# Google Cloud CLI  →  https://cloud.google.com/sdk/docs/install-sdk  (or:)
brew install google-cloud-sdk

# Firebase CLI
npm install -g firebase-tools

# Sign both in AS fromsa@manasiyo.com
gcloud auth login
gcloud config set project pro-maya
firebase login
```

## Phase 1 — Deploy the API to Cloud Run (~15 min)

```bash
# Enable the needed services (one-time)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Deploy straight from source — Google builds the container for you
cd "/Users/fromsa/Desktop/MAYA/Migration/cloud-run"
gcloud run deploy maya-api \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 900 \
  --max-instances 5
```

When it finishes it prints a URL like `https://maya-api-xxxxx-uw.a.run.app`.
Check it: `curl <that-url>/healthz` → `{"ok":true}`.

### Set the environment variables

Copy the VALUES from Vercel (vercel.com → project → Settings → Environment
Variables) — they are secrets, so paste them locally, never into chat:

```bash
gcloud run services update maya-api --region us-west1 \
  --set-env-vars "OPENAI_API_KEY=sk-...,GOOGLE_CLIENT_ID=....apps.googleusercontent.com,GOOGLE_OAUTH_CLIENT_ID=...,GOOGLE_OAUTH_CLIENT_SECRET=...,GOOGLE_OAUTH_REFRESH_TOKEN=...,DRIVE_FOLDER_ID=..."
```

(RUNWAY_API_KEY is optional — leave it unset while turntables stay off.
If a value contains a comma, use `--set-env-vars "^@^KEY1=v1@KEY2=v2"` syntax.)

## Phase 2 — Deploy the frontend to Firebase Hosting (~5 min)

```bash
cd "/Users/fromsa/Desktop/MAYA"        # where firebase.json lives
firebase deploy --only hosting
```

→ live at **https://pro-maya.web.app**

### Make Google Sign-In work on the test domain (one-time)

1. console.cloud.google.com → APIs & Services → **Credentials** → your OAuth
   **Web client** → add to *Authorized JavaScript origins*:
   - `https://pro-maya.web.app`
2. Firebase console → **Authentication → Settings → Authorized domains** —
   confirm `pro-maya.web.app` is listed (it is by default) and **add
   `maya.manasiyo.com`** now so the DNS flip later needs no auth change.

## Phase 3 — Full test on pro-maya.web.app

Sign in → generate a design → modify it (watch for the old 400) → favorite →
fabrics → submit (check the Drive folder gets one-pager.pdf) → reload (session
restores) → open on a second device (cloud restore).

Watch API logs live while testing:

```bash
gcloud run services logs tail maya-api --region us-west1
```

(OpenAI errors now log their REAL reason — no more anonymous 400s.)

## Phase 4 — Point maya.manasiyo.com at Firebase (~10 min + DNS wait)

1. Firebase console → **Hosting → Add custom domain** → `maya.manasiyo.com`
2. It gives you records — typically a TXT (verification) then an **A record**
   (or CNAME for subdomains)
3. Wix → your site → **Settings → Domains → manasiyo.com → Manage DNS records**:
   - DELETE the existing record(s) for the `maya` subdomain that point at
     Vercel (`cname.vercel-dns.com` or 76.76.21.x)
   - ADD the records Firebase gave you
4. Back in Firebase Hosting, wait for status → **Connected** (cert can take
   minutes to a few hours). Vercel keeps serving until DNS propagates — no
   downtime window.

## Phase 5 — Decommission Vercel (after ~1 clean week)

- vercel.com → project **project-byqm1** → Settings → delete (or just leave it
  paused). The env vars there are your backup copies of the secrets — export
  them somewhere safe (password manager) BEFORE deleting.
- The `/ _vercel/insights` scripts are already removed from index.html.
  If you want analytics again: Firebase console → Analytics, or ask me to wire
  GA4 in.

## Rollback at any point

DNS is the only switch that affects users. To roll back: restore the old
Vercel records for `maya` in Wix DNS. Everything else (Cloud Run, Hosting)
can sit deployed and unused, costing ~$0.

---

## index.html v11.29 CHANGELOG (this package)

1. **Fixed the Storage re-upload loop** — `_uploadedToCloud` was set but never
   checked; every edit re-uploaded every image. Now checked; images upload once.
2. **Fixed Submit fake-success** — PDF renders BEFORE the Drive folder is
   created; a failed/missing PDF now aborts with a clear error instead of
   showing the thank-you overlay over an empty folder. Success now requires
   ≥1 uploaded file.
3. **New: "Cloud sync is offline" toast** — first sync failure shows one
   visible warning instead of dying silently in the console.
4. **New: Storage cleanup** — deleting a card now deletes its uploaded image
   from Firebase Storage (deleteImage existed but was never called).
5. **Deleted the retired splash gate** (~300 lines total: markup + CSS + JS,
   including the hardcoded '8088' password) and other dead code
   (maybeAskModifyImageRef, seedMoodboard stub, unused favorites/session
   Firebase helpers, STORAGE_KEY_API).
6. **Perf: html2canvas + jspdf no longer block first paint** — they lazy-load
   the first time a PDF is actually rendered (~400KB less blocking JS).
7. **Removed Vercel Analytics/Speed-Insights scripts** (dead after migration).
8. All three inline script blocks pass `node --check`; live-site version
   confirmed v11.27 before these changes (no v11.28 video code overwritten).


## v11.43 — Backend dashboard (added by Claude)

- New page: https://maya.manasiyo.com/admin.html — sign in with fromsa@manasiyo.com
  or worldofsiyo@gmail.com. Shows live submissions from Drive + Google Analytics
  traffic + status lights. Auto-refreshes every minute.
- New API endpoints in cloud-run/server.js: /api/admin/submissions, /api/admin/analytics
  (admin emails only; override list via ADMIN_EMAILS env var).
- To activate after any server.js change, run from the Mac:

```bash
gcloud services enable analyticsdata.googleapis.com analyticsadmin.googleapis.com --project pro-maya
cd ~/Desktop/MAYA/Migration/cloud-run
gcloud run deploy maya-api --source . --region us-west1 --project pro-maya
```

- Traffic numbers additionally need (one time, in Google Analytics → Admin →
  Property access management): add the Cloud Run service account as Viewer —
  the admin page shows the exact email to add until it's connected.

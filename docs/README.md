# MAYA — Docs

Master record for MAYA: what it is, how it looks, how it's built, where it's going.

## Folder layout (reorganized Aug 5, 2026)

```
MAYA/
  index.html          The client-facing consultation app (maya.manasiyo.com)
  status.html         Status page: lights, traffic, submissions, prompting engine, all links
  backend.html        The Backend: Brief screen + Operating Room (pattern pipeline)
  aesthetics/         Everything visual and every static the site serves:
    ui/               logo, background, favicon + apple-touch-icon (browser tab / home-screen icons)
    fabrics/          swatches + fabrics.json
    headshots/        avatar headshots
    operations/       the Operating Room engine backend.html embeds (+ kb.js, tests-data.js)
    Aesthetics.pdf, one-pager-preview.html
  docs/               Everything written + all config
    backend/
      operating-room/ Pattern R&D hub: indexer.py, manufacturing/, self-study/, tests/
    server/           Google/Cloud Run: server.js, Dockerfile, rules, MIGRATION-RUNBOOK.md
    firebase.json     Hosting + rules config (deploys run from the docs folder)
```

## What lives in docs/

| File | What it covers |
|---|---|
| `Vision.pdf` | The why. Imagination to laser cutter. |
| `Spec.pdf` | The what. MAYA's surface behaviour, non-technical. |
| `Architecture.md` | The how (v10.18 era; predates the Firebase migration, update pending). |
| `Strategy-A.md` | The grounded pattern pipeline strategy. |
| `backend/operating-room/` | The pattern-making R&D: indexer.py (rebuilds kb.js from the Pattern Book), manufacturing code, self-study, tests. |
| `server/` | The live API service (Cloud Run, project pro-maya) and the migration runbook. |

## Deploying

Frontend (from the docs folder, where firebase.json lives):

```bash
cd ~/Desktop/MAYA/docs
firebase deploy --only hosting
```

Rules (after editing docs/server/*.rules, also from the docs folder):

```bash
cd ~/Desktop/MAYA/docs
firebase deploy --only firestore,storage
```

API (after editing docs/server/server.js):

```bash
cd ~/Desktop/MAYA/docs/server
gcloud run deploy maya-api --source . --region us-west1 --project pro-maya
```

## Where things run

Everything is on Google, project **pro-maya**: Firebase Hosting (frontend),
Cloud Run (API), Firestore + Storage (data), Drive (submissions).
Vercel and the GitHub repo are retired.

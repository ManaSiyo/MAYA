# Working on MAYA

Read README.md and design.md here, then inspect Git status and recent commits.
This file replaces the old root AGENTS and repeated historical instructions.
The owner requested this location and the November 5 repository consolidation.

- Preserve one account → many sealed projects. Pin account, project, garment and
  request identity across async work; stale results never replace current work.
- Never touch credentials, tokens, billing or production environment settings.
- Ask for fresh explicit permission before each personal Chrome access session.
  MAYA and Worldofsiyo profiles are separate. Prefer isolated browser tests.
- Make the requested change, verify it, update README's current state and the
  single CHANGELOG, then commit completed work locally. Never Push or amend
  without explicit instruction. Production deploys from pushed maya-v2.
- Do not send messages, initiate calls, retry uncertain sends or weaken reviewed
  confirmation gates. Owner SMS SEND remains a raw, recipient-bound confirmation.
- Shared images own independent copies. Deletes use durable tombstones and
  generation checks; failed reads never become empty replacement stores.
- Keep necessary legacy migration/Storage cleanup code until migration is proven.
  Retired files live under _to_delete for the owner's final removal; do not restore
  them as active features. Node dependencies are intentionally retained.
- Fabrics has one backend module, server/fabrics.mjs: one OpenAI Responses image
  search, up to ten source-linked photos. Do not restore the retired retailer feeds,
  scraping, custom candidate ranking or generated swatch paths. No invented
  URLs/facts, arbitrary server fetches or automatic paid retry. In House and Global
  use exactly the same gallery layout.
  Known exclusions retract results and private caches. Preserve cancellation and
  the WeakMap holding Node20 combined abort-signal sources.
- Uploaded/camera avatars save automatically; a photo can visualize without
  measurements. No Avatar Save button. Voice preparation has a 20-second
  cancellation-safe deadline and stops late microphone tracks.
- Public pages never expose provider diagnostics, notification dumps or Insights.
  Functional action errors stay brief. Fabrics has one bottom status line:
  “Searching for Fabrics”.
- Use Aesthetic Control for every visible change: existing roles, Glass, Inner,
  Drawer, fields, icons and scrollbars. Page CSS controls layout only. Add a
  working preview for new UI; test defaults and changed saved values at phone,
  tablet and desktop widths. Presentation verification is the final gate.
- Run `node docs/check.mjs` (Node20 in release). It covers packaging, core
  authorization/storage/communications, image routing, project races, fabric
  deadlines, and browser acceptance. Use `MAYA_BROWSER=webkit` locally for iOS.
  Extend these consolidated checks for changed behavior; avoid another historical
  test tree. Test dependencies must install successfully; no skipped release gate.
- Local success does not prove deployment or provider performance. After owner
  Push, compare release.json, page build stamps and API health to the full commit.
  Vercel checks do not establish Firebase/Cloud Run success.

Runtime: frontend/index.html, backend/*.html, backend/server/*. Shared assets and
Aesthetic Control: docs/aesthetics. build-site.mjs publishes only an explicit
public tree; never expose all of docs or backend/server. Keep .firebaserc unchanged.

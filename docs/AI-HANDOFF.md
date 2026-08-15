# MAYA shared handoff

This is the current agent-neutral handoff for Claude and Codex. Keep it short
and replace stale task details instead of turning it into another history log.

## Current repository state

- Product version: `13.23`
- Production branch: `maya-v2`
- Local working folder used by Fromsa: `~/Desktop/MAYA-new`
- Codex release clone: `MAYA-codex-release` in the current Codex workspace.
- Release status: v13.23 commits are local, not pushed. Both fetch and push
  failed because the Codex sandbox could not resolve `github.com`; production
  is still the previous version until GitHub Desktop pushes this release clone.
- Deployment: pushes may trigger Cloud Build, but `cloudbuild.yaml` now refuses
  production deployment unless `BRANCH_NAME` is exactly `maya-v2`.
- Commit convention: `[Claude][v13.xx] Description` / `[Codex][v13.xx]
  Description`. One category per commit. Push only when Fromsa explicitly asks.

## Continuity map

- `README.md`: stable architecture, data model, deployment, and operating rules.
- `requests.txt`: Fromsa's requests and noticed bugs, newest first, timestamped.
- `fixes.txt`: incidents and changes that may not exist in Git history.
- `history.txt`: concise product narrative and shipped milestones.
- `docs/AI-HANDOFF.md`: only the current task and the exact next step.
- `docs/CODEX-handoff.md`: archived v12.9 technical review; not current state.

## Current direction

- Claude and Codex are interchangeable. The repository, not chat memory, is
  the shared record. Do not let both agents edit `index.html` concurrently.
- Keep `maya-v2` as the only release branch. Agent work branches are safe from
  production deployment only because the build guard now rejects them.
- Tests before any handoff: server syntax/static checks, inline-script parsing,
  `tests/smoke.mjs` when dependencies and sockets are available, and
  `tests/app-regression.mjs` when Chromium can launch.

## Next safe work

1. In GitHub Desktop, add/open this `MAYA-codex-release` clone and click **Push
   origin** on `maya-v2`; do not make another commit. Then verify Cloud Build
   deployed v13.23 and the Firebase rules step is green.
2. Sign into Systems Map and confirm `/api/healthz/deep` plus Latest
   Submissions. If Drive is red, renew the Cloud Run OAuth refresh token; code
   now exposes the sanitized provider reason but cannot repair credentials.
3. Before a public launch, replace per-instance memory rate limits with a
   durable per-uid quota and add a generation queue/backpressure path.
4. Run both runtime suites from `~/Desktop/MAYA-new`, where dependencies and a
   permitted Chromium runtime are available.

## Latest completed work

- [Codex] Aug 14, v13.19-v13.23: Systems Map public/API/image checks now run in
  parallel; Drive token and listing calls time out; the admin submissions feed
  uses a short cache and bounded detail fanout; failure text names the safe
  provider reason instead of pretending sign-in is missing.
- Community publishing records the actual generation model, rules accept only
  `gpt-image-2`, explicit uploads/other models are hidden, a realtime listener
  replaces polling, and changed URLs repaint instead of leaving ghost cards.
  This is app-level provenance only: a hostile Firebase client can still lie
  about `model`; cryptographic trust requires server-side publishing.
- The whole fabric library no longer downloads at startup. The OpenAI proxy
  rejects bodies above 24 MB and streams successful output instead of buffering
  it. A Cloud Build guard blocks production deploys from non-release branches.
- Critical sealed-bin fix: every queued project write, image upload, snapshot,
  tombstone and index mutation is pinned to the uid that started it. Auth
  transitions serialize teardown before new-account boot. Remote equality now
  includes all visible card fields and exact positions, so a newer cloud board
  is not mistaken for the same state. Legacy recovered sessions are scanned and
  permanently tombstoned when their migrated project is deleted.
- Sign-out now waits for Firebase Auth to finish before rendering another sign
  in, every Drive read/write has a bounded wait, and deep health distinguishes
  a slow provider from revoked authorization.
- Reversible Systems Map typography/tap-target cleanup lives only in
  `aesthetics/ui/status-v13.19.css`; Community layout was not restyled again.
- Validation available in the Codex sandbox: server and inline JavaScript parse,
  JSON/config plus the source-level regression assertions pass, and diffs are
  clean. The full `tests/app-regression.mjs` runtime is blocked by the Chromium
  sandbox; server smoke is blocked because Express is unavailable and socket
  binding is denied.

## Open launch risks

- Rate limiting is process memory, so every Cloud Run instance and restart gets
  a fresh counter. This is not a cost boundary for 1,000 public users.
- Drive is one OAuth account and one folder: it remains an operational single
  point of failure and its exact usage is not visible without signed-in metrics.
- Each project and the project index are single Firestore documents with a
  1 MiB ceiling. Concurrent edits are safely rejected but have no Reload cloud
  / Save as copy resolution UI.
- Community loads up to 120 documents per fresh session. Budget and App Check
  enforcement are required before broad anonymous acquisition.
- Legacy session/IndexedDB migration code remains intentionally. Measure
  migration completion before deleting the estimated 700-1,200 legacy lines.

## Previous completed work

- [Claude] Aug 14: three commits prepared and verified, awaiting Fromsa's
  pull of `4278925` and per-batch commits:
  1. `[Claude][v13.11]` Community wall rebuilt: three drifting rows, whole
     three-view renders uncropped, one-third larger, one garment shown once
     (fingerprint dedupe by inspirationId+version keeps the ORIGINAL when a
     shared copy is hearted by another account), visions only on the wall,
     silent 30s background refresh that never moves the rows.
  2. `[Claude][v13.12]` Security, per the Codex audit priority one: inline
     onclick removed from wall cards (delegated listeners, id validation),
     `_safeImgSrc()` gate on every picture address that reaches markup
     (board cards, fabric grids, pickers, share import), shares collection
     locked to GET-by-token (list denied except owner's own), shares carry
     `pid` and are revoked when their project is deleted.
  3. `[Claude][v13.13]` Dedicated `maya-favorite-pulse`: 4.6s,
     cubic-bezier(.45,0,.55,1), halo reach reduced ~15% (16px→13.6px,
     3px→2.55px spread), constant black depth shadow, reduced-motion
     disables it. `maya-vision-pulse` untouched. The opacity-layer halo
     variant Codex suggested is deferred; keyframed shadows kept for now.
- Validation: 13 inline script blocks parse clean; app regression suite all
  green (28 checks, including new security assertions: picture gate and no
  inline wall handlers); server smoke all 16 green.
- Known risk: none open in the delivered batches; audit priorities two and
  three are untouched and listed above.
- Exact next step: after these three commits land, start isolation work
  (item 1 above) as `[Claude][v13.14]`.

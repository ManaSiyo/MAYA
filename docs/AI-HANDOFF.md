# MAYA shared handoff

This is the current agent-neutral handoff for Claude and Codex. Keep it short
and replace stale task details instead of turning it into another history log.

## Current repository state

- Product version: `13.18`
- Production branch: `maya-v2`
- Local working folder used by Fromsa: `~/Desktop/MAYA-new`
- Deployment: a GitHub push triggers Cloud Build, Cloud Run, Firebase Hosting,
  and Firebase rules deployment.
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
- Do not push partial work; every branch pattern deploys to production.
- Tests before any handoff: `tests/smoke.mjs` (server, 16 routes) and
  `tests/app-regression.mjs` (both pages, needs Playwright).

## Next safe work

1. Verify Cloud Build deployed v13.18 and the Firestore rules step is green.
2. Run the browser regression in an environment that permits Chromium launch.
3. Rewire the backend pattern window before removing its hidden legacy room.

## Latest completed work

- [Codex] Aug 14, v13.15-v13.18: closed the second-eye regressions left in
  v13.14. Hostile wall/share values are sanitized; late voice, fabric and
  community operations keep their initiating account/project; stale saves
  block destructive navigation; sign-out cancellation blocks update reloads.
- Project deletion now batches the project, permanent tombstone, wall posts
  and share links atomically. Storage paths remain on the tombstone until
  cleanup succeeds. My Fabrics keeps the same durable cleanup queue.
- Systems Map checks use timeouts and request generations, signed-in token
  changes immediately rerun deep health, and thumbnails load in parallel.
- Community cards now match inspiration: quiet glass, no white column glow,
  hover/focus metadata, 320px cards and three left-to-right rows. Favorites
  animate only halo opacity with about 15 percent less reach.
- Validation available in the Codex sandbox: all inline scripts and server
  JavaScript parse, JSON/config files parse, static regressions pass, and the
  diff is clean. Full Playwright is blocked by the Chromium sandbox; server
  smoke cannot run in the isolated clone because Express is not installed.

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

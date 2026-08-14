# MAYA shared handoff

This is the current agent-neutral handoff for Claude and Codex. Keep it short
and replace stale task details instead of turning it into another history log.

## Current repository state

- Product version: `13.14`
- Production branch: `maya-v2`
- Local working folder used by Fromsa: `~/Desktop/MAYA-new`
- Deployment: a GitHub push triggers Cloud Build, Cloud Run, Firebase Hosting,
  and Firebase rules deployment.
- Commit convention: `[Claude][v13.xx] Description` / `[Codex][v13.xx]
  Description`. One category per commit. Fromsa is the only one who pushes.

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

## Next safe work (from the Codex audit of Aug 14, in order)

1. Project isolation: `_opContext()` / `_opStillValid()` around Modify,
   Switch Fabric, uploads, and voice extraction; key the My Fabrics cache by
   UID and clear it on every auth transition; clear the favorites scroller on
   board and auth clears.
2. Deletion and saving: durable ownerUid/projectId on community docs and
   project-scoped cleanup queries; serialize publish/unpublish per card;
   tombstone plus delete in one batch; stop Sign out / New / switch / share
   import when `flush()` returns false; treat stale revisions as conflicts;
   fix the false "saved on this device" message.
3. Cleanup (only after the above): duplicate Operations files, hidden legacy
   Operations Room in backend.html, confirmed no-caller functions. Do NOT
   delete `_rescueLegacyProjects()` or legacy Storage cleanup yet.

## Latest completed work

- [Claude] Aug 14, 10:30 AM: everything below ships together as v13.14 at
  Fromsa's request (single push, he commits). Wall rebuild (v13.11),
  security batch (v13.12), favorites glow (v13.13), and the full audit
  priorities two and three plus cleanup (v13.14):
  - Isolation: `_opContext`/`_opStillValid` now guard Modify, Switch
    Fabric, and inspo uploads; My Fabrics cache keyed by UID with resets on
    both auth transitions and still-me checks after every await; favorites
    scroller cleared in `_doClear` and re-rendered after hydration.
  - Deletion/saving: community posts carry durable `uid`+`pid` and project
    delete sweeps them by query (plus the old card path); publish/unpublish
    serialized per post with `favorited` rechecked and orphan uploads
    deleted; project delete = one Firestore batch (doc delete + tombstone)
    then Storage GC; `flush() === false` now blocks sign out, New, avatar
    switch and share import behind a confirm; stale revision toast tells
    the truth; "saved on this device" wording replaced everywhere; a
    beforeunload guard warns when closing with unsaved work while offline.
  - Cleanup: ten confirmed no-caller legacy functions deleted
    (idb session cluster, `_syncSavedSessionToCloud`,
    `_cloudifyItemsForFirestore`, `_firebaseSyncSession`, tombstone-ledger
    trio); `_freshStartWipe`/`window.mayaFreshStart` unwrapped to top level,
    fixing the documented console command.
  - Deliberately NOT done: Operations file consolidation (Fromsa keeps the
    beta separate by design), backend.html hidden legacy room removal
    (patterns render into it; rewire first), full reload/duplicate/cancel
    conflict UI (honest toast shipped instead).
- Validation: 13 script blocks parse clean; app regression 30 checks green;
  server smoke 16 green; runtime-verified mayaFreshStart defined and dead
  functions absent.
- Exact next step: backend.html pattern window rewiring so the hidden
  legacy room can be removed, then the conflict dialog.

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

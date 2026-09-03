# MAYA vision spec — handoff for Claude / Codex

Source: Fromsa, Aug 25 2026. This is the running build list. Ship top-down.
Contract rules in AGENTS.md/CLAUDE.md still apply (version lockstep across 4
surfaces, one assertion per shipped item, Fromsa presses Push).

The north star: **Maya is the Mana Siyo intelligence layer** — the brain, not a
metrics reader. The voice is just the first surface; it will go front-facing
later. Right now it's internal, for Fromsa and his team.

---

## SHIPPED (v13.82–13.83)

- Daily ad clicks (today vs yesterday) in Maya's snapshot, briefing, show_panel.
- Dynamic Lead Station foundation: Wix + hand-added leads merge, source-tagged
  ("WIX"/"added"), notes editable by Fromsa and Maya (note_lead).
- Identity + people (Fromsa, Paula), soul file (maya/soul.md), journal tool,
  feature log (log_feature → maya/features.json), internal Google Sheet reader
  (read_team_sheet — LIVE, sheet "2026" with all tabs).
- v13.83: Lead header "Reach them"→"Email"; "Latest submissions"→"My
  submissions"; fabric spec no longer repeats words already in the name.

---

## 1. LEAD STATION — make it a real dynamic, modifiable screen

- [~] It's a custom screen, not a Wix mirror: pulls Wix records but is fully
  modifiable, and clearly shows where each lead came from (source tag — done).
- [ ] "Latest Notes" = **last-touchpoint** notes, constantly refreshing/live.
  Poll or push so a note Fromsa or Maya adds shows within seconds without a
  manual reload. (Today it refreshes on the 120s panel cycle.)
- [~] Fromsa talks to Maya ("here's what happened with X") → Maya updates that
  lead's note by voice. add_lead + note_lead exist; make the loop feel instant
  and always land on the right lead.
- [ ] Acceptance: I can run the whole station by voice — add a lead, update its
  last touchpoint, and see it live — and by hand.

## 2. ADMIN LAYOUT

- [ ] Merge **Sources of traffic + Maya + The Bottom Line** into ONE larger
  shell (one panel, shared heading), instead of three stacked folds.
- [ ] Add a larger gap between **Ad Campaigns** and the section above where it
  starts; and reduce the vertical height of the top bar / marquee a little.
- [x] "Latest submissions" → "My submissions".
- [ ] The Admin **drawer should be swipe-able like the frontend** — open/close
  by trackpad swipe on a Mac (two-finger horizontal), same feel as the app.

## 3. MAYA APP (frontend) — Pinterest wall  [SHIPPED v13.84]

- [x] **Pinterest reloads every time** → cached for the session (`_pinPicsCache`,
  `_pinLoaded`, `_pinStatusOk`); switching Fabrics↔Pinterest is instant.
  `_pinReload()` forces a refetch when needed.
- [x] The wall is **edge-to-edge** (compact `#pin-tabs` header, `padding:0`).
- [x] "Bring in" is a **floating, near-transparent overlay** that appears **only
  when items are selected**; label kept as **"Bring in"**.

## 4. MAYA THE BRAIN — architecture (needs Fromsa decisions where noted)

- [ ] **Soul file saved locally on every push** so Claude/Codex read what people
  asked. docs/maya-soul.md exists as the seed; NEXT is auto-exporting the live
  maya/soul.md + maya/features.json into the repo on each deploy (a Cloud Build
  step or a small "export soul" admin action Fromsa runs before push).
- [ ] **Knows who's who, no feedback forms.** Maya recognizes customers,
  teammates, founding members by voice ("this is Paula…") and logs everything
  they ask for automatically — decisions, notes, requests — and relays feature
  asks to Claude. people.json + log_feature are the seed; grow the roster and
  auto-capture in meetings.
- [ ] **Weekly digest**: once a week, send Fromsa everything people asked Maya
  for (from maya/features.json). DECISION: channel = email to worldofsiyo@ via a
  scheduled task? Confirm.
- [ ] **Maya's own API / MCP** — "an MCP for Maya itself." A small MCP server
  exposing Maya's tools (read metrics, read/update leads, read soul, log
  feature, draft email) so Maya (and Fromsa's agents) can call them. DECISION:
  scope + auth. This is the big one; design before building.
- [ ] **Maya reaches Claude + Codex** and can act (send email, update the lead
  station) — the "ultimate secretary." Update-lead-station: yes (confirm-gated).
  Send-email: SAFETY LINE — Claude/Maya must not send mail on someone's behalf
  without an explicit human confirm. Keep the draft→confirm→open-Gmail flow, or
  Fromsa sets up a Maya-owned mailbox + explicit rule he approves. Confirm which.
- [ ] **Front-facing Maya** (customers talk to her too) — later. Same brain,
  new surface. Design permissions so customer Maya ≠ admin Maya.

## 5. New / corrected (Aug 25 PM)

- [x] Rename "Project" → "Projects" with a dropdown caret beside it (v13.85). No
  redesign — the list was just hidden under the title.
- [x] BUG: switching an avatar spawned empty projects — fixed (v13.85).
- [ ] EMAIL, corrected: the log entry "never send from Maya" was a mis-transcription.
  Fromsa WANTS Maya to open a ready-to-send email directly — that's the existing
  draft→confirm→open-Gmail flow. The ONLY line held: no auto-SEND without a human
  click. Make Maya's email opening feel one-tap; keep the click.
- [ ] BUG: Admin "confirm" button for lead-station changes reportedly not working.
  Server lead-note path verified correct (saves + cache-invalidates), so it's
  client-side/repaint on status.html — needs live repro. Check mayaConfirmAction
  + loadMkt repaint after a lead_note/add_lead confirm.
- [ ] Pinterest: put "All saves / Boards" as smaller sub-pills on the SAME row as
  the "Pinterest" title (H1 title, H2 pills, right-aligned), and add a SEARCH box.
  More vertical real estate for the wall. Apply to the real app (not just playground).
- [ ] Affiliate program: set a 5–10% commission per lead brought in (from the log).

## 6. New (Aug 25, later)

- [x] Upload button was invisible — now a visible glass pill, wider + lower (v13.86).
- [x] BUG: delete-project lag caused accidental deletes — row now removed instantly (v13.86).
- [x] BUG: unfavorited pieces stayed on the Favorites screen — fixed (v13.86).
- [ ] DESIGN NOTES aesthetics: group the notes into named CATEGORIES — Fabric,
  Color, Silhouette, Style — each a different color, with a clear H1/H2/H3
  hierarchy. Apply to every place notes already render. NEEDS: confirm the surface
  (the drawer notes panel, the favorite-card dissection overlay, and/or the Brief)
  and do a real design pass (use artifact-design thinking).

## 7. Lead Station custom CRM  [SHIPPED v13.87]

- [x] Delete a lead (manual removed; Wix tombstoned — hidden here, stays in Wix).
- [x] Update any lead (manual in place; Wix via override that survives refresh).
- [x] Every field edits in place like a sheet (name / email / notes), pencil removed.
- [x] Reload + "+ Add lead" controls; WIX badge beside the name (not underneath).
- [x] Maya can add / update / nurture (note) / delete leads by voice (confirm-gated).
- [ ] STILL OPEN: merge Bottom Line + Sources of Traffic into one shell (not done yet).
- [ ] Maya updating the code itself (GitHub) — see the MCP/API item in §4; needs a
  channel + auth decision. Today: Claude edits files, Fromsa pushes.

## 8. New (Aug 25, test session)

- [x] "Hey Maya" wake word on Admin (opt-in toggle) — v13.88.
- [x] Fabrics: "arrives in N days" (relative) + all prices in USD — v13.88.
- [x] Community wall: center every line — v13.88.
- [x] Upload + Tap-to-Listen: REVERSED (v13.89). Fromsa decided against the
  one-row compact pills and asked to revert both to the playground's plain style.
  Upload is now plain text, a touch brighter, hover holds the colour, nudged
  lower. Tap-to-Listen already matched the playground.
- [x] Empty middle of the Projects area → a personal SCORECARD (v13.89): the
  collapsible Stats fold on top of Measurements — a circular credits gauge over
  four tiles (credits left, cards made, favourites, images rendered). Gamified.
- [ ] Cross-project FAVORITES store: a favorited fabric/render stays a favorite
  forever, across projects and accounts (built in backend, surfaced in frontend later).
- [ ] BUG: favoriting pushes/resets the card stack — it should stay put.
- [ ] BUG (again, verify on deploy): unfavorited items must leave the wall/favorites
  (fixed in v13.86; confirm live).
- [ ] Fabric matching combines ALL garments in a brief, not one at a time / capped
  at two slides. Fromsa said "fine for now" — lower priority.
- [ ] FX rates in `_priceUSD` are approximate/hardcoded — swap for a live daily
  rate (small server fetch) when it matters.

## 9. Credits + drawer restructure  [SHIPPED v13.89]

- [x] Per-user **free trial: $2** of image renders, metered server-side; image
  calls blocked at the cap (admins never capped). `GET /api/usage` feeds the app.
- [x] Circular **credits gauge** + four stats (credits left, cards made,
  favourites, images rendered) in a collapsible **Stats fold** on top of
  Measurements, filling the empty drawer space.
- [x] **Out-of-credits popup** on 402, with an Upgrade ($5 ≈ 13 renders) button
  and a "Try popup" dev preview.
- [x] Drawer: top label **"Users"**; **Projects moved beside the name**,
  right-aligned, same dropdown; avatar and Projects independent under one account.
- [ ] NEXT: wire real payments — the $5 top-up (Stripe), ~50% margin, so a paid
  balance adds to the trial. The button is a labelled placeholder until then.

## Priority order

1. Lead Station live/last-touchpoint + Pinterest cache + full-screen wall +
   floating "Bring in" (fast, high-impact UI).
2. Admin layout merge + spacing + drawer swipe.
3. Soul auto-export on push + weekly digest.
4. Maya MCP/API + Claude/Codex reach + expanded email power (design first).

## Safety notes (do not silently cross)

- Never auto-send email without an explicit human confirm.
- Writes stay confirm-gated and visible in the Admin queue.
- Keep the sealed-project rule; never cross project/account data.

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

## 3. MAYA APP (frontend) — Pinterest wall

- [ ] **Pinterest reloads every time** you switch to it (Fabrics stays loaded).
  Cache/persist the Pinterest wall so switching Fabrics↔Pinterest is instant;
  don't refetch unless the user asks.
- [ ] The wall should be **edge-to-edge, full screen**: move the "All saves /
  Boards" header UP onto the same row as the "Pinterest" title (make it
  smaller), freeing the vertical space.
- [ ] "Bring in" CTA becomes a **floating, near-transparent overlay** on top of
  the cards that appears **only when items are selected** (and hides otherwise
  so cards get full space). Keep the label **"Bring in"**. Applies to Pinterest;
  keep the existing "Bring in" for Fabrics too.
- [ ] Acceptance: with nothing selected the wall is full and clean; select 2+ and
  a translucent "Bring in" floats over the cards.

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

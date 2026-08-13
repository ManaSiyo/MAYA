# MAYA

The whole system, written for a fresh conversation. If you are an assistant
picking this up with no memory of what came before, read this file first and
then `history.txt` for the older narrative.

Owner: Fromsa, founder of Mana Siyo.
Live site: https://maya.manasiyo.com
Also read: `history.txt` (the story), `fixes.txt` (fix attempts, especially
ones outside git), `requests.txt` (Fromsa's own asks and noticed bugs, with
status marks; re-verify its entries every session).
Google project: `pro-maya`
Repo: `ManaSiyo/MAYA` on GitHub, working folder `~/Desktop/MAYA-new`
Current version: **13.4** (the number lives in a `maya-version` meta tag in
`index.html`, and the running site's number is the fastest way to tell whether
a push has landed).

---

## 1. What MAYA is

MAYA is a fashion consultation tool. A client talks to it, MAYA turns the
conversation into a moodboard and then into rendered garment visions. The
client hearts what they love and submits it to Mana Siyo. On the atelier side
the submission becomes a Brief, the garment is dissected into its constituent
pieces, and the pieces go into the Operations Room where the pattern pipeline
runs on them.

MAYA is free and stays free. Fromsa is firm on this: the Canva and Fortnite
model, the core tool costs nothing and money comes later from enhancement, not
from a paywall. Do not propose subscriptions or credit gates as the headline
plan. A tip button exists purely as proof that payment plumbing works.

---

## 2. The four screens

| File | What it is | Who sees it |
|---|---|---|
| `index.html` | The MAYA app. Moodboard, community wall, favorites. ~630 KB, everything inline. | Clients |
| `status.html` | The Systems Map. Health lights, traffic, submissions, prompting engine, changelog. | Admins only |
| `backend.html` | The Brief plus the embedded Operations Room. One submission, opened from the Systems Map. | Admins only |
| `operations.html` | The standalone Operations Room, the beta bench for pattern experiments. | Admins only |

`aesthetics/` holds everything visual, including the Operations Room engine
that `backend.html` embeds. `docs/` holds everything else: the server source,
`firebase.json`, pattern R&D, `Vision.pdf`, `Strategy-A.md`, and `_to_delete`
which is the trash can.

### The MAYA app is three vertical screens

Since v13.3 the app scroll-snaps between three sections stacked top to bottom:

```
  screen 0   COMMUNITY   everyone's hearted visions, drifting left forever
  screen 1   MAYA        the moodboard, the home screen, where MAYA opens
  screen 2   FAVORITES   this client's hearted visions
```

`currentScreen` starts at 1, and `_bootScreenObserver` scrolls `#screens` down
by one viewport height before the first paint so the moodboard is what you
land on. Anything that used to test `currentScreen === 1` for favorites now
tests `=== 2`. Swiping right from any of them opens the drawer, which is a
separate horizontal scroll-snap pane, not an overlay.

---

## 3. How a deploy happens

**One action: push origin.** Google reads `cloudbuild.yaml` at the repo root on
every push and runs five steps, taking about four minutes:

1. Build server (Docker, from `docs/server`)
2. Push image
3. Deploy server to Cloud Run (`maya-api`, region `us-west1`)
4. Deploy website (Firebase Hosting, `--only hosting`)
5. Deploy rules (`--only firestore:rules,storage`)

Steps 4 and 5 are deliberately separate. When they were one command a rules
problem took the whole website down with it. Now the site always ships first
and a rules failure is loud but harmless to what is already live.

**Do not conclude a push failed just because the site looks unchanged.** Twice
Fromsa reported "none of the changes applied" and both times the build was
simply still running. Check the version:

```
curl -s https://maya.manasiyo.com/ | grep -o 'maya-version" content="[0-9.]*"'
curl -s https://maya.manasiyo.com/api/healthz
```

`/api/healthz` is public and reports `configured: {openai, drive, fal, stripe}`.
`/api/healthz/deep` is admin gated and actually pings each dependency.

The Cloud Build trigger reads the root `cloudbuild.yaml` (Autodetected) with
branch regex `.*`. `docs/Deploy MAYA.command` still works as a website-only
backup but should never be needed.

---

## 4. The server

`docs/server/server.js`, Express 4, ESM, deployed to Cloud Run as `maya-api`.
Firebase Hosting rewrites `/api/**` to it, so the browser only ever talks to
`maya.manasiyo.com` and never sees a key.

**Routes**

| Route | Purpose |
|---|---|
| `/api/healthz`, `/api/healthz/deep` | health, the second is admin gated with a 5s timeout |
| `/api/openai/*` | proxy to OpenAI, allowlisted paths only |
| `/api/fal/*`, `/api/falstorage/*` | fal.ai proxy, dormant, no key set |
| `/api/runway` | Runway proxy, dormant on purpose |
| `/api/submit` | client submission into Drive, filename allowlist |
| `/api/admin/submissions` | the Drive feed behind the Systems Map strip |
| `/api/admin/subfile` | stream one submission file (Brief) |
| `/api/admin/subthumb` | thumbnail for one submission picture (added v13.3) |
| `/api/admin/savepieces` | write `pieces.json` so a dissection is never repeated |
| `/api/admin/analytics` | Google Analytics numbers |
| `/api/tip` | Stripe Checkout Session |

**Environment variables on Cloud Run**

```
OPENAI_API_KEY          STRIPE_SECRET_KEY       FAL_API_KEY (unset)
DRIVE_FOLDER_ID         RUNWAY_API_KEY (unset)  GA_PROPERTY_ID
GOOGLE_CLIENT_ID        GOOGLE_OAUTH_CLIENT_ID  GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REFRESH_TOKEN
ADMIN_EMAILS            RL_PER_DAY / RL_PER_MIN / RL_ADMIN_PER_DAY / RL_ADMIN_PER_MIN
```

Admin emails default in code to
`fromsa@manasiyo.com, worldofsiyo@gmail.com, prasheeth@step-6.com`.
Rate limit is 50 calls per person per day, images counting as 4, admins 6000.

**Auth** is Google Identity Services. Client id
`90396949475-7cen4909qftr8hf4la86nuhus38isid1.apps.googleusercontent.com`.
ID tokens expire after one hour, so both `index.html` and `status.html` renew
silently five minutes before expiry via `google.accounts.id.prompt()` with
`auto_select: true`. This was the cause of "it tells me to sign in even though
I have signed in."

---

## 5. Where data lives

Nothing is stored on Fromsa's Mac. Everything is online. This was a hard
requirement and the v12.5 cutover exists to enforce it.

**Firestore**

```
users/{uid}/projects/{pid}          one project, everything on its screen
users/{uid}/projectTombstones/{pid} deleted means deleted, permanently
users/{uid}/settings/projectIndex   a small index so listing projects is fast
users/{uid}/settings/avatars, migration
users/{uid}/sessions, favorites     LEGACY, read only, nothing writes here
config/prompting                    shared prompt text, admins write
community/{postId}                  the community wall, added v13.3
```

**Firebase Storage**

```
users/{uid}/projects/{pid}/images/  every picture in a project
projects/avatars/                   client faces, survives a project delete
community/{uid}/                    wall copies of unsaved pictures, added v13.3
```

**Google Drive** holds client submissions, one folder per submission under
`DRIVE_FOLDER_ID`, containing `one-pager`, `dream-garment`, `summary.json`,
`pieces.json`, `moodboard.json`, `hero.*`, `face.*`.

Rules live at `docs/server/firestore.rules` and `docs/server/storage.rules`
and publish with every deploy.

---

## 6. `projectStore`, the part that matters most

Fromsa lost a client's project once. The cause: naming a project from Save
wrote to IndexedDB only, while the screen said "Saved". Everything about
`projectStore` in `index.html` now exists to make that impossible.

Key members: `currentId, revision, _lastWrote, _openSeq, _flushing, _flushP,
autoName, _chain, _unsub, _dirty, _t, _idxCache, _idxTs`.

- `flush()` is the barrier before leaving a project. It **returns whether the
  save succeeded**, and callers must respect that answer.
- `open(id)` claims `_openSeq` **before** flushing, so a second open cannot
  race the first, and if the flush failed it asks before discarding work.
- `_commit(myId)` clears `_dirty` on the stale-revision path and returns early
  when already flushing. Without this, `open -> flush -> save -> stale ->
  open` recursed forever.
- `_cardSig(c)` dedupes by content, deliberately reading
  `String(c.imageUrl || c.image || '')` in that order. Card ids are reassigned
  on every restore and are useless for identity.
- `_paintItems(list)` is the single painter used by both `open` and the
  realtime listener. It skips duplicate signatures and ghosts.
- `_boardEpoch` guards every delayed placement so cards scheduled before a
  clear cannot land after it.
- `_opContext()` / `_opStillValid(ctx)` reject any async result whose project,
  board epoch or auth session changed while it was in flight.
- Asset deletes queue as `{path, project}` and drain only for their own
  project, after a successful save.

Anything that mutates the board must persist. `pinterestLayout`,
`stackInspirationImages` and the resize handle all used to change the canvas
silently and were fixed.

---

## 7. The community wall (v13.3, newest work)

Hearting a vision publishes it to a shared collection; taking the heart back
removes it, document and picture both.

- Screen 0, above the moodboard. Drifts left forever at 26 px per second,
  paced by the clock, pausing while the pointer is over it and for 2.5s after
  a touch.
- The list is painted at least twice and the scroll position wraps at a
  measured period, so there is no seam. On a wide screen with few posts more
  copies are appended until a full period is actually scrollable.
- **Browsers round `scrollLeft` to whole pixels.** Reading it back and adding
  a fraction each frame moves nothing at all, forever. The true position is
  kept as a float in `_pos` and written out; the reading is only consulted to
  notice a manual scroll. This cost an hour, do not undo it.
- Pictures: a saved render already lives in Storage and its download URL
  carries its own access token, so any signed in account can display it with
  no copy. An unsaved render is still a `data:` URL, so that one is shrunk to
  900 px and uploaded to `community/{uid}/`.
- `card._communityId` remembers the document id **on the card**, which is
  saved with the project. Without it the id would be recomputed from the
  picture's address, and that address changes the first time a project is
  saved, so un-hearting a day later would delete nothing.

**Open question Fromsa has not answered:** every heart is now public. Only the
picture and a first name go up, no client name, but a real client's garment
does reach a wall other people can see. If he wants hearting to stay private,
split publishing into a separate "share to community" action.

---

## 8. Everything fixed, by symptom

Written this way because Fromsa reports symptoms, not causes.

**"Twenty four copies of the same card"** Four separate causes. Orphan items
with no DOM element were saved and restored as real cards. Nothing deduped on
save. Nothing deduped on load. And `setTimeout` placements survived a clear.

**"The same fabric over and over"** `placeItemUnique` checked for a duplicate
title synchronously but placed on a delay of up to seconds, so a whole batch
checked against a board none of them had landed on. Fixed with `_pendingTitles`
claimed at queue time.

**"The heart never works"** The drag guard used
`e.target.classList.contains('fav-btn')`, but the heart is a button containing
an SVG, so clicking its middle hit the SVG, the guard missed, a drag started,
pointer capture ate the click. All five guards now use `closest()`.

**"The X on a stacked group does nothing"** Stacking gave later siblings a
higher z-index, covering the top right corner of each card where the X lives.
Reversed to `100 - idx`.

**"The screen refreshes every five seconds"** A broken image retried forever,
hiding and re-showing its card and rebuilding the favourites strip each time.
Also the Firestore listener did not check `metadata.hasPendingWrites`, so MAYA
reacted to its own saves as though a second device had made them.

**"Drag and drop is janky"** `transition: all 0.2s` on cards animated position
and the backdrop blur on every pointer move. Now only colour and shadow, and
nothing at all while dragging.

**"It asks me to sign in when I am signed in"** Google ID tokens last one hour
and nothing renewed them.

**"Dissection costs credits every time I open a client"** Opening a submission
used to spend six image calls before anyone asked. It is now a deliberate
"Begin Dissection" button beside Full view, and the result is written to
`pieces.json` in Drive so a client is never dissected twice.

**"The latest submission is missing from the Systems Map"** Two rounds. First
the empty state was hidden before the signature guard and restored after it.
Then in v13.3, the tiles pointed straight at `drive.google.com/thumbnail`,
which only draws a picture for files shared publicly, so every private
submission left an empty square. They now come through `/api/admin/subthumb`
with the admin token in a header and a blob URL on the `<img>`.

**The one that would have killed everything.** In `server.js`,
`const isImage = ...upstreamPath...` was written one line **before**
`const upstreamPath = ...`. A temporal dead zone throw on every OpenAI call,
and because Express 4 does not catch async rejections, every request would
have hung until a 504 rather than erroring. It was found only by booting the
server. That is why `tests/smoke.mjs` exists.

---

## 9. Testing

```
cd docs/server && npm install && node ../../tests/smoke.mjs
node tests/app-regression.mjs      # from the repo root, needs Playwright
```

`app-regression.mjs` boots index.html and status.html headlessly and asserts
every behavior Fromsa has signed off in `requests.txt` (stacking, layering,
fabric tabs, fold order). Add an assertion whenever a request is completed.
Run BOTH before telling Fromsa to push.

Boots the real server and asserts status codes on 16 routes. It cannot prove
the app is correct but it catches the class of mistake above. **Run it before
telling Fromsa to push.**

For the app itself, a headless Chromium pass catches boot errors, screen
homing, drift, wrap, hover pause and the Escape chain. Serve the folder on a
port and drive it with Playwright. Firebase auth will not complete, but a
sign-in overlay covers the page, so drive the UI by calling functions directly
rather than by clicking.

---

## 10. Money

- **Stripe is live and configured.** `/api/tip` creates a Checkout Session
  through the REST API, no npm dependency. Account `acct_1QEOw7FMo6M3sCBh`.
- Fromsa is on **`sk_live_` / `pk_live_` keys**, so the tip button moves real
  money. `sk_test_` would not. A publishable `pk_` key is safe to show; the
  `sk_` key must never leave Cloud Run.
- Stripe takes 2.9% plus 30 cents per transaction. On a $1 tip that is a third
  of it.
- A render on `gpt-image-2` at quality `medium`, size `1536x1024`, costs about
  6.5 cents including the anchor inputs. Do not conflate that with the Stripe
  fee; that mistake was made once and corrected.
- Written up in `MAYA-money-plan.md` and `MAYA-cost-economics.md` if those are
  still in the folder.

---

## 11. How to work with Fromsa

These are not preferences, they are conditions.

- **Never touch his credentials.** Not GitHub passwords, not API keys, not
  tokens. If a prompt asks for one, tell him to press Ctrl+C and paste it
  himself.
- **Never take over his screen.** He rejected full computer control
  explicitly. In-browser JavaScript through Control_Chrome is the accepted
  channel; `computer_*` takeover is not.
- **Mark every action he has to take with a green circle 🟢.** He scans for it.
- **Keep replies short.** He has said "I'm not reading this, what's the next
  step?" Lead with the answer.
- **No em dashes or en dashes in anything that appears on the site.**
- He pushes; you do not have his git credentials. Prepare the commit, hand him
  the command.
- He runs OpenAI Codex reviews in parallel and pastes the findings. Treat them
  as a real second reviewer, not a threat.
- **Verify every edit landed.** A Python edit block once ended in `print`
  instead of writing the file, and a parameter was declared on callers but
  never added to the function. Codex caught it. Grep after every edit.

---

## 12. Still open

- The rules deploy step has never been confirmed green in front of an
  assistant. If the community wall loads empty with a permission error, that
  is where to look.
- My Fabrics, a cloud backed personal fabric library.
- A single overlay and surface controller instead of scattered modal state.
- Persistent card `z` layering with deterministic version ordering.
- A Stripe credits ledger with an idempotent webhook, if monetization ever
  moves past the tip.
- Front, back and side renders for each dissected piece.
- Fabric sourcing that actually shops, real purchasable matches.
- `projectStore.reconcile()` still downloads every project in full. It is
  gated to drawer-open and once every two minutes, but a metadata-only index
  would be better.
- `dedupeSweep` is an O(n squared) title comparison every ten seconds during a
  consultation.
- No emulator tests cover New, save failure, two devices, delete, or sign out.
  Those would have caught most of section 8.
- Make the GitHub repo private. Advised, not confirmed done.
- There are stale `.git/lock-*.stale` files in the repo from a tool that
  could not delete them. Harmless, delete when convenient.

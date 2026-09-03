# MAYA voice agent: the understanding problem
### A brief for Codex (or any second engineer), written Aug 29 2026

## 1. What Fromsa is going through, in plain words

Maya is the voice consultant inside maya.manasiyo.com. She can already do a
lot: 44 tools, she sees the screen, she walks the app, she logs her own
failures. The problem is not capability any more. The problem is
comprehension.

Here is the actual experience, from a real session tonight:

- He opens a picture (a red fur bomber over bronze crocodile flares) and
  starts talking to it: "change this, make that longer, put it in a trench
  coat." Maya agrees. She says she understands. Then nothing renders. The
  new version never appears.
- He asks her to go back to the previous version of the piece he is looking
  at. Instead of stepping back one version of the same garment, she swaps to
  a completely different card.
- He says "make it a trench coat." He likes the fabric. He said nothing about
  fabric. Maya opens the fabric chooser popup (in house or sourceable) and
  makes him tap. Same with references: a popup he never asked for.
- He describes a card out loud, the way a person describes a picture, and she
  opens the wrong one.
- The screen shows OPENAI ERROR: 403 under the picture. Maya says nothing
  about it. She does not know it happened.
- She logged some feature requests herself, but the logs were not accurate.

His summary, which is the requirement: **a five year old should be able to use
Maya.** Everything should be reachable by voice, with no button pressing, and
she should not need to be talked to carefully.

## 2. What is already fixed in v14.13 (do not redo this work)

I traced each complaint to a specific cause and shipped fixes. Codex should
read these first so the second pass builds on them instead of repeating them.

| Symptom | Root cause | Fix in v14.13 |
|---|---|---|
| Agrees to changes, never renders | The `visualize` tool always called `visualizeGarment()`, the HOME SCREEN flow. Inside an open picture that path stops on the avatar check or the fabric mode picker and waits for a tap. Nothing rendered because nothing could. | New `modify_garment(text)` tool pushes the spoken change into `visualizeModifications` and calls `modifySubmit()`, which applies directly with no popups. `visualize` is now context aware: inside an open picture it renders THIS piece. |
| "Previous version" swaps the whole card | `viewer` next/prev mapped to `_favStep()`, which steps through the FAVORITES strip (different garments). Version stepping is `viewerStep()`. | New `card_version(direction)` tool using `viewerStep`; `_pgStep()` helper routes arrows to versions when the version nav is live, favorites only in the favorites submit view. |
| Fabric popup on a design change | Same root cause as row 1: the home screen flow ends at `openFabricMode()`. | `modify_garment` never touches it. Instructions now say: only touch fabric if they say fabric, material, or name a cloth; only touch references if they say reference, image, or pin. |
| Wrong card opened | `_pgFindCard` was a flat word overlap over captions. No deixis, no position, no recency, no tie detection. | Rewritten `_pgFindCardDetailed`: "this one"/"it" resolves to the open card, "the one on the left/right/middle", "the newest"; the five design notes and color are weighted double; versions of one piece collapse to the newest so she never asks which of two versions; a genuine tie returns `ambiguous` plus candidates so she asks instead of guessing. |
| Silent 403 | Render failures went to `showError()` and never reached Maya. | `showError` now records `window._pgLastRenderError` and auto-logs it; new `render_status` tool reports in flight, failed, and the error text. |

## 3. Where things live

- `playground/index.html` (~17.9k lines): the app Fromsa uses. Voice agent
  lives in the addon tail after roughly line 17500. Key symbols:
  `_pgTool(name, args, dc)` is the whole tool dispatcher (one switch),
  `_pgRunCall` wraps it and auto-logs failures, `_pgFindCardDetailed` is the
  matcher, `_pgLook` is sight via html2canvas, `pgMayaStart/Stop` own the
  WebRTC session, `_pgWake*` is the "Hey Maya" wake word.
- `frontend/index.html`: the public app. It does NOT yet have the voice agent.
  The playground is the staging copy; work lands there first.
- `docs/server/server.js` (~4.1k lines): `POST /api/voice-token` mints the
  OpenAI Realtime client secret and carries the instructions and the tool
  schema. This is the prompt surface. `MAYA_CHARACTER` is prepended from
  `docs/server/maya-character.md`.
- `tests/maya-hands-smoke.mjs`: 82 assertions. Boots the playground headless,
  fires every tool with good and bad args, asserts shapes and honesty. Run it
  after any change to the agent: `node tests/maya-hands-smoke.mjs`.
- `tests/app-regression.mjs`: 401 assertions, the release contract.
- `docs/AI-HANDOFF.md`: state file, newest version at the top.
- `AGENTS.md` / `CLAUDE.md`: the house rules. Version lockstep across four
  surfaces, one assertion per shipped item, Fromsa presses Push, no em dashes.

## 4. What the field already knows (the ground that has been laid)

The comprehension problem Fromsa is describing is a solved-ish problem in the
literature and in how ChatGPT and Claude were built. The relevant lessons:

**Tool design is prompt design.** Anthropic's engineering work on writing
tools for agents lands on a few rules that map directly onto MAYA's failure
modes: consolidate many small tools into fewer high level ones that match how
a person actually thinks about the task (a `schedule_event` rather than
`list_users` plus `create_event`); return semantically meaningful context
rather than opaque identifiers, because models handle natural language names
far better than ids; and make error messages steer the agent toward the right
next action rather than just reporting failure. MAYA has 44 tools now, which
is past the point where the model reliably picks the right one. The card
editor is the clearest case: while a picture is open there should arguably be
ONE tool, not eleven.

**Context, not questions, resolves reference.** The voice assistant breakdown
research (Cui et al., user interaction patterns with LLM powered voice
assistants) finds intent recognition failure is the single largest breakdown
category, and that the LLM's job is to absorb those failures using conversation
history and context rather than pushing repair work onto the user. Users only
have two repair moves, repeat/rephrase or give up, and giving up is common.
Every popup MAYA raises is a forced repair.

**Grounded state beats guessing.** Dialogflow's voice agent design guidance
and the disambiguation survey literature converge on the same pattern: resolve
what you can from state, ask at most one targeted question when you truly
cannot, and always confirm by restating rather than by interrogating.

**Modes.** ChatGPT and Claude both narrow the action space by context (canvas
mode, artifact mode, code mode) rather than exposing every capability at every
moment. MAYA has an obvious mode boundary that is not being enforced: the
moodboard versus the card editor. Inside a picture, "make it a trench coat"
can only mean one thing.

## 5. What to ask Codex to do

The specific open questions where a second engineer adds value:

1. **Tool surface reduction.** 44 flat tools is too many for reliable
   selection. Propose a scoping scheme: either fewer, fatter tools, or
   context-dependent tool sets sent per session state (board mode vs card
   editor mode vs Pinterest mode). The Realtime session supports
   `session.update` mid call, so the tool list can change when the viewer
   opens. Is that worth it, and what is the migration?
2. **A real intent layer.** Today the model maps speech straight to a tool.
   Consider a thin resolver that takes the utterance plus a state snapshot
   (screen, open card, staged mods, drawer) and returns a normalized action,
   so ambiguity is handled in one place with tests rather than in prompt
   prose.
3. **Confirmation policy.** Write the rule for when Maya acts silently, when
   she narrates while acting, and when she asks. It should be one page and
   testable.
4. **The frontend port.** The voice agent lives only in `playground/`. What
   is the safest path to bring it to `frontend/index.html` for real users?
5. **Render failure UX.** A 403 should not be a pill the user reads. What is
   the right spoken and visual behavior, including retry?
6. **Eval harness.** Extend `tests/maya-hands-smoke.mjs` into a scripted
   conversation eval: given a transcript and a starting state, assert the
   tool sequence. This is how tool changes stop being guesswork.

## 6. Ready to paste prompt for ChatGPT / Codex

Copy everything between the lines into ChatGPT with the repo connected (or
paste this file plus `playground/index.html` and `docs/server/server.js`).

---

You are a senior engineer joining a working product. Read the codebase before
suggesting anything, and be concrete: name files, functions and line ranges.

CONTEXT. MAYA is an AI fashion consultation app at maya.manasiyo.com. It has a
voice agent built on the OpenAI Realtime API (WebRTC, client secrets minted by
POST /api/voice-token in docs/server/server.js). All of the agent's hands are
client side: the model emits function calls over the data channel and they run
in the browser through a single dispatcher, `_pgTool(name, args, dc)`, in the
addon block near the end of playground/index.html. There are 44 tools. She can
see the screen (html2canvas screenshot sent as an input_image), walk the three
screens, drive Pinterest, modify garments, and she auto-logs her own failures
to a studio inbox.

THE PROBLEM. Capability is not the bottleneck; comprehension is. The founder's
words: "a five year old should be able to use Maya." Real failures from a live
session: she agreed to design changes and then never rendered anything; asked
for the previous VERSION of the open piece, she swapped to a different card;
asked for a trench coat with no mention of fabric, she raised a fabric chooser
popup; she opened the wrong card when a picture was described out loud; a
render died with a 403 and she never mentioned it. Root causes have been fixed
in v14.13 (see the table in docs/CODEX-MAYA-BRIEF.md section 2) but the
underlying design question is open: the tool surface is flat and large, the
model picks wrong tools under ambiguity, and every wrong pick becomes a popup
or a silence that the user has to repair.

WHAT I WANT FROM YOU.

1. Read playground/index.html (the `_pgTool` switch, `_pgFindCardDetailed`,
   `pgMayaStart`, the wake word block) and the instructions plus tool schema
   built in POST /api/voice-token in docs/server/server.js. Summarize the
   current architecture back to me in ten lines so I know you actually read it.
2. Audit the tool surface. 44 flat tools is likely past reliable selection.
   Propose a concrete scoping design: context dependent tool sets pushed with
   session.update when the app's mode changes (moodboard, open card editor,
   Pinterest, favorites), or consolidation into fewer fatter tools. Give me the
   exact tool list per mode, the diff in the schema, and the failure modes of
   your own proposal.
3. Design the intent and disambiguation layer. Today speech maps straight to a
   tool. Propose where a resolver belongs, what state it takes (current screen,
   open card id, staged modifications, drawer state, last mentioned card), and
   how references like "this one", "the red one", "the one on the left", "go
   back a version" resolve deterministically and testably.
4. Write the confirmation policy: exactly when she acts silently, when she
   narrates while acting, when she asks a question, and how she restates. One
   page, phrased so it can be enforced by tests.
5. Ground it in prior art. Explain how ChatGPT, Claude and other production
   assistants handle mode scoping, reference resolution, and repair, and what
   specifically MAYA should copy. Cite what you rely on.
6. Propose an eval harness. tests/maya-hands-smoke.mjs already boots the app
   headless and fires tools with good and bad args (82 assertions). Extend it
   into scripted conversation evals: given a starting state and an utterance,
   assert the expected tool sequence. Give me the file.
7. Give me a prioritized plan: what to change first for the biggest gain in
   perceived understanding, with the risk of each change.

CONSTRAINTS. One repo, one branch (maya-v2). Version meta must stay in
lockstep across frontend/index.html, playground/index.html, backend/status.html
and backend/marketing.html, and the admin changelog data-version must equal it
(a test enforces this). Every shipped item earns a regression assertion. Never
use em dashes or en dashes in anything user facing or in docs. Do not touch
secrets; the owner sets all keys himself. Work in playground/index.html, not
frontend/index.html, unless we agree to port.

Start with step 1 and stop for my confirmation before proposing code.

---

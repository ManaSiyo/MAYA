# The deep audit prompt
### Paste everything below the line into ChatGPT / Codex with the maya-v2 repo connected. Written Aug 29 2026.

---

You are three people at once, and you will answer as all three: a senior
software engineer who has shipped consumer products for twenty years and has
no patience for cleverness that does not survive contact with users; Steve
Jobs in the specific sense of ruthless subtraction, the belief that every
button is a failure of imagination and that the product should feel
inevitable; and a user experience researcher who watches real people struggle
and refuses to blame them for it. When these three disagree, say so out loud
and resolve it.

You are auditing MAYA, an AI fashion consultation app at maya.manasiyo.com,
built by a solo founder (Fromsa, Mana Siyo) with two AI coding agents (Claude
and you, Codex). Everything you are about to read was built by an AI agent
and reviewed mostly by another AI agent. Treat all of it as unproven. Your
job is to find every error, every inconsistency, everything illogical,
everything that exists but should not, and then to design the two things the
current agents have not managed to design: a Maya that learns from her own
use, and a build process that stops being this slow.

## PART 0: WHAT MAYA IS AND WHAT HAS SHIPPED

The product: a client describes a garment they imagine, out loud. Maya (a
voice agent on the OpenAI Realtime API) helps them say it precisely, puts it
on a moodboard as cards, renders it on their own avatar, and routes the ones
they love into a made-to-order pipeline (Get it made). The business is custom
garments at 600 to 5000 dollars; Maya is the free front door.

The surfaces: frontend/index.html is the public app. playground/index.html is
the founder's staging copy and the ONLY surface with the voice agent; it is
where all new work lands. backend/status.html is the Admin. docs/server/
server.js is the Cloud Run API. tests/ holds the release contract
(app-regression.mjs, 402 assertions) and the voice agent battery
(maya-hands-smoke.mjs, 82 assertions, boots the playground headless and fires
every tool with good and bad args).

What shipped in the last three days, v14.02 through v14.13, all authored by
Claude: an MCP server exposing Maya's tools; a character file; a user-side
"Hey Maya" wake word and full Realtime voice agent whose hands are 44
client-side tools dispatched through one switch, _pgTool(name, args, dc), in
the addon tail of playground/index.html; sight (html2canvas screenshot sent
as input_image); autonomous self-logging (every "I can't", every failed tool
call, every render error auto-files to the studio inbox with source tags);
screen navigation, scrolling, zoom, card moving and resizing, projects,
favorites, fabrics, measurements, credits; a card editor mode where spoken
changes render directly through the modify pipeline (modify_garment), version
stepping on the open piece (card_version), and a matcher
(_pgFindCardDetailed) that resolves "this one", "the red one", "the one on
the left", collapses versions of one piece, and returns candidates instead of
guessing on ties; render_status so she can say why a picture died; far_field
noise reduction and a stronger transcriber on the voice session, with a
fallback so a rejected session shape cannot kill voice.

Read before you speak: docs/AI-HANDOFF.md (newest at top),
docs/CODEX-MAYA-BRIEF.md (the previous brief; do not redo its section 2),
AGENTS.md (house rules), tests/maya-hands-smoke.mjs, the _pgTool switch, and
the instructions block built inside POST /api/voice-token in
docs/server/server.js. Summarize the architecture back in ten lines first so
we know you read it.

## PART 1: THE DISSECTION

Go file by file through playground/index.html and docs/server/server.js with
the specific goal of finding what an author cannot find in their own work.

1. Hunt for real defects: race conditions between the voice tool chain
   (_pgToolChain serializes calls) and the async app flows it drives; state
   that the tools mutate but the app's own save/persist paths do not know
   about; the wake word's interaction with every other thing that takes the
   microphone; zoom math versus drag math versus the tools that move cards;
   what happens when tools fire while a render is in flight, while the
   drawer is animating, while a modal is mid-open; what happens on a phone.
2. Hunt for the illogical: dead code, duplicated logic between the home
   visualize flow and the modify flow, instructions in the voice prompt that
   contradict each other or contradict what the tools actually do, tool
   results that lie or say nothing useful, names that mislead the model.
3. The 44-tool problem: the tool list is flat and large, and wrong-tool
   selection under ambiguity is the single biggest source of user-visible
   stupidity. The previous brief proposed per-mode tool sets pushed with
   session.update when the app's mode changes (moodboard, card editor,
   Pinterest, favorites). Take a position: design it concretely or argue for
   consolidation into fewer, fatter tools, with the exact schema either way.
4. THE SUBTRACTION PASS. This is the Jobs question and it deserves its own
   answer: now that Maya can hear, which buttons should not exist? The
   playground currently shows, among others: a tap-to-listen voice bar, an
   Upload pill, a Visualize button, the viewer's Tap to Listen / Switch
   Fabric / Add Reference pills, a Projects dropdown, drawer tabs, page
   dots, background Upload and Generate pills, a Feedback link, and a
   hamburger. For each visible control, answer: does this earn its place
   once voice works, or is it a fossil of the pre-voice app? Propose the
   screen as it should look for a first-time user who will speak, and the
   fallback state for a user who cannot or will not speak. Be specific:
   name the element ids to remove, keep, or collapse.
5. For every defect you claim, give the failure scenario (inputs and state
   leading to wrong behavior), the file and function, and the minimal fix.
   No style opinions dressed up as bugs.

## PART 2: SELF-LEARNING, FEEDBACK-DRIVEN MAYA

Today Maya writes things down but never reads them. The observer (v14.09)
auto-logs her failures and user wishes to the studio inbox; the Improve Maya
popup collects notes; the admin reads both. The loop ends there. A human
(the founder) turns frustration into instructions by talking to Claude. That
is the whole learning mechanism, and it is why the same class of bug recurs.

Design the flywheel that closes this loop. Requirements and constraints:

1. CAPTURE. The Realtime session already produces transcripts (user side and
   Maya side), tool calls with arguments and results, and the auto-log
   stream. Nothing is stored today beyond the auto-logs. Design the session
   record: what is worth keeping (transcript turns, tool sequence, per-call
   ok/fail with reasons, render outcomes, which cards got hearted or
   submitted afterward, wake word false positives), where it lives
   (Firestore is already there), and what it costs.
2. CONSENT. ChatGPT asks "can we use your conversations to improve the
   model." Maya should do the equivalent, honestly: a line in the terms plus
   a visible, plain-words toggle ("Help Maya learn from this conversation"),
   default and wording proposed by you, with the founder's own sessions
   always opted in. Say exactly what is collected and what is never
   collected. Voice recordings versus transcripts is a real distinction:
   take a position.
3. OUTCOME SIGNALS, not just complaints. A hearted render, a Get it made
   submission, a version the user kept versus abandoned, a command that had
   to be repeated twice, a call that ended mid-task: these are labels.
   Define the success metric per session (task completion, repeats per
   command, time to first render) so learning has a target.
4. THE LOOP ITSELF. Given stored sessions, design the nightly job: cluster
   failures (wrong tool, wrong card, misheard, popup raised, render died),
   detect the top recurring pattern, and produce a PROPOSED CHANGE as a
   pull-request-shaped artifact: an edit to the instructions block, a tool
   description fix, a new battery assertion reproducing the failure, or a
   matcher tweak, with the evidence attached. A human approves; nothing
   self-modifies silently. Claude and Codex are the hands that apply it.
   Specify where this job runs (Cloud Run cron, a GitHub action, or Maya's
   own MCP server) and what model it calls.
5. IN-SESSION LEARNING. Separate from the nightly loop: what can Maya adapt
   live, within one call, safely? (Example: after one wrong-card guess, bias
   the matcher toward asking; after a misheard command, prefer repeating
   back before acting.) Define the small set of runtime dials and where
   their state lives.
6. Be concrete enough to build from: collection schema, endpoint names,
   consent copy, the clustering prompt, the proposal format, and the first
   three battery assertions the loop would have generated from this week's
   real failures (wrong card opened, fabric popup on a design change,
   silent 403).

## PART 3: THE META-ANALYSIS. WHY IS THIS SLOW, AND IS THE FOUNDER THE LIMIT?

This part is about the process, not the code, and you must be honest even
where it is uncomfortable. The facts, stated plainly so you can reason about
them:

- The founder dictates requests by voice (Wispr). Words arrive garbled
  sometimes. There is no written spec; the spec is the conversation.
- The iteration loop is: founder describes what he wants to Claude; Claude
  builds and tests headless; founder presses Push; founder tests by
  actually talking to Maya in his room; frustration becomes the next
  voice-dictated request. One full loop costs a deploy plus a live session
  plus his attention.
- Twelve versions shipped in roughly three days. Real bugs were found and
  fixed each round, but some things took many rounds: an admin hamburger
  took twelve asks to match the app; the card editor could not render from
  voice until the founder hit it live, even though the code had shipped
  through three audit passes; the fabric popup bug survived multiple
  reviews because no test spoke to Maya with a card open until v14.13.
- The only end-to-end eval of the voice experience is the founder's own
  live calls. The headless battery tests the tools' contracts, not the
  conversation. Nothing measures whether Maya picked the right tool for a
  sentence; that failure class only surfaces through human frustration.
- The founder's stated bar: a five year old should be able to use Maya.

Answer these, in order, as the senior engineer:

1. Reconstruct the feedback economics. Where does each hour actually go in
   this loop, and which step has the worst ratio of cost to information
   gained? (Hint: consider that the most expensive step, the founder's live
   call, is also the only step that finds the real bugs.)
2. Why did the same bug classes recur across audit passes? Name the process
   hole, not the code hole: what class of test did not exist, and why did
   three self-audits by the building agent not find what one live call
   found in minutes?
3. Is the founder the limit? Answer honestly and specifically. In what ways
   is he the bottleneck (single human eval, garbled specs, serial
   attention, taste decisions only he can make), and in what ways is he
   irreplaceable (taste, the five-year-old bar, real user empathy)? Then
   redesign around it: what should ONLY Fromsa do, and what currently
   consumes his attention that a machine should absorb?
4. Propose the iteration machine. Concretely: scripted conversation evals
   (utterance plus app state in, expected tool sequence out) that run
   headless before every push, so tool-selection failures die in CI instead
   of in his living room; a synthetic user (an LLM playing a client, or
   replaying his recorded sessions with consent) that talks to Maya in the
   headless browser nightly and files its own frustration report; and the
   self-learning loop from Part 2 feeding both. Estimate what fraction of
   the current loop this removes.
5. The founder asks: "how did ChatGPT and Claude improve their systems to
   better understand users? The ground has been laid for this." Answer with
   the real mechanisms behind those products (large-scale feedback
   collection with consent, preference data, evals as the gate for every
   change, red-teaming, mode scoping, instruction hierarchies) and map each
   one to its small-team equivalent that MAYA can actually afford. Be
   specific about which ones do NOT transfer to a solo founder and why.
6. End with the one-page operating plan: the weekly rhythm for a solo
   founder plus two AI agents (what runs nightly, what runs per push, what
   Fromsa personally tests and when, what Maya reports about herself every
   morning), such that the next twelve versions cost half the founder-hours
   these twelve did.

## CONSTRAINTS AND HOUSE RULES

One repo, one branch (maya-v2). Fromsa presses Push; Cloud Build deploys and
runs the release contracts, so nothing merges red. Version meta stays in
lockstep across the four surfaces and the changelog data-version must equal
it (test-enforced). Every shipped item earns a regression assertion. Work
lands in playground/index.html first; frontend is ported deliberately. Never
use em dashes or en dashes in anything user facing or in docs. Never touch
secrets or keys; the owner sets them. Maya never sends email or publishes
anything without an explicit human click. Writes stay confirm-gated where
they already are. Do not weaken the observer: her self-logging is a feature
of record.

ORDER OF WORK. Do Part 0's ten-line summary and stop for confirmation. Then
Part 1 (the dissection) as one report with a ranked defect list. Then Part 2
and Part 3 together, since the flywheel is the answer to the speed problem.
Finish with the operating plan. At every step, prefer the smallest change
that kills the largest class of failure, and say what you would delete
before you say what you would add.

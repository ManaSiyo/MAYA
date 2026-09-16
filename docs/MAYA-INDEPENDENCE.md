# MAYA as an entity: the independence roadmap

Written Aug 27 2026 (v14.02) from Fromsa's brief in the Maya Audit 2 session.
This is the strategy for turning Maya from a voice on the Admin page into the
intelligence, memory and hands of Mana Siyo: something Fromsa talks to, that
knows everyone, fixes and hands off everything, and needs him only to approve.
Ship top down. Every stage lands on Admin first (the playground for Maya) and is
promoted to the user side when Fromsa is happy with it.

## The picture in one paragraph

Maya is a person made of four things. A character (how she thinks, kept in
`docs/server/maya-character.md`, ships with the server). A memory (her soul
journal, her saved facts, her people, her feature inbox, all in Google Cloud
Storage under `maya/`). Hands (the tools she can call on the voice line, all
writes confirmation gated in the Admin queue). And a door (`POST /mcp`, the
Model Context Protocol server that lets Claude, Codex or any agent read her
memory and inbox and mark work shipped). The loop Fromsa asked for is: a user or
a teammate asks Maya for something, she logs it, Fromsa says yes, Claude reads
the inbox through the door, builds it, marks it done, and journals it back into
her soul so she knows next time. Fromsa's only job is the yes.

## What exists today (v14.02)

- Voice: OpenAI Realtime on Admin, ephemeral token from `/api/admin/voice-token`,
  grounded in the Admin snapshot. "Hey Maya" wake word on Admin (opt in switch).
- Tools on the line: get_briefing, show_panel, find_lead, remember, forget,
  note_lead, draft_email, show_drawer, log_feature, get_feature_digest,
  add_lead, update_lead, delete_lead, add_person, journal, read_team_sheet.
- Memory: `maya/memory.json` (facts), `maya/soul.md` (journal),
  `maya/people.json` (who is who), `maya/features.json` (the inbox).
- Character: `maya-character.md` (new), read into every call.
- Door: `POST /mcp` (new), eight tools, token guarded, tested.
- Conversation on screen, copyable (the drawer chat box).

## The stages, in order

### Stage 1, this week: open the door and close the loop

1. Fromsa sets `MAYA_MCP_TOKEN` on Cloud Run and adds Maya as a custom
   connector in Claude (steps with links in `docs/fixes.txt`). From then on a
   MAYA session in Claude starts with `maya_soul` and `maya_inbox`, not with a
   paste.
2. Every Claude commit that ships an inbox item calls `maya_feature_done` and
   `maya_journal` ("shipped X in v14.0N"). Maya can then tell Fromsa on the
   line what shipped since they last spoke, from her own memory.
3. Weekly digest: a scheduled task in Cowork reads `maya_inbox` every Monday
   and emails Fromsa the open asks grouped by who asked. No server work.

### Stage 2, next: Maya takes the wheel on Admin

1. Wake word default on for admins; the switch remembers per browser (done);
   add "Maya, stop listening" as the off phrase.
2. Live transcription on screen while she listens (the chat box already shows
   turns; add the interim line, faint, under the logo).
3. Navigation by voice, full: open and close the drawer, open any panel (done),
   scroll to a section, open the playground, open a lead's invoice. These are
   pure client tools (no server), the same `show_panel` family.
4. Proposals: once a day Maya reads her own inbox and the analytics and offers
   one improvement in one sentence; Fromsa says "log it" or "no". This is the
   builder personality doing its job.

### Stage 3: Maya on the user side (maya.manasiyo.com)

STARTED in v14.03 on the Playground: `/api/voice-token`, the wake word switch
at the drawer floor, and her hands (drawer, Pinterest bring in, describe,
visualize, feedback notes, feature log). Promotion to the app is Fromsa's call.

Same brain, narrower permissions. A user-side voice token endpoint
(`/api/voice-token`, any signed in user, low rate limit) with a tool set that
has no admin reads: `open_drawer`, `close_drawer`, `show_pinterest`,
`search_pinterest(query)`, `bring_in(pins)`, `visualize`, `favorite`, `submit`,
and `log_feature` (who = the signed in name). Every ask lands in the same inbox,
tagged by user, so support forms disappear. Cost: one Realtime minute per
conversation, metered against the user's credits like a render.

### Stage 4: the phone

OpenAI's Realtime API accepts SIP calls; a Twilio number (or any SIP trunk)
forwards to Maya, the webhook accepts the call, and the same tools run. Two
uses Fromsa named: he calls Maya from the road ("who asked for what this week"),
and Maya calls him with a summary when something needs a yes. Needs: a number,
a webhook route `/api/voice/sip` on Cloud Run, and a caller allowlist (his
number only, at first).

### Stage 5: Maya proposes code, Claude writes it, Fromsa approves

The inbox becomes a queue with states (asked, approved, building, shipped).
Fromsa approves on the line ("approve the Pinterest search one") which flips
the state; Claude's session picks up only `approved` items. Maya knows how she
is built (the backbone paragraph plus `docs/README.md`) and drafts the acceptance
line for each item. Optional later: Claude opens a pull request per item and
Maya reads the diff summary back; Fromsa still presses Push.

## The platform pieces to use, and why

- Model Context Protocol for the door: it is the one interface Claude (Cowork
  custom connectors), Claude Code, Codex and the Agent SDK all speak. One
  server, every agent.
- Anthropic's memory tool and context editing (Claude Developer Platform) for
  the Claude side: a Claude session working on MAYA keeps its own file memory
  across sessions, so it does not re-learn the repo every night. The repo's
  docs stay the source of truth; the memory tool holds the working notes.
- Anthropic Agent SDK or Managed Agents for the "Claude ships it" leg once
  Fromsa wants it unattended: a scheduled agent reads `approved` inbox items,
  edits the repo in a sandbox, runs the tests, opens a PR. Until then Cowork
  sessions do it with him watching.
- OpenAI Realtime (already in use) for speech to speech on the web and over
  SIP; it is what makes "Hey Maya" feel like a person.
- Google Cloud Storage stays the memory store; it is already there, it is
  cheap, and every write is visible in the vault.

## Lines that never move

- Writes on the voice line stay confirmation gated and visible in the queue.
- Maya never sends an email herself; she opens it ready to send.
- Fromsa presses Push. Claude and Codex commit.
- The sealed project rule: nothing crosses a project or an account.
- The only limit on Maya is the credit meter, and it is honest.

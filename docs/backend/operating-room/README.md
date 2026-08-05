# Operation Room — grounded pattern pipeline (RAG sandbox)

A standalone sandbox that fixes the hallucinated pattern in the live Operating
Room. It does **not** touch `backend.html`. The right side now shows **two**
pattern attempts side-by-side:

- **Window 1 · Raw** — today's prompt verbatim. The model guesses panels (the 3-panel pants, stubby waistband).
- **Window 2 · Grounded** — multi-modal hybrid RAG over `Pattern Book.pdf` (*Patternmaking for Fashion Design*, Joseph-Armstrong, 5e).

Open `operation-room.html` in Chrome, add your OpenAI key in Settings (≡ — it's
the same `maya_openai_key` backend.html uses), press **Build embeddings** once,
load a garment, then **Generate both**.

## The pipeline (Window 2)

| # | Stage | What happens |
|---|-------|--------------|
| 1 | **Vision** | `gpt-4.1` classifies the garment and reads visible seams/closures → structured JSON. |
| 2 | **Route** | Garment type → Pattern Book chapter via `kb/chapter-map.json` (e.g. pants → Ch.26). |
| 3 | **Rules** | Deterministic panel grammar from `kb/panel-grammar.json` — panel count, mirror pairs, band sizing. *This is the layer that fixes the obvious errors.* |
| 4 | **Retrieve** | `text-embedding-3-small` + cosine over the routed chapter's passages (top-k). |
| 5 | **Compose** | Hard rules + retrieved guidance → one grounded prompt. |
| 6 | **Generate + self-refine** | Pass 1 draws the base grounded pattern. Each later pass runs a **vision critique** of the previous draft against the panel grammar + reference, then redraws to fix the listed defects. Default **3 passes** (tunable 1–4 in Settings); stops early if a critique passes clean. |

### Self-refinement loop (stage 6) — the critique comes from the BOOK

```
draft₁ = gpt-image-2(hero, grounded prompt)          # pass 1, the base you liked
for pass 2..N:
    bookHits = retrieve("how this garment is constructed…", chapter)   # fresh RAG
    critique = gpt-4.1(reference, draftₙ₋₁, BOOK PASSAGES)   → {ok, verdict, defects[{issue,book_basis,page}], fixes}
    if critique.ok: stop                              # only if flawless vs the book
    draftₙ = gpt-image-2(draftₙ₋₁, fixes + book citations + grammar)
final = last draft
```

Key point: passes 2+ do **not** judge against hand-written rules. Each pass
runs its own retrieval over the Pattern Book's construction pages and the
critic is told the book is its *only* source of truth — every defect must cite
a page (e.g. *"crotch extension too short — book p.660 says the jean foundation
has the shortest extension and must still cover the inner leg"*). The grammar
is kept only as a lightweight panel checklist.

**Cross-chapter retrieval (not just the garment's chapter).** Construction
fundamentals — seam allowance, grainline placement, notches, dart trueing,
balance lines, measurements — live in the foundational chapters (Ch.1–4), not
in the garment chapter. So the corpus now indexes those as `_core` (always
eligible), and the critique uses a **blended** retrieval that guarantees
coverage from *both* the garment's own chapter (~55%) and the cross-cutting
fundamentals (the rest). A pants critique therefore cites e.g. Ch.26 p.660 for
the crotch foundation *and* Ch.1 for the seam-allowance/grainline rules. The
"judged against" line on each pass shows exactly which pages (and chapters)
were used.

**Visible as it happens:** the critique streams token-by-token into a live
console under the pattern window, with a status line (`retrieving book
passages… → critiquing… → 3 defects vs the book → redrawing…`). Each pass then
lands in the **Self-refinement passes** strip showing the verdict, the cited
defects (with page + what the book says), and which pages it was judged
against. Click any pass to view that draft.

**Stringency:** `ok:true` is only returned if the draft is production-perfect
against the book on every count (panel count, front/back width, symmetry,
crotch/rise, waistband, darts, seam pairing, grainlines, notches, clean
linework). "Close" or "plausible" fails. So a 3-pass run almost always uses all
3 passes rather than stopping early.

Cost note: an N-pass grounded run = 1 vision classify + N image generations +
(N−1) embedding retrievals + (N−1) streamed vision critiques. At N=3 that's
~3 image gens + 2 critiques. Tune passes (1–4) in Settings.

Everything runs in the browser. No server — consistent with Maya's single-file
architecture and Strategy A (commercial APIs only, **no fine-tuning**). RAG ≠
fine-tuning: we *retrieve* the book's rules and inject them into the prompt.

## Why this fixes the screenshot

The grammar encodes facts the image model never had:

- Pants are **bifurcated** → **4 leg panels** (front ×2, back ×2), not 3.
- The **back is wider** than the front (½ back hip vs ¼ front hip).
- The **waistband** spans the *full* waist + closure underlap — not a stub.
- Symmetry is **bilateral** (left ⇆ right), not front/back.

Each rule cites its Pattern Book page. The "Retrieval Trace" panel shows exactly
what was detected, routed, enforced, and retrieved for every run — so you can
see *why* the grounded pattern looks the way it does.

## Version history & topstitch colour

The row above the pattern stage is the **version history** — small left-aligned
pills: `Raw`, then `Grounded 1`, `Grounded 2`, … one per pass that ran. Click
any pill to jump straight to that version on the stage (the dimension grid and
HUD follow). The same passes are also clickable in the trace's refinement strip.

If the garment is **topstitched** (the vision step detects it), every
topstitched seam/detail is drawn in **red (#d23b3b)** dashed lines, distinct
from the dark-grey structural cut lines, so the topstitching reads at a glance.

## Measurements & the 1-inch grid

Settings (≡) has **Waist / waistband** and **Pant length (outseam)** inputs (inches).
When set, the sandbox:

- derives the book dimensions — waistband length = waist + 1.5in underlap,
  front waist = W/4 + 1/4, back waist = W/4 − 1/4 (Ch.26 p.662) — and shows them
  in Settings and in the on-stage dimension HUD;
- injects a **TARGET DIMENSIONS** block into the grounded + refine prompts so the
  model draws each panel true to scale (the waistband must read as the longest,
  thinnest strip; the back panel wider than the front; the leg the entered length);
- adds a **DIMENSION CHECK** to the critique — if a panel is clearly off relative
  to the grid, that's a flagged defect.

The stage shows a real **1-inch × 1-inch measurement grid with its origin at the
bottom-left corner**, numbered in inches along the bottom and left edges (heavier
line every 6in). `1 grid inch = stageHeight / (pant length + 6in headroom)`. The
pattern raster is anchored bottom-left so its corner sits on the origin, and the
prompt tells the model to draw to that same numbered grid. Toggle with the
**Grid** pill. (This is the same bottom-left-origin convention the nesting bed
uses, so a to-scale pattern flows straight into Nest later.)

## Files

```
operation-room/
├── operation-room.html     the sandbox (open this)
├── indexer.py              offline pass: PDF → chunks + chapter map + kb.js bundle
├── README.md
└── kb/
    ├── pattern-chunks.json  790 passages across 7 chapters (text only)
    ├── panel-grammar.json   deterministic construction rules, core 5 types + adaptive fallback
    ├── chapter-map.json     garment type → chapter routing
    └── kb.js                bundle loaded via <script> (file:// can't fetch local JSON)
```

Coverage: pants, skirt, shirt, jacket, bodice/dress as the baseline. Anything
else falls back to the **adaptive principles** in `panel-grammar.json` (decide
symmetry first, a tube needs front+back, bands = circumference + underlap, …).

Re-run the offline pass after editing the chapter list or grammar:

```bash
cd "Back End/operation-room"
python3 indexer.py                       # writes pattern-chunks.json + chapter-map.json
python3 -c "import indexer; indexer.bundle_js()"   # rewrites kb/kb.js
```

(then **Clear cache → Build embeddings** in the sandbox so the vectors match the new chunks)

## Porting into backend.html (after you approve)

The grounded path is a drop-in replacement for `generatePattern()`:

1. Add `<script src="operation-room/kb/kb.js">` to `backend.html`'s head.
2. Copy `classifyGarment` / `resolveType` / `buildQuery` / `retrieve` /
   `composeGroundedPrompt` / `critiquePattern` / `composeRefinePrompt` /
   `embedTexts` + the IndexedDB helpers into backend.html.
   (The dissection step already returns a garment type — you can feed that in
   instead of a second vision call to save a round-trip.)
3. Make the Pattern swiper's existing page the **Raw** window, and add the
   **Grounded** window as the next swipe page — matching the two-window design.
4. Trigger `buildEmbeddings()` once on first Op Room visit (cached thereafter).

## Known limits / next steps

- Output is still a **raster** from gpt-image-2 — grounded, but not yet vector.
  Next: feed the grounded raster into the Vectorizer.AI step so the fixed pattern
  flows into Nest. The grammar's panel list could also drive a deterministic SVG
  draft directly (skip the image model entirely for the core types).
- Grammar covers the core 5; expand by adding chapters to `indexer.py:CHAPTERS`
  and a block to `panel-grammar.json`.
- Retrieval is chapter-filtered; for multi-garment images, classify per piece.

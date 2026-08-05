# Maya · Strategy A

**Decided 2026-05-25 by Fromsa.** Pivot away from the deep ML research stack (GarmentCode / AIpparel / ChatGarment / PyGarment / fine-tuned VLMs). Maya's MLOps bed is:

1. **OpenAI** for the generative work (gpt-image-2 for the pattern raster, GPT-4.1 for any structured output).
2. **A best-in-class commercial vector tool** for the raster → clean SVG step.
3. **Deterministic Python rules** (`Back End/manufacturing/`) for measurement-driven sizing.

No custom training. No GPU box. No research repos to babysit. Everything Maya needs is a paid API or a small Python module.

---

## 1 · The prompts we're sending to OpenAI right now

Two GPT-4.1 calls and one gpt-image-2 call drive the whole pipeline. Iterating these prompts is now the primary lever for accuracy.

### Prompt 1 — Outfit dissection (GPT-4.1, vision)
`op-room.html:2437` · constant `DISSECTION_SYSTEM_PROMPT` · called by `dissectImage()`

> You are the design analyst for the Mana Siyo atelier. Given a fashion render (three-view atelier sheet), identify the SEPARATE GARMENT ITEMS the client is wearing.
>
> Output JSON shape:
> `{ outfit_summary, complexity_tier, fabric_type, fabric_source, hardware, thread_notes, pieces: [ { name, category, fabric, note, panels, skip, jacket_construction, trouser_rise } ] }`
>
> **Critical rules:** identify SEPARATE WEARABLE ITEMS, not construction panels. A trench coat is ONE piece. Base layers (plain black tank top and trousers) come back with `skip: true`. Outermost first.
>
> **Suit-specific rules (v0.27):** detect double- vs single-breasted construction, button spacing, lapel depth, collar stand height, dart presence, trouser rise (high/mid/low), inseam style.

**What to iterate here:** the suit-specific block was added late and is the most accuracy-sensitive part. Other categories (dresses, coats, knitwear) don't have equivalent guidance yet. Add a similar block per category the atelier sees often.

### Prompt 2 — Per-piece pattern raster (gpt-image-2)
`op-room.html:2928` · inline in `generatePattern()`

> Generate a 2D SEWING PATTERN technical drawing for the "[piece.name]" ([piece.note]) from this reference garment image. [N panels approx.]
>
> The reference is a three-view sheet (SIDE · FRONT · BACK). Read each view: front for overall silhouette and front-panel layout, side for dart depth, curve depth, and pocket angle, back for back-panel topology. Only invent details visible in at least one of the three views.
>
> [Suit-specific guidance if jacket_construction or trouser_rise was identified — same numbers as Prompt 1.]
>
> **Style:** looks like the figures in the GarmentCode / ChatGarment / AIpparel papers — calm warm-white paper background (#fafaf6), each pattern panel drawn as a CLEAN CLOSED OUTLINE in dark-grey (#1d1f23), stroke weight 1.0–1.5 px. Centered dashed grainline arrow per panel, triangular notches at every seam pair, faint seam-allowance offset 1 cm inside the cut edge, Jost-style uppercase label.
>
> Identify ALL the panels the garment actually requires. Use TRUE-TO-FABRIC PROPORTIONS — a sleeve is narrower than a back, a collar is short. Faint 1 cm grid behind, very low opacity.
>
> **Scale reference:** in the BOTTOM-LEFT corner, draw an EXACTLY 1 INCH × 1 INCH square outlined in the same dark-grey, labelled "1 IN".
>
> No model, no 3D, no body, no shading. Output: a flat technical-drawing PDF look.

API call: `POST /v1/images/edits`, model `gpt-image-2`, size `1536x1024`, `n=1`, quality from Settings.

**What to iterate here:** the "1 IN" scale square is the critical anchor for downstream vectorization — if the model produces it accurately every time, every panel measurement is recoverable from the SVG. The papers-referenced style ("GarmentCode / ChatGarment / AIpparel") can be dropped since we're not chasing those repos any more — replace with a cleaner direct style description.

### Prompt 3 — GarmentCode-shaped JSON (GPT-4.1, vision)
`op-room.html:2534` · constant `GARMENTCODE_SYSTEM_PROMPT` · called by `dissectImageToGarmentCode()`

> You are a senior patternmaker generating a GarmentCode-style JSON description for a single garment piece. […] Your job is to fill that schema from a single three-view (side · front · back) photograph of the piece, isolated on black.
>
> Output ONLY this JSON:
> `{ piece, category, silhouette, panels: [{ name, role, mirror_pair, approx_w_cm, approx_h_cm, grain_axis, shape_notes }], stitches: [{ from, to, type }], closure: { type, placement, length_cm }, ease_policy: { bust_cm, waist_cm, hip_cm }, fabric_note, construction }`
>
> Rules: panels must reflect what a real cutter would actually produce, not a render of seams. `mirror_pair=true` means cut TWO from a folded layer (the JSON lists once). `approx_w_cm` / `approx_h_cm` are bounding-box measurements laid flat. Be concrete about ease — fitted bodice ~2cm, relaxed shirt ~10cm, oversized coat ~20cm. If a detail isn't visible in any of the three views, don't invent it.

**Decision:** under Strategy A, JSON is downgraded from "source of truth" to "side-channel data." The visual workflow is gpt-image-2 → vectoriser → SVG → designer. JSON is useful for non-visual fields (closures, ease, fabric) and for measurement-driven sizing through `manufacturing/waistband.py`. Keep the prompt, deprioritize the UI emphasis.

---

## 2 · Vector tool — replace ImageTracer.js with Vectorizer.AI

`ImageTracer.js` is the open-source library currently running in `op-room.html` (line 8) and produces the noisy output you've seen. It's the lowest-quality option in the category. Three production-grade alternatives, ranked for our case:

### Recommended: **Vectorizer.AI** ([vectorizer.ai](https://vectorizer.ai))
- REST API, multipart upload.
- Pricing: $9.99/mo (50 credits) → $4,999/mo (100k credits); unused credits roll over up to 5×.
- Output formats: SVG, **DXF** (matters — laser cutters speak DXF), PDF, EPS, PNG.
- Marketing explicitly addresses AI-generated images as input.
- Limits: 3 MP, 30 MB per image. We're well inside both.
- Verdict: only commercial option that combines API + DXF + AI-aware quality. The clear primary choice.

### Backup: **Recraft Vectorize** ([recraft.ai/api](https://www.recraft.ai/api))
- REST API, plus available via Replicate and fal.
- Pricing: per-image (~$0.04–0.08), no subscription floor.
- SVG output (no native DXF, but SVG → DXF is one ezdxf step away).
- Strong on clean illustrations; their own image model is AI-native so the vectoriser is tuned for AI input.
- Verdict: pick this if per-image pricing beats subscription for our volume, or if DXF isn't strictly required at the API layer.

### Free / self-hosted fallback: **VTracer** ([github.com/visioncortex/vtracer](https://github.com/visioncortex/vtracer))
- Rust binary, with `pip install vtracer` (Python) and `@neplex/vectorizer` (Node).
- `--preset bw` is purpose-built for the B&W line art our pattern raster is. O(n) — fast.
- Free, MIT.
- No DXF (post-process with `ezdxf`).
- Verdict: drop-in replacement for ImageTracer.js if we want to stay browser-pure with zero recurring cost. There's also a WASM build hosted at [vectorize-image.app](https://vectorize-image.app) for instant testing.

### Out
- **Adobe Image Trace / Firefly Services** — heavy, expensive, anchor-bloat.
- **Vector Magic** — no API, rules itself out.
- **ImageTracer.js (current)** — the noise baseline. Migrate off.

### Migration shape
Replace the body of `vectorizeActivePattern()` in op-room.html (currently ~line 4749) with a `fetch()` to Vectorizer.AI's endpoint, sending `piece._pattern` as the input. Drop the result SVG into `#vector-preview`. Same return path; only the engine changes. Add the Vectorizer.AI API key to Settings drawer alongside the OpenAI / fal keys.

---

## 3 · Who's actually in this space (May 2026)

### Direct competitors (image / sketch → cuttable pattern)

**FashionINSTA** — [fashioninsta.ai](https://fashioninsta.ai/) — €299/mo, Florence. Sketch → pattern → `.dxf`. Trains a per-brand model on the customer's existing pattern library. Most direct Maya competitor — same atomic unit (the panel) and same end format (DXF for cutters), but starts from sketches rather than dream-garment photographs. **Study this one most.**

**StitchLift** — [stitchlift.com](https://stitchlift.com/) — public beta, $34/mo. Photo or text → sewing pattern with measurements + grading + PDF/SVG/DXF. Aimed at home sewists and indie designers — Maya is upmarket of them, but they validate the photo-based input modality.

**Style3D** — [style3d.com](https://www.style3d.com/) — Hangzhou, $119M raised. CLO3D challenger that has bolted on generative AI (natural-language style → 3D pattern, sketch/image → editable 2D pattern, virtual photoshoots). The serious enterprise competitor. Maya's edge versus Style3D is consultation-first input, not simulation.

**ZERØTEC** — [zerotec.eco](https://zerotec.eco/) — £642k pre-seed Oct 2025. AI pattern design + nesting, claims 250 brand pilots. Adjacent on the IP map (their nesting overlaps SVGnest territory).

**ChatGarment** — [chatgarment.github.io](https://chatgarment.github.io/) — CVPR 2025 paper + open code, not a company yet. A funded team spinning this out is the single biggest latent threat.

### Adjacent (AI for fashion, not pattern cutting)
- **Raspberry AI** — $28.5M total funding from a16z. 70 customers incl. Under Armour. Text-to-image for fashion concepts. Doesn't do patterns. Best-funded player in the broader space.
- **CALA** — $3M seed. Concept-to-production with AI front-end, human/CAD downstream pattern-making.
- **Refabric** — LVMH La Maison des Startups. Heavy marketing, light shipped product.
- **Off/Script** — $7M+ from Accel. AI mock-ups + community + manufacturing. Not a pattern tool.
- **Lalaland.ai** — acquired by Browzwear. Virtual fashion models for e-commerce.
- **Daydream** — $50M from Forerunner + Index. AI shopping agent. UX reference, not a competitor.

### Not real / shut down
- **The Yes** (Pinterest acquired 2022, founder relaunched as Daydream)
- **Resleeve.ai**, **Cypher**, **Anycloth**, **Doris.ai**, **Fashable** — image generators or virtual try-on dressed up as "AI fashion design." None ship pattern files.
- **Stitch.fashion** — no verifiable company.
- **Glitch.ai** — Glitch hosting shut down July 2025; no fashion product surfaced.

### Where the white space is

The **consultation → dream-garment-photo → dissected panel JSON → nested DXF** loop is unclaimed.
- Raspberry / Refabric / CALA stop at the concept render.
- FashionINSTA starts from a sketch (not a photograph of an aspirational reference).
- StitchLift hits photos but for hobbyists.
- Style3D is upmarket and simulation-first.

Maya's pitch — *Op Room from a client consultation photo to cuttable, nestable patterns* — has no direct equivalent today.

### Biggest risk
A well-funded team productising ChatGarment + GarmentCode out of CVPR 2025 with a16z-class money. Strategy A actually reduces this risk: we're not dependent on the same research path, and our moat shifts to (a) the consultation UX, (b) the deterministic manufacturing rules engine, (c) the GPT prompt library we accumulate from real client iterations.

---

## 4 · What to drop from the prior plan

- **Phase 6 (fine-tune AIpparel)** — dropped under Strategy A. Replaced by prompt iteration on GPT-4.1 / gpt-image-2.
- **AIpparel weights / GarmentCodeData download** — no longer needed. The `Downloads/datasets/` and `Downloads/models/` folders can stay empty.
- **The cloned `Downloads/repos/` repos** — keep `ezdxf` (we need DXF export, Phase 5) and `SVGnest` (already integrated). The other 14 repos are reference code only — keep on disk for now, prune later if disk pressure.
- **Phase 7 (NVIDIA Warp drape)** — dropped. The 3D drape stays on fal.ai's Hyper3D Rodin (already integrated).
- **References to GarmentCode / AIpparel / ChatGarment in prompts** — the Prompt 2 mention of "GarmentCode / ChatGarment / AIpparel papers" should be rewritten to describe the style directly without naming the research.

What **stays**:
- The whole Op Room front-end (v2.4).
- The OpenAI integration (both calls).
- The fal.ai Rodin 3D integration.
- The Vector tab — but the engine swaps from ImageTracer.js to Vectorizer.AI.
- `Back End/manufacturing/` — deterministic patternmaking rules in Python (waistband.py is the first).
- The GarmentCode JSON schema — repurposed as Maya's internal panel schema, divorced from the research repo.

---

## 5 · This week

1. **Sign up for Vectorizer.AI** — $9.99 starter plan, get the API key, drop it into the Settings drawer alongside OpenAI + fal keys.
2. **Replace `vectorizeActivePattern()`** in `op-room.html` with a Vectorizer.AI fetch. ~50 lines. Keep the same DOM hosts (`#vector-preview`, `#vector-empty`, `#vector-caption`).
3. **Rewrite Prompt 2's style block** — strip the research-paper references, replace with a direct description (technical-flat pattern style, McCall's / Burda layout vocabulary).
4. **Try a FashionINSTA trial** if available — see what they ship as DXF, identify the gaps Maya covers that they don't (consultation UX, dream-garment input).
5. **Set a Google Alert** on "ChatGarment", "GarmentCode startup", "image to sewing pattern AI" — the latent threat is a fundraise announcement, not a product launch.

---

*Companion to `Back End/Downloads/MAYA_Next_Steps.pdf` — that doc described the research path; this doc describes the path we're actually taking.*

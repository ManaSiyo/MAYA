#!/usr/bin/env python3
"""
Maya Operation Room — Pattern Book indexer (offline pass)
=========================================================
Turns "Pattern Book.pdf" (Patternmaking for Fashion Design, Joseph-Armstrong,
5e) into the retrieval corpus the Operation Room loads in the browser.

It does NOT embed (no API key needed here). Embedding happens once in the
browser on first run and is cached in IndexedDB — keeps the pipeline
serverless, true to Maya's single-file architecture.

Outputs (into ./kb/):
  - pattern-chunks.json   retrieval passages + chapter/page metadata
  - chapter-map.json      garment-type -> chapter routing table (book pages)

Run:  python3 indexer.py
"""
import json, re, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KB   = os.path.join(HERE, "kb")
# Pattern Book lives one level up, in the self study folder.
PDF  = os.path.normpath(os.path.join(HERE, "..", "self study", "Pattern Book.pdf"))

# pdf_page = book_page + OFFSET  (verified: 657->665, 273->281, 349->357, 515->523)
OFFSET = 8

# The chapters Maya actually pulls construction knowledge from. book pages.
# types "_core" = cross-cutting fundamentals (grainline, seam allowance, notches,
# darts, trueing, measurements) that apply to EVERY garment — always retrievable,
# not locked to one garment type.
CHAPTERS = [
    {"ch": 1,  "title": "Patternmaking Essentials for the Workroom", "start": 1,  "end": 24,  "types": ["_core"]},
    {"ch": 2,  "title": "Form Measurements and Figure Analysis",     "start": 25, "end": 42,  "types": ["_core"]},
    {"ch": 3,  "title": "Drafting the Basic Pattern Set", "start": 43,  "end": 76,  "types": ["bodice", "dress", "_core"]},
    {"ch": 4,  "title": "Dart Manipulation",              "start": 77,  "end": 110, "types": ["bodice", "dress", "shirt", "jacket"]},
    {"ch": 13, "title": "Skirts/Circles and Cascades",    "start": 273, "end": 348, "types": ["skirt"]},
    {"ch": 14, "title": "Sleeves",                        "start": 349, "end": 382, "types": ["shirt", "jacket", "dress"]},
    {"ch": 21, "title": "Shirts",                         "start": 515, "end": 536, "types": ["shirt"]},
    {"ch": 22, "title": "Women's Jackets and Coats",      "start": 537, "end": 572, "types": ["jacket", "coat"]},
    {"ch": 26, "title": "Pants",                          "start": 657, "end": 722, "types": ["pants"]},
]

def extract():
    from pypdf import PdfReader
    r = PdfReader(PDF)

    def page_text(pdf_idx):
        try:
            return r.pages[pdf_idx].extract_text() or ""
        except Exception:
            return ""

    chunks = []
    cid = 0
    for c in CHAPTERS:
        for book_pg in range(c["start"], c["end"] + 1):
            pdf_idx = book_pg + OFFSET - 1   # 0-based
            raw = page_text(pdf_idx)
            if not raw.strip():
                continue
            # normalise whitespace; the book PDF has hyphen-wraps and stray nums
            txt = re.sub(r"-\n", "", raw)
            txt = re.sub(r"\s+", " ", txt).strip()
            # split into ~600-char passages on sentence-ish boundaries, 80 overlap
            for passage in window(txt, size=620, overlap=90):
                if len(passage) < 120:
                    continue
                chunks.append({
                    "id": cid,
                    "ch": c["ch"],
                    "chapter": c["title"],
                    "types": c["types"],
                    "page": book_pg,
                    "text": passage,
                })
                cid += 1
    return chunks

def window(txt, size=620, overlap=90):
    out, i, n = [], 0, len(txt)
    while i < n:
        end = min(i + size, n)
        # try to end on a period for cleaner passages
        if end < n:
            dot = txt.rfind(". ", i + size - 160, end)
            if dot != -1:
                end = dot + 1
        out.append(txt[i:end].strip())
        if end >= n:
            break
        i = end - overlap
    return out

def chapter_map():
    m = {}
    for c in CHAPTERS:
        for t in c["types"]:
            m.setdefault(t, []).append({"ch": c["ch"], "title": c["title"],
                                        "pages": [c["start"], c["end"]]})
    return m

if __name__ == "__main__":
    os.makedirs(KB, exist_ok=True)
    if not os.path.exists(PDF):
        sys.exit(f"Pattern Book.pdf not found at {PDF}")
    chunks = extract()
    with open(os.path.join(KB, "pattern-chunks.json"), "w") as f:
        json.dump({"version": 1, "source": "Patternmaking for Fashion Design, 5e (Joseph-Armstrong)",
                   "embed_model": "text-embedding-3-small", "chunks": chunks}, f)
    with open(os.path.join(KB, "chapter-map.json"), "w") as f:
        json.dump(chapter_map(), f, indent=2)
    print(f"wrote {len(chunks)} chunks across {len(CHAPTERS)} chapters -> kb/pattern-chunks.json")

def bundle_js():
    """Emit kb/kb.js so the sandbox can load the KB via <script src> under file://
    (fetch() of local JSON is blocked under the file:// origin in Chrome)."""
    import json as _j
    chunks = _j.load(open(os.path.join(KB, "pattern-chunks.json")))
    grammar = _j.load(open(os.path.join(KB, "panel-grammar.json")))
    chmap = _j.load(open(os.path.join(KB, "chapter-map.json")))
    with open(os.path.join(KB, "kb.js"), "w") as f:
        f.write("window.MAYA_KB_CHUNKS=" + _j.dumps(chunks, separators=(',',':')) + ";\n")
        f.write("window.MAYA_KB_GRAMMAR=" + _j.dumps(grammar, separators=(',',':')) + ";\n")
        f.write("window.MAYA_KB_CHAPTERS=" + _j.dumps(chmap, separators=(',',':')) + ";\n")
    print("wrote kb/kb.js")

if __name__ == "__main__":
    bundle_js()

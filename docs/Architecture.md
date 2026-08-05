# Maya Frontend Architecture — v10.18

Reference for what's where, what depends on what, and where cascading bugs come from.
Anchor: `frontend.html` (renamed from index.html at v10.18). JS block ~lines 2900–8740.

---

## 1 · State Globals (the bug magnets)

| Global | Written from | Risk |
|---|---|---|
| **`items`** | placeItem, removeItem, _doClear, _restoreSession, plus dozens of indirect `item.card.*` writes (consumeFloatingCards, dissectInspo, toggleFavorite, _dissectFavorite, applyModifications, runFabricSwitch, stackInspirationImages) | HIGH — anything that touches a card writes here |
| **`lastSummary`** | processConsultation (REPLACES — needs the v10.11 `_*` preservation patch), onFacePhotoSelected, clearFacePhoto, saveAvatar, randomizeAvatar, updateClientNameInline, confirmClientName, _restoreSession, _doClear | HIGH — runtime cache (`_face_photo`, `_face_descriptors`, `_measurements`, `_paragraphs`) lives here and is the most-stolen-from-under-you object |
| `currentClientName` | confirmClientName, updateClientNameInline, _restoreSession, _doClear | MED |
| `viewerItemId` | openImageViewer, viewerStep, _doClear, closeGarmentModal | MED |
| `selectedFabricsForVisualize` / `selectedImageReferences` | fabric picker, image-ref picker, _runVisualizeNow snapshot+reset | MED — snapshotted at render start (v9.8) so concurrent renders are safe |
| `visualizeModifications` | applyModifications, _runVisualizeNow snapshot+reset, runModify | MED |
| `_modifyStage` | modifyPrimary, modifySecondary, _resetModifyStage | LOW |
| `_pieceState` (backend) | renderDissection, setActivePiece | LOW |
| `_renderLabels` | pushRenderStatus, popRenderStatus | LOW |

---

## 2 · Function Catalog by Category

### State & Persistence
- `idb(op)` — IndexedDB wrapper, used by everyone for handle/session storage
- `_persistSession()` — debounced 400ms save of `{currentClientName, lastSummary, lastTranscript, items}` to IndexedDB
- `_restoreSession()` — on DOMContentLoaded, replays items via placeItemAt
- `getFolder()` — File System Access folder picker + cache
- `loadFolderHandle()` / `saveFolderHandle()` — IDB read/write
- `verifyPermission(handle)` — query+request FS permission

### Voice & Consultation
- `toggleListening()` — voice bar tap; dismissHints, route to start/stop
- `startListening()` — Web Speech API init, onresult → liveTranscriptBuffer
- `stopListening()` — stop SR + fire processConsultation
- `processConsultation(transcript)` — gpt-4.1 chat extraction → lastSummary merge → placeConsultationCards
- `processMoodboardText(text)` — paste/typed text → extractFashionRefs → placeItemAt (centered, v10.6)
- `extractFashionRefs(text)` — keyword extractor
- `setThinking(on)` — voice bar pulse, "tap to listen" idle text (v9.13)
- `attachCaptionToImages(text)` — dream outcome → vision cards only (v10.17)

### Image Generation
- `visualizeGarment()` — top of the funnel: API key check, auto-mute, **avatar safety check (v10.16)**, open fabric mode
- `_openAvatarCheck(reason)` / `closeAvatarCheck()` / `_continueVisualize()` — v10.16 safety modal
- `chooseFabricMode(mode)` — sourceable/in-house branch
- `_runVisualizeNow()` — snapshots inputs, builds anchors, calls callOpenAIImageEditSafe or callOpenAIImageSafe
- `runModify()` — applyModifications path: prev image + face photo as anchors + face descriptors + measClause
- `_runReCut(targetId, fabrics)` — fabric swap path
- `callOpenAIImageSafe(prompt, size, quality)` — `/v1/images/generations` wrapper with safety retry
- `callOpenAIImageEditSafe(prevDataUrl, prompt, size, quality)` — `/v1/images/edits` wrapper, accepts string OR array of images
- `callOpenAIImage(prompt, ...)` / `callOpenAIImageEdit(prev, ...)` — raw API call (gpt-image-2)
- `buildGarmentPrompt(opts)` — composes prompt from items, fabrics, measurements
- `buildMeasClause()` — height/shoulders/chest/waist/hips clause (v10.12)
- `buildFaceDescriptorClause()` — face descriptors clause (v9.9)
- `_findLineageAnchor()` — most recent Maya vision dataUrl
- `FRAMING_MANDATE` — non-negotiable three-view full-body framing constant (v10.10)
- `_dissectFavorite(it)` — gpt-4.1 vision dissection of favorited cards
- `pushRenderStatus(label)` / `popRenderStatus()` — parallel render counter

### Card Management
- `placeItem(card, delay)` / `placeItemAt(card, x, y)` — both call `_placeItemInternal`
- `_placeItemInternal(card, delay, fixedPos)` — creates DOM, sets classes (isVision, has-caption gate v10.17), pushes to items
- `removeItem(id)` — DOM remove + items splice
- `makeDraggable(el)` — mousedown/move/up drag
- `findFreeSpot(w, h, isImage)` — Pinterest collision finder
- `pinterestLayout()` — auto-arrange w/ column spans (v10.10)
- `consumeFloatingCards()` — text chips fly into the recent image card
- `dissectInspo(itemId)` / `stackDissectedRefs(itemId)` — gpt-4.1 vision extract refs from uploaded inspo
- `stackInspirationImages(itemId)` — collapse repeated uploads
- `_refreshLatestVision()` — only newest Maya vision keeps the glow (v8.2)
- `toggleFavorite(itemId)` — heart toggle + fires _dissectFavorite (v10.9)
- `_dedupeStems(text)` — kill repeated word stems in captions

### Modal & Viewer
- `openImageViewer(itemId)` — fills #garment-modal, calls _resetModifyStage (v10.3)
- `closeGarmentModal()` — closes + clears modify stage + clears photo fullscreen + img.removeAttribute('src') (v10)
- `renderViewerContent(item)` — image, refs chips, fabrics chips, mods bar
- `renderViewerRefs(item)` / `renderViewerFabrics(item)` — chip rendering
- `viewerStep(delta)` — version navigation, also wired to swipe (v10.3)
- `modifyPrimary()` / `modifySecondary()` / `_setModifyStage(stage)` / `_resetModifyStage()` — three-state Modify machine (v10.12)
- `applyModifications()` — Modify apply, captures snapshot then calls runModify
- `switchFabricForViewer()` — opens fabric picker in 'switch' mode
- `enterPhotoFullscreen()` / `exitPhotoFullscreen()` — v10.11 image fullscreen
- `toggleVisualizeListen()` / `startVisualizeListen()` / `stopVisualizeListen()` — second SR instance for modify-while-viewer-open
- `renderModificationsBar()` — italic mods bullets

### Drawer & Avatar
- `toggleNotesDrawer(force)` — horizontal scrollTo (v10.2 native scroll-snap)
- `_renderAvatarBody()` — avatar sub-menu HTML (face + name + measurements form)
- `openAvatarSubMenu()` / `closeAvatarSubMenu()` / `_refreshActiveAvatarView()` — sub-menu open/close
- `saveAvatar()` — measurements + persist (v10.4)
- `onFacePhotoSelected(ev)` — face upload → lastSummary._face_photo + fires analyzeFacePhoto
- `clearFacePhoto()` — wipe face + descriptors
- `analyzeFacePhoto(dataUrl)` — gpt-4.1 vision → face descriptors
- `randomizeAvatar()` — random measurements + random headshot
- `updateClientNameInline(v)` — inline name edit + persist
- `refreshDrawerClientName()` / `refreshDrawerFavoritesCount()` — UI refresh
- `openFabricsDrawer()` / `closeFabricsDrawer()` / `scanFabricsFolder(verbose)` — in-house fabrics

### Save / Submit
- `saveConsultation()` — Save button → doSessionSave (v10.6: NO picker, writes Saves/)
- `doSessionSave()` — writes MAYA/Saves/<name MM-DD-YYYY>/ — moodboard+summary+transcript+inspos
- `doSave()` — writes MAYA/Clients/<name MM-DD-YYYY>/ — adds one-pager.pdf + dream-garment.png (v10.15)
- `submitFavorite()` — v10.7 inspo picker pre-flight → _doSubmitConfirmed
- `_doSubmitConfirmed()` — fires doSave + thank-you overlay
- `downloadBundle()` — Safari/no-FSA fallback
- `writeText(dir, name, text)` / `writeBlob(dir, name, blob)` — FS write helpers
- `slugify(name)` — folder name helper

### One-Pager Generation
- `generateOnePagerParagraphs(summary)` — gpt-4.1 chat → biography + vision paragraphs (3-line cap v10.5)
- `PARAGRAPHS_SYSTEM_PROMPT` — atelier-editorial prompt
- `renderOnePagerPdfBlob()` — orchestrates page1+page2 → jsPDF
- `htmlToCanvas(html)` — html2canvas wrapper (scale 3× v10.5)
- `buildPage1Html(summary, heroDataUrl)` — cosmic glass page 1 (v10.5)
- `buildPage2Html(summary, items)` — fabrics + CLO + audio section
- `buildPersonParagraph(summary)` / `buildVisionParagraph(summary)` — fallback paragraphs
- `buildMeasurementsTwoColumnHtml(summary)` — centered measurements grid (v10.14)
- `openHeroPicker(cards)` / `closeHeroPicker()` / `chooseHeroImage(dataUrl)` — only for "Pick different image" flow now
- `_showOnePagerPreview(dataUrl)` — opens onepager-modal
- `saveFromPreview()` — fires doSave from the preview modal
- `downloadOnePager()` — direct PDF download

### Splash & Screen Navigation
- `splashLock()` / `splashUnlock()` — show/hide splash overlay
- `splashSubmit()` — name + password gate (8088)
- `logoutMaya()` — _doClear + IDB session wipe + splashLock (v10.7)
- `openBackend()` — opens backend.html in new tab
- `setScreen(n)` — programmatic scrollTo (v10.1 native scroll-snap)
- `_syncScreenUI(n)` — wordmark text swap + dot active state (v10.5)
- `_bootScreenObserver()` — IntersectionObserver wires sections to _syncScreenUI
- `toggleScreen()` / `brandTitleClick()` — wordmark click → Pinterest layout (v10.6 restored)
- `_renderFavoritesScroller()` — favorite cards w/ dissection hover (v10.9)
- `openFavoriteForSubmit(itemId)` — open viewer in submit-mode

### Pickers
- `openFabricMode()` / `closeFabricMode()` / `chooseFabricMode(mode)` — in-house vs sourceable
- `openFabricPicker(mode)` / `closeFabricPicker()` — fabric multi-select
- `toggleFabricPick(fabricId)` / `confirmFabricPick()` — fabric selection
- `openImageRefPicker(cards)` / `closeImageRefPicker()` / `pickImageRef(idx)` / `confirmImageRef()` / `skipImageRef()` / `updateImageRefConfirm()`
- `openFavoriteInspoPicker(cards)` / `closeFavoriteInspoPicker()` / `toggleFavoriteInspo(id)` / `confirmFavoriteInspo()` / `skipFavoriteInspo()` / `updateFavoriteInspoConfirm()` — top-3 inspo selection
- `openClientNameModal()` / `closeClientNameModal()` / `cancelClientName()` / `confirmClientName()` — new consultation name

### Utilities
- `escapeHtml(s)` / `slugify(name)` — string helpers
- `dismissHints()` — onboarding (v10.8)
- `clearAll(silent)` / `_doClear()` — full reset
- `cleanReferences()` — drawer Clean button (refs only, images stay)
- `newConsultation()` — drawer New button
- `showToast(msg, error)` / `showError(msg)` — bottom toast
- `setStatus(text)` — top brand status text
- `isSafetyRejection(e)` / `rewriteForSafety(prompt)` — image API safety retry

---

## 3 · Feature Surface

| Feature | Trigger | Functions involved | Side effects |
|---|---|---|---|
| New consultation | Drawer "New" button | newConsultation → openClientNameModal → confirmClientName → clearAll → _doClear | Wipes items, lastSummary, lastTranscript, IDB session |
| Voice consultation | Voice bar tap | toggleListening → startListening → onresult appends → stopListening → processConsultation | Mutates liveTranscriptBuffer, lastTranscript, lastSummary (merge); creates cards via placeConsultationCards |
| Drag-drop inspo | File drop / + upload inspo | inspo-file change handler → handleUpload → placeItem | Creates uploaded inspo card (no inspirationId, no caption v10.17) |
| Paste / type text | Paste modal textarea | processPasted → processMoodboardText → placeItemAt centered | Creates chip cards centered on viewport (v10.6) |
| Dissect inspo | Hover inspo → Dissect button | dissectInspo → gpt-4.1 vision → placeItemUnique chips | Mutates card.dissected; creates ref chips |
| Visualize | Visualize button | visualizeGarment → avatar check → openFabricMode → chooseFabricMode → _runVisualizeNow → callOpenAIImageEditSafe → placeItem | Snapshots & resets selectedFabricsForVisualize, selectedImageReferences, visualizeModifications |
| Modify | Viewer Modify button (3-state) | modifyPrimary → 'prompt' → modifyPrimary → 'listening' → startVisualizeListen → modifySecondary → stopVisualizeListen → applyModifications → runModify | Same snapshot pattern; preserves face photo as anchor |
| Re-cut (switch fabric) | Viewer Switch fabric (prompt stage) | modifySecondary → switchFabricForViewer → openFabricPicker → confirmFabricPick → _runReCut | Original image + face photo as anchors |
| Favorite | Heart on card / viewer secondary in default | toggleFavorite → fires _dissectFavorite → persists | Mutates card.favorited, card._dissection; persists session |
| Save | Drawer "Save" | saveConsultation → doSessionSave | Writes MAYA/Saves/<slug MM-DD-YYYY>/ |
| Submit | Viewer Submit (favorites-mode) | submitFavorite → openFavoriteInspoPicker (if uploads) → _doSubmitConfirmed → doSave | Writes MAYA/Clients/<slug MM-DD-YYYY>/ + dream-garment.png + one-pager.pdf |
| Screen swipe | Vertical scroll (native) | _bootScreenObserver IntersectionObserver → _syncScreenUI | Toggles body.viewing-favorites, swaps brand title |
| Drawer | Hamburger / horizontal swipe (native) | toggleNotesDrawer → hscroll.scrollTo | Updates body.drawer-open |
| Avatar | Drawer avatar button | openAvatarSubMenu → _renderAvatarBody → onFacePhotoSelected / saveAvatar | Mutates lastSummary._face_photo, ._face_descriptors, ._measurements; persists |
| Esc back | Keydown | Universal Esc chain (v10.11): thank-you → photo fullscreen → modal → avatar sub-menu → drawer → screen 1 | Steps one level back |
| Settings | Drawer Settings link | openSettings → API key + model + quality | Writes localStorage |
| Logout | Drawer Logout | logoutMaya → _doClear + IDB session wipe → splashLock | Full reset |

---

## 4 · Coupling Hot Spots — where bugs cascade

### Hot Spot #1 — `lastSummary` write sites
**6 functions write here.** The `_*` runtime fields (`_face_photo`, `_face_descriptors`, `_measurements`, `_paragraphs`) live on this object alongside LLM-extracted fields. Any function that replaces `lastSummary = newObj` will wipe runtime state unless it preserves underscore-prefixed keys.

- Existing protection: `processConsultation` patch (v10.11) preserves `_*` keys.
- **Watch:** if you ever add another `lastSummary = ` assignment, you must include the same preserve loop.

### Hot Spot #2 — `items` array & card mutations
**12+ functions read/write items[*].card.\*** Card objects flow through placement, dragging, consumption, dissection, modification, favoriting, and saving. Adding a new card property means making sure these callers handle it:

- Save serializers: `doSessionSave`, `doSave`, `_persistSession` — strip transient fields (dataUrl on fabrics, _dissectionPending)
- Restore: `_restoreSession` — replay via placeItemAt
- Render: `_placeItemInternal` — set classes from card.* fields (isVision, has-caption gate)

### Hot Spot #3 — Modify state machine
**Three states (`default`, `prompt`, `listening`) × two buttons (primary, secondary)** = six button labels and six click destinations. When you change one label, the other states often need updating too. Look at `_setModifyStage(stage)` first.

### Hot Spot #4 — CSS specificity on `.item-card.inspo`
The inspo card has rules for: base, `.has-caption` (v10.18 now no-op), `.is-vision`, `.is-vision.is-latest` (glow), `.tinted`, `.fav`, `.warn`, `.strong`, `:hover`, and hover-child rules (`.item-title`, `.item-caption`, `.fav-btn`, `.dissect-btn`, `.stack-btn`, `.delete-btn`, `.resize-handle`). These pile up — adding a new state requires checking all overrides.

### Hot Spot #5 — Render anchor stacking in `_runVisualizeNow`
**Four branches** (face photo, refs+lineage, lineage only, text only) each compose a different anchor array + prompt. They all must include: `measClause`, `faceDescClause`, `FRAMING_MANDATE`. Easy to add a fifth branch and forget one. Modify and Re-cut have parallel logic in `runModify` and `_runReCut`.

---

## Top 5 places to test after any change

1. **Avatar drawer end-to-end** — open, set face, set measurements, close, render. Check `lastSummary._measurements` and `_face_photo` survive: consultation → render → reload → drawer reopen.
2. **Submit flow** — favorite a vision, click Submit, attach inspos, confirm thank-you, verify `MAYA/Clients/<name>/` has `dream-garment.png` + `one-pager.pdf` + `moodboard.json` with `_dissection`.
3. **Three render paths** — face only / no face + style ref / no face + lineage. All three must produce three-view full-body images with the FRAMING_MANDATE applied.
4. **Modify state machine** — open viewer → Modify → Describe changes → Listening → Modify (apply). Check all three states render correct labels.
5. **Restore from IDB** — refresh page mid-session. Items, lastSummary, currentClientName, face photo, measurements all return.

---

*Generated v10.18. Update this doc when adding new state globals or features.*

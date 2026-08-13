# MAYA v12.9, what was just fixed
For the second reviewer. Everything below is already done, so please spend your
time elsewhere. Files: index.html (the app), status.html (Systems Map),
backend.html (the Brief).

## The 24 duplicate cards
Four separate causes, all fixed:

1. `_snapshotForCloud` saved items with no DOM element. Consumed references
   were being written to the cloud and restored as real cards, then saved
   again. Now filters on `it.el` and on a new `_removing` flag.
2. Nothing deduped on save. Now dedupes by `_cardSig` (kind, tag, title,
   inspirationId, last 64 chars of the image URL). Ids are useless for this
   because they are reassigned on every restore.
3. Nothing deduped on load. New `_paintItems()` is the single painter used by
   both `projectStore.open` and the realtime listener; it skips duplicate
   signatures and ghosts, counts what it dropped, and the caller writes the
   cleaned project back once.
4. `_placeItemInternal` places on a `setTimeout`. Cards scheduled before a
   `_doClear` still landed after it, so two paints could interleave into a
   doubled board. Now carries `_boardEpoch` and gives up if the board changed.

## Repeated fabrics
`placeItemUnique` tested for an existing similar title synchronously, but
placed the card on a delay of up to several seconds. A whole batch therefore
checked against a board none of them had landed on. Added `_pendingTitles`,
claimed at queue time, released at placement, cleared on `_doClear`.
`processMoodboardText` also placed without any dedupe; it now goes through
`placeItemUnique`.

## Controls that did not work
- The heart. `makeDraggable` guarded with `e.target.classList.contains('fav-btn')`,
  but the heart is a button containing an SVG, so clicking the middle of it hit
  the SVG, the guard missed, a drag started, pointer capture swallowed the
  click, and the card's own handler opened the viewer. All five guards now use
  `closest()`, in both the drag handler and the card click handler.
- The X on a stacked group. `stackInspirationImages` gave later siblings a
  higher z-index, covering each card's top-right corner where the X and stack
  buttons live. Reversed to `100 - idx` so the first card is on top, matching
  `pinterestLayout`. Drag also used to wipe stack order on release; it now
  restores it.

## Never persisted
`pinterestLayout` (Organize), `stackInspirationImages`, and the resize handle
all mutated the board without saving. Added. Also removed `uploadStackHead`,
a field written onto every card and read by nothing.

## The self refreshing screen
- The Firestore listener did not check `metadata.hasPendingWrites`, so MAYA
  reacted to its own writes and rebuilt the whole canvas after every save.
- `projectStore._sig` included card ids, which change on every restore, so two
  devices could never agree and rebuilt each other in a loop. Now content based.
- Painting a restored project queued a save of what had just been read. The
  `_hydrating` guard missed it because placement happens in a `setTimeout`, so
  an explicit `isRestore` flag is threaded through `placeItem`/`placeItemAt`.
- A broken image retried forever, roughly every two seconds, hiding and
  re-showing its card and rebuilding the whole favourites strip. Capped to one
  re-issue per picture per page load, and it now swaps the single image in
  place instead of rebuilding the strip.

## Performance
`transition: all 0.2s` on cards animated position and the glass blur on every
pointer move during a drag. Now only colour and shadow, and nothing at all
while dragging. Two box-shadow animations that ran forever on every card are
scoped. `findFreeSpot` measured every card forty times over. The favourites
strip rebuilt three times per swipe. The face photo is shrunk to 640px before
being deep-copied on every save. The 3D viewer parked when off screen.

## Systems Map
- Google sign in lasts one hour and nothing renewed it, which is why the page
  asked for a sign in that had already happened. Renews silently five minutes
  before expiry, tries silently before nagging, and gives up after three tries
  rather than popping One Tap forever.
- The empty state was hidden before the signature guard and restored after it,
  so on the second poll an empty strip appeared with no explanation.
- Two overlapping repaint timers became one, visibility gated, with signature
  guards so nothing repaints unless it changed.
- Green unread dot on Recent changes, cleared on open.

## Still worth a look
- `projectStore.reconcile()` downloads every project in full. It is now gated
  to drawer-open and once every two minutes, but a proper metadata-only index
  would be better.
- `dedupeSweep` is O(n squared) title comparison every ten seconds while a
  consultation is running.
- No automated tests cover any of this. Firebase emulator tests for New, save
  failure, two devices, delete, and sign out would have caught most of the
  above.

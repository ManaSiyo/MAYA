# The fabric sourcing study, August 22 2026

What this is: the online research Fromsa asked for before we design MAYA's
real Sourceable window. The goal, in his words: MAYA's clients imagine a
garment, MAYA recommends fabrics closely related to that imagination, and
eventually orders them. RETAIL sourcing, worldwide, no minimums; two to
three yards must be a normal order. Wholesale-only merchants are out.

## Who actually has the fabric, retail, no MOQ

Tier one, the anchors. Big inventory, cut by the yard, ship internationally:

- SWATCHON (Seoul, the Korean site Fromsa remembered): 20,000+ fabrics,
  1 yard minimum, video swatches of every fabric stretching and draping.
  Built for small fashion brands, which is exactly MAYA's client. No public
  API, but they run a partner program and an image based fabric search of
  their own. The single best catalog fit for MAYA; worth a partnership
  email early. swatchon.com
- Mood Fabrics (New York): the household name, huge range, by the yard,
  ships worldwide. Runs on Shopify.
- Amazon (Fromsa's second bet): enormous fabric selection by the yard,
  fast shipping, honest reviews. Their official Product Advertising API is
  gated behind an Associates account with qualifying affiliate sales, so
  day one integration is search links; a SERP style API covers it sooner.
- Etsy: artisan, deadstock and world fabrics, per listing, no minimums.
  Etsy's Open API v3 is free and approachable (personal app approval), and
  it returns listings with pictures and prices. The easiest REAL
  integration of the lot.

Tier two, curated garment fabric shops the sewing public actually
recommends (Seamwork's guide and the communities around it), by the yard,
no minimums, each on Shopify or similar:

- United States: Stonemountain & Daughter (Berkeley), Emma One Sock
  (curated designer), Harts Fabric, Bolt, Spandex House (stretch), A
  Thrifty Notion (deadstock).
- Canada: Blackbird Fabrics (Vancouver), Fabcycle (deadstock).
- United Kingdom: Fabric Godmother, Guthrie & Ghani, Merchant & Mills
  (workwear linens), Croft Mill.
- Europe: Pretty Mercerie (France), Tissu & Co (Switzerland), Selfmade
  (Denmark and stores across Europe).
- Asia and Pacific: Miss Matatabi (Tokyo, Japanese designer fabrics),
  YardBlox (Hong Kong), The Fabric Store (New Zealand), Tessuti (Sydney),
  Indy Bindy (Australia, Japanese artisan).
- Deadstock and designer surplus: The Fabric Sales (Antwerp), Fabscrap
  (New York), Queen of Raw (marketplace).

Joann is gone (closed in 2025), so the hobby market's default died; the
public has scattered to exactly the stores above, which is good for MAYA.

## The four ways to power the window, explained properly

1. HEX FROM THE DISSECTION (applied in v13.49). gpt-4.1 already looks at
   the garment picture to write the dissection; it now also returns each
   piece's dominant fabric color as a hex it READ FROM THE IMAGE. Why the
   color was wrong before: the old pipeline threw the image away and tried
   to recover color from words ("crimson" was not even in the word table)
   or from an average of every pixel in the picture, background included.
   Asking the model that is already looking is strictly better and costs
   nothing extra.

2. LIVE MERCHANT SEARCH, server side. How it actually flows: the client
   opens Fabrics, MAYA's SERVER (not the browser; browsers are blocked by
   CORS) queries a handful of merchant sites' own public product feeds
   (Shopify stores expose /products.json and /suggest.json without any
   key), gets back real products with real prices and pictures, filters
   them by the dissected hex, and returns the best twelve. "Cache" just
   means: remember the result for a while, so ten clients asking for
   crimson wool within an hour costs one fetch, not ten; it makes the
   window instant and keeps MAYA a polite guest instead of hammering a
   shop with repeated identical requests. "Theme change" risk is only
   this: these feeds are conventions, not contracts; a store can
   restructure and the feed shape can shift, so the code treats each
   merchant as optional and skips one that stops answering instead of
   breaking the window.

3. GOOGLE SHOPPING THROUGH A SERP API, explained. Google Shopping already
   indexes nearly every fabric store on earth with live prices. Google
   sells no public API for it, so services (SerpApi, Serper, SearchAPI)
   run the search and hand back clean JSON: title, store, price, picture,
   link. Cost is roughly one to three dollars per thousand searches;
   with per fabric caching a dissection costs a fraction of a cent. This
   is the breadth play: when the curated merchants have no match for
   "holographic pleated lame", Google Shopping still answers.

4. TRUE VISUAL MATCHING (CLIP/FashionCLIP embeddings), and why it waits:
   not because the model is hard, because the DATA is. Embeddings compare
   the garment crop against a library of product images, which means MAYA
   must first HAVE that library: tens of thousands of product records
   ingested, refreshed, and stored in a vector index. Option 2 IS the
   ingestion pipeline; option 4 is what those same records make possible
   once they exist. Building 4 first would mean building 2 anyway and
   then more. So the order is 1 (done), 2, 3 as fallback, 4 when the
   catalog exists. SwatchOn partnership could shortcut 4: they already
   built image search over their own 20,000 fabrics.

## Ordering ON BEHALF of clients, the honest note

Recommending links is free of obligations. Placing orders needs either a
merchant API with checkout (Etsy supports app checkout flows; Shopify
stores would need per store arrangements; SwatchOn would need the
partnership), or an ordering service in the middle. That is a business
step, not just code: start with SwatchOn and Etsy, whose platforms are
built for it.

Sources: swatchon.com/fabric (1 yard MOQ, 20,000+ fabrics),
support.swatchon.com, seamwork.com/fabric-guides/the-best-places-to-buy-
fabric-online, developers.etsy.com/documentation, webservices.amazon.com/
paapi5/documentation (Associates requirement), dev.to on PA-API
restrictions and Shopify products.json, searchcans.com SERP API pricing
index 2026, elastic.co and width.ai on CLIP/FashionCLIP product search.

/* MAYA CLO library manifest (v13.61).
   Plan B in the Operations Room matches a client photo against this list and
   names the closest proven CLO reference instead of drawing geometry.

   Each entry:
   {
     id:    'wrap-dress-01',                unique slug
     name:  'Wrap dress, cap sleeve',       shown in the Plan B match list
     types: ['bodice'],                     grammar keys from kb.js (what resolveType returns)
     tags:  ['wrap','v-neck','cap sleeve'], lowercase words matched against what vision sees
     file:  'clo/wrap-dress-01.zprj'        where the CLO project lives (any note works)
   }

   Scoring: a grammar type match is worth 3, each tag the vision pass sees is
   worth 1. Empty on purpose until real CLO references are added; the Plan B
   panel says so honestly instead of inventing matches. */
window.CLO_LIBRARY = [];

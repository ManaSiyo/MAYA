# CLO 3D integration research

Research for a possible future pattern-making workflow; no integration has been
implemented and the current Operation Room is unchanged.

## What MAYA has today

`backend/operations.html` Plan B asks `/api/admin/clo-search` for CLO-SET
results, falls back to `aesthetics/operations/clo-library.js`, and displays a
reference. It is a library search, not an embedded CLO editor or a connection
to a running CLO desktop application. The local reference manifest may be empty.
The server endpoint and its optional account configuration are in
`docs/server/server.js`. No provider connection or asset availability has been
verified by this research.

## What CLO documents

- The [CLO API/SDK](https://developer.clo3d.com/) supports plug-ins that run
  inside desktop CLO; Python scripts can also run in its
  [Python editor](https://developer.clo3d.com/python.html) or be registered as
  [plug-ins](https://developer.clo3d.com/register.html). Windows and macOS
  have different compiled plug-in formats, and the SDK must match the installed
  CLO version ([downloads](https://developer.clo3d.com/download.html)).
- The [API list](https://developer.clo3d.com/list.html) documents pattern and
  import/export operations. CLO's [changelog](https://developer.clo3d.com/changelog.html)
  documents `ExportThumbnail2D`, a capture of the displayed 2D window. This is
  an image, not proof of a live editable browser window.
- CLO documents [DXF import/export](https://support.clo3d.com/hc/en-us/articles/115000493067-2D-Pattern-DXF-Import-Export),
  including DXF-AAMA and DXF-ASTM. Any exchange needs practical checks for
  units, pattern outlines, notches, grainlines and grading before it can be
  relied on for production.
- CLO's [GUI API](https://developer.clo3d.com/gui_api.html) builds windows
  and panels inside an open CLO application. The reviewed documentation does
  not establish a supported way to embed its interactive 2D editor in MAYA.

## A sensible future experiment

Start with a manually selected, non-sensitive sample: open its DXF in CLO,
export it again, and compare units, piece count, outlines and markings. A second
experiment could use a version-matched Python plug-in to export a 2D snapshot
and named pattern information for a user-selected project. An image preview is
read-only; editing remains in CLO. Only after that works should an authenticated
local connector be considered, with explicit user initiation, account/project
binding and no public listener. Never send or mix another client's files.

Confirm the installed CLO version, platform, licensing and actual SDK behavior
before choosing an approach. A browser-based editable 2D editor would require
separate research and engineering; it must not be described as a CLO API feature
without vendor confirmation. No production credentials were accessed or changed.

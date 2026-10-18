# Retired Admin dashboard sections — October 17, 2026

The owner retired the visible Prompting Engine editor and Architecture dashboard fold. These historical fragments and guarded editor logic are retained for reference only. They are not a standalone page, are not loaded by Admin, and must not be reconnected without a new product decision. The editor depended on the former Admin Firebase compat SDK and `_fbBridge` sign-in calls.

No saved configuration was removed or migrated. `config/prompting` remains live: `frontend/index.html` and `playground/index.html` read it after authenticated sign-in and use character, background, style and body instructions in image prompts. Firestore rules remain unchanged. Existing private fallback drafts at `users/{uid}/settings/prompting` are retained; those drafts were never live render settings. The retirement removes the Admin editing interface, not the current live rendering behavior.

`tests/admin-prompt-saves.mjs` now checks the active App and Playground readers and protects retirement of the Admin UI. It deliberately does not execute this inactive backup.

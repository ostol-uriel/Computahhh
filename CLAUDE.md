# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Deadline Guardian** — a Manifest V3 Chrome extension that fetches Canvas LMS assignments via the Canvas REST API and surfaces them as countdowns + browser notifications. Spec lives in `Computahhh docs.pdf`. No build step, no bundler, no tests — vanilla HTML/CSS/JS loaded directly by Chrome.

## Loading & iterating

- Load: `chrome://extensions` → Developer mode → "Load unpacked" → repo root.
- After editing `background.js` or `manifest.json`, click the reload icon on the extension card (the service worker only restarts on reload).
- After editing `popup.*`, just close & reopen the popup.
- Inspect the popup: right-click the popup → Inspect.
- Inspect the service worker: `chrome://extensions` → "service worker" link under the extension.
- Test against a real Canvas instance with a Personal Access Token (Account → Settings → New Access Token). Token + base URL are stored in `chrome.storage.local`.

## Architecture

Two execution contexts share state through `chrome.storage.local`:

- **Popup (`popup.js`)** owns sync. On "Sync Deadlines" it calls `GET /api/v1/courses?enrollment_state=active`, fans out to `GET /api/v1/courses/{id}/assignments?bucket=upcoming` per course, flattens, filters items with `due_at`, sorts ascending, and writes the array to `storage.local.deadlines` (plus `lastSyncAt`). Per-course fetch failures are swallowed so one broken course doesn't kill the sync. After writing, it posts `{type: "deadlines-updated"}` so the worker re-checks immediately.
- **Service worker (`background.js`)** owns notifications. A `chrome.alarms` alarm named `deadline-check` fires every 30 min (and on the `deadlines-updated` message) and walks `storage.local.deadlines`, emitting tiered `chrome.notifications` at **3d / 1d / 3h** before `due_at`. The `3h` tier is "urgent" (priority 2, `requireInteraction: true`); others are normal.

### Storage keys (the contract between the two contexts)

- `canvasUrl`, `apiToken` — settings.
- `deadlines` — array of `{id, courseId, courseName, title, dueAt, htmlUrl}`. This is the single source of truth the worker reads.
- `lastSyncAt` — ISO string for the popup's "Last synced" line.
- `notified` — map of `"<assignmentId>:<tier>"` → timestamp. Dedupes notifications across worker wake-ups. **Never reset this casually** — clearing it will re-fire every tier on the next alarm.
- `notifiedMap` — map of `notificationId` → `{url, key}`. Used by the `notifications.onClicked` handler to open the assignment in Canvas. Rewritten each check (only holds the latest batch).

### Urgency tiers (kept in sync between popup and worker)

Both files independently classify deadlines and the thresholds must agree:

- `popup.js` `getUrgency()` — labels: overdue / urgent (<24h) / soon (<3d) / normal.
- `background.js` `NOTIFICATION_TIERS` — fires at 3d, 1d, 3h.

If you change one, change the other. Same goes for the `HOUR_MS` / `DAY_MS` constants duplicated in both files.

### Permissions in `manifest.json`

- `host_permissions: https://*/*` is intentionally broad because the user supplies their own Canvas hostname (could be `*.instructure.com`, a school's vanity domain, etc.). Don't narrow this without making the user re-enter the URL or adding `optional_host_permissions` flow.
- `notifications`, `alarms`, `storage` are all required by the worker.

## Conventions

- No frameworks, no transpilation. Keep it that way unless the user asks — the spec calls out a 3–8h hackathon scope.
- Canvas API calls go through `canvasFetch()` in `popup.js`, which appends `per_page=100` and sets the bearer token. Reuse it rather than calling `fetch` directly.
- Notification `iconUrl` must be a packaged path (`icons/icon128.png`) — Chrome won't fetch remote icons from a service worker.

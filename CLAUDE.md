# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Mayari** (originally "Deadline Guardian") — a Manifest V3 Chrome extension that fetches Canvas LMS data via the Canvas REST API and surfaces it as countdowns + browser notifications. Spec lives in `Computahhh docs.pdf`. No build step, no bundler, no tests — vanilla HTML/CSS/JS loaded directly by Chrome.

The popup is a 3-tab UI (`popup.html`):
1. **Assignments** — deadline list with filters (all / today / week / overdue), sectioned by urgency, plus summary counts.
2. **Notifications** — merged feed of Canvas announcements, Canvas inbox messages, and locally-fired app notifications (overdue, tier reminders, custom reminders, class reminders).
3. **Classes** — user-managed list of recurring class meetings (subject, link, meeting type, days, time) with "Join Class" and "Remind Me" actions.

## Loading & iterating

- Load: `chrome://extensions` → Developer mode → "Load unpacked" → repo root.
- After editing `background.js` or `manifest.json`, click the reload icon on the extension card (the service worker only restarts on reload).
- After editing `popup.*`, just close & reopen the popup.
- Inspect the popup: right-click the popup → Inspect.
- Inspect the service worker: `chrome://extensions` → "service worker" link under the extension.
- Test against a real Canvas instance with a Personal Access Token (Account → Settings → New Access Token). Token + base URL are stored in `chrome.storage.local`.

## Architecture

Two execution contexts share state through `chrome.storage.local`:

- **Popup (`popup.js`)** owns sync and all UI. On "Sync" (`fetchDeadlines()`) it:
  1. `GET /courses?enrollment_state=active`, then per course `GET /courses/{id}/assignments?bucket=upcoming&order_by=due_at`.
  2. For each assignment, fans out to `GET /courses/{id}/assignments/{aid}` (prerequisites, description, locked) and `GET /courses/{id}/assignments/{aid}/submissions/self` (submitted/workflow_state) in parallel.
  3. Flattens, keeps `dueAt >= now - 7d` (so recently-overdue items still show), sorts ascending, writes to `storage.local.deadlines`.
  4. Re-applies prior `isDone` from the previous `deadlines` array, and marks `isDone = true` if Canvas reports `submitted`.
  5. Calls `fetchAnnouncements()` (`/announcements?context_codes[]=course_<id>&...`) and `fetchInbox()` (`/conversations`), filters/sorts to last 7 days, writes to `storage.local.notifications`.
  6. Per-course / per-assignment fetch failures are swallowed so one broken course doesn't kill the sync.
  7. Posts `{type: "deadlines-updated"}` so the worker re-checks immediately.

- **Service worker (`background.js`)** owns notifications + alarms. A `chrome.alarms` alarm named `deadline-check` fires every 30 min (and on the `deadlines-updated` message) and runs `checkDeadlines()`, which:
  - Walks `storage.local.deadlines`, skipping items with `isDone`.
  - Fires individual **overdue** notifications for items whose `due_at` just passed (within the last hour).
  - Groups all not-yet-notified upcoming items into one **tier** notification per check (3d / 1d / 3h windows). The grouped notification consolidates multiple due-soon items into a single OS notification ("Multiple Deadlines"); per-item dedupe still uses the `notified` map.
  - Updates the `chrome.action` badge with the count of items due in <24h (green / orange / red by count).
  - Calls `pushAppNotification()` to mirror everything fired into `appNotifications` for the in-popup feed.

### Storage keys (the contract between the two contexts)

- `canvasUrl`, `apiToken` — settings.
- `deadlines` — array of `{id, courseId, courseName, title, dueAt, htmlUrl, prerequisites, description, locked, lockExplanation, submitted, workflowState, isDone}`. Single source of truth the worker reads.
- `notifications` — array of Canvas-sourced items (announcements + inbox). Rewritten each sync.
- `appNotifications` — array of locally-fired notifications (capped at 100, newest first via `unshift`). Written by the worker via `pushAppNotification()`.
- `dismissedNotifications` — array of `"<type>:<id>"` keys the user has dismissed in the popup feed (or marked all read).
- `classes` — user-defined classes: `{id, name, meetingLink, meetingType, classTime, days}` where `days` is a subset of `["sun","mon",...,"sat"]` (popup omits Sunday from the picker but the data model supports it).
- `lastSyncAt` — ISO string for the popup's "Last synced" line.
- `notified` — map of `"<assignmentId>:<tier>"` → timestamp. Dedupes notifications across worker wake-ups. **Never reset this casually** — clearing it will re-fire every tier on the next alarm.
- `notifiedMap` — map of `notificationId` → `{url, timestamp}`. Used by the `notifications.onClicked` handler to open the relevant URL in a new tab. Pruned every check (entries older than 7d are dropped).

### Alarm naming convention (background.js dispatch is prefix-based)

The `chrome.alarms.onAlarm` handler dispatches by name prefix — keep names unique:

- `deadline-check` — the recurring 30-min sweep.
- `remind_<assignmentId>` — user-set custom reminder from the popup's Remind menu (one-shot).
- `class_<classId>` — class reminder fired ~15 min before the next occurrence (one-shot, set via "Remind Me" button).
- `classstart_<classId>` — fires at class start time, then **auto-reschedules itself** to the next occurrence inside `fireClassStart()`. `scheduleAllClassStartAlarms()` clears all existing `classstart_*` alarms and recreates them on `chrome.runtime.onStartup`/`onInstalled` and on receipt of a `{type: "classes-updated"}` message.

### Urgency tiers (kept in sync between popup and worker)

The two files independently classify deadlines and the thresholds must agree:

- `popup.js` `getUrgency()` — labels: overdue / urgent (<24h) / soon (<3d) / normal.
- `popup.js` `getTimeCategory()` — section headers: overdue / urgent (<1h) / today (<24h) / week (<7d) / later.
- `background.js` `NOTIFICATION_TIERS` — fires at 3d, 1d, 3h.

If you change one, change the others. Same goes for the `HOUR_MS` / `DAY_MS` constants and `getNextClassDate()` / `DAY_NUMBER` map duplicated in both files.

### Permissions in `manifest.json`

- `host_permissions: https://*/*` is intentionally broad because the user supplies their own Canvas hostname (could be `*.instructure.com`, a school's vanity domain, etc.). Don't narrow this without making the user re-enter the URL or adding `optional_host_permissions` flow.
- `notifications`, `alarms`, `storage` are all required by the worker.
- The popup also opens links via `chrome.tabs.create` (Open / Join Class / notification clicks) — `tabs` permission is implicit when the popup itself triggers it.

## Conventions

- No frameworks, no transpilation. Keep it that way unless the user asks.
- Canvas API calls go through `canvasFetch(baseUrl, token, path)` in `popup.js`, which appends `per_page=100` and sets the bearer token. Reuse it rather than calling `fetch` directly.
- All notifications fired from the worker should also call `pushAppNotification({id, type, title, courseName, message, htmlUrl})` so they appear in the in-popup feed. The popup listens to `chrome.storage.onChanged` for `appNotifications` and re-renders live.
- `popup.js` `escapeHtml()` is required for any user/Canvas-sourced string interpolated into `innerHTML`. The classes and notifications renderers both use it; new HTML-string render paths must too.
- Notification `iconUrl` must be a packaged path (`icons/icon128.png`) — Chrome won't fetch remote icons from a service worker.
- Dismissals are keyed by `"<type>:<id>"`. When introducing a new notification type, make sure the `id` is stable across renders or the dismissal won't stick.

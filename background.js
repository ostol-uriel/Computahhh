const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const CHECK_ALARM = "deadline-check";
const CHECK_PERIOD_MIN = 30;

const NOTIFICATION_TIERS = [
  { key: "3d", windowMs: 3 * DAY_MS, label: "in 3 days" },
  { key: "1d", windowMs: DAY_MS, label: "in 1 day" },
  { key: "3h", windowMs: 3 * HOUR_MS, label: "in 3 hours" },
];

chrome.runtime.onInstalled.addListener(initAlarm);
chrome.runtime.onStartup.addListener(initAlarm);

function initAlarm() {
  chrome.alarms.create(CHECK_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_PERIOD_MIN,
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM) {
    runChecks();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "deadlines-updated") {
    runChecks();
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  const { notifiedMap } = await chrome.storage.local.get("notifiedMap");
  const entry = notifiedMap?.[id];

  if (entry?.url) chrome.tabs.create({ url: entry.url });

  chrome.notifications.clear(id);
});

async function runChecks() {
  await checkDeadlines();
  await checkClassReminders();
}

async function checkDeadlines() {
  const { deadlines = [], notified = {}, notifiedMap = {} } =
    await chrome.storage.local.get(["deadlines", "notified", "notifiedMap"]);

  const now = Date.now();
  const sent = { ...notified };
  const newMap = { ...notifiedMap };

  let upcoming = [];
  let grouped = [];

  for (const d of deadlines) {
    if (!d.dueAt) continue;

    const dueMs = new Date(d.dueAt).getTime();
    const diff = dueMs - now;

    // OVERDUE (within 1 hour window)
    if (diff <= 0 && diff > -1 * HOUR_MS) {
      const key = `${d.id}:overdue`;
      if (!sent[key]) {
        chrome.notifications.create(`overdue-${d.id}`, {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "❌ Assignment Overdue",
          message: `${d.courseName}\n${d.title}\nYou missed the deadline.`,
          priority: 2,
          requireInteraction: true,
        });

        sent[key] = now;
      }
      continue;
    }

    if (diff <= 0) continue;

    // Count upcoming (<24h)
    if (diff < DAY_MS) upcoming.push(d);

    for (const tier of NOTIFICATION_TIERS) {
      if (diff > tier.windowMs) continue;

      const key = `${d.id}:${tier.key}`;
      if (sent[key]) continue;

      grouped.push({
        title: d.title,
        course: d.courseName,
        url: d.htmlUrl,
        tier: tier.label,
      });

      sent[key] = now;
      break;
    }
  }

  // 🔔 GROUPED NOTIFICATION (prevents spam)
  if (grouped.length > 0) {
    const notifId = `group-${now}`;

    let message;

    if (grouped.length === 1) {
      const g = grouped[0];
      message = `${g.course}\n${g.title}\nDue ${g.tier}`;
    } else {
      message = `${grouped.length} assignments due soon:\n` +
        grouped.slice(0, 3).map(g => `• ${g.title}`).join("\n");
    }

    chrome.notifications.create(notifId, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: grouped.length > 1 ? "📌 Multiple Deadlines" : "📌 Assignment Reminder",
      message,
      priority: 1,
    });

    newMap[notifId] = {
      url: grouped[0].url,
      timestamp: now,
    };
  }

  // 🎯 BADGE
  const count = upcoming.length;

  chrome.action.setBadgeText({
    text: count > 0 ? String(count) : "",
  });

  let color = "#2f9e44";
  if (count >= 3) color = "#f08c00";
  if (count >= 5) color = "#e03131";

  chrome.action.setBadgeBackgroundColor({ color });

  // 🧹 CLEANUP OLD DATA
  const CLEANUP_THRESHOLD = 7 * DAY_MS;

  for (const id in newMap) {
    if (now - (newMap[id].timestamp || now) > CLEANUP_THRESHOLD) {
      delete newMap[id];
    }
  }

  await chrome.storage.local.set({
    notified: sent,
    notifiedMap: newMap,
  });
}

/* =========================
   CLASS REMINDERS
========================= */
async function checkClassReminders() {
  const { classes = [] } = await chrome.storage.local.get("classes");

  const now = new Date();

  for (const cls of classes) {
    if (!cls.classTime) continue;

    const [h, m] = cls.classTime.split(":").map(Number);

    const classTime = new Date();
    classTime.setHours(h, m, 0);

    const diff = classTime - now;

    if (diff > 0 && diff <= 10 * 60 * 1000) {
      chrome.notifications.create(`class-${cls.id}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "📚 Class Starting Soon",
        message: `${cls.name} starts soon.`,
        priority: 2,
      });
    }
  }
  <div class="class-meta">
  <span class="platform-badge ${platformClass}">${platformLabel}</span>
  <span class="status-pill green">Link Saved</span>
</div>
}
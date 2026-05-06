const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CHECK_ALARM = "deadline-check";
const CHECK_PERIOD_MIN = 30;
const NOTIFICATION_TIERS = [
  { key: "3d", windowMs: 3 * DAY_MS, label: "3 days" },
  { key: "1d", windowMs: DAY_MS, label: "1 day" },
  { key: "3h", windowMs: 3 * HOUR_MS, label: "3 hours" },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(CHECK_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_PERIOD_MIN,
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(CHECK_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_PERIOD_MIN,
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM) {
    checkDeadlines().catch((err) => console.error("Deadline check failed", err));
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "deadlines-updated") {
    checkDeadlines().catch((err) => console.error(err));
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const { notifiedMap } = await chrome.storage.local.get(["notifiedMap"]);
  const url = notifiedMap && notifiedMap[notificationId]
    ? notifiedMap[notificationId].url
    : null;
  if (url) chrome.tabs.create({ url });
  chrome.notifications.clear(notificationId);
});

async function checkDeadlines() {
  const { deadlines, notified } = await chrome.storage.local.get([
    "deadlines",
    "notified",
  ]);
  if (!Array.isArray(deadlines) || deadlines.length === 0) return;

  const now = Date.now();
  const sent = notified && typeof notified === "object" ? { ...notified } : {};
  const notifiedMap = {};

  for (const d of deadlines) {
    if (!d.dueAt) continue;
    const dueMs = new Date(d.dueAt).getTime();
    const diff = dueMs - now;
    if (diff <= 0) continue;

    for (const tier of NOTIFICATION_TIERS) {
      if (diff > tier.windowMs) continue;
      const key = `${d.id}:${tier.key}`;
      if (sent[key]) continue;

      const notifId = `dg-${d.id}-${tier.key}-${now}`;
      const isUrgent = tier.key === "3h";
      const title = isUrgent ? "Urgent Reminder" : "Deadline Reminder";
      const message = `${d.title} (${d.courseName}) is due in ${tier.label}.`;

      chrome.notifications.create(notifId, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title,
        message,
        priority: isUrgent ? 2 : 1,
        requireInteraction: isUrgent,
      });

      notifiedMap[notifId] = { url: d.htmlUrl, key };
      sent[key] = now;
      break;
    }
  }

  await chrome.storage.local.set({ notified: sent, notifiedMap });
}

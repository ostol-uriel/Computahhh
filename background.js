const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const CHECK_ALARM = "deadline-check";
const CHECK_PERIOD_MIN = 30;

const DAY_NUMBER = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const NOTIFICATION_TIERS = [
  { key: "3d", windowMs: 3 * DAY_MS, label: "in 3 days" },
  { key: "1d", windowMs: DAY_MS, label: "in 1 day" },
  { key: "3h", windowMs: 3 * HOUR_MS, label: "in 3 hours" },
];

chrome.runtime.onInstalled.addListener(handleStartup);
chrome.runtime.onStartup.addListener(handleStartup);

async function handleStartup() {
  chrome.alarms.create(CHECK_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_PERIOD_MIN,
  });
  await scheduleAllClassStartAlarms();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CHECK_ALARM) {
    await checkDeadlines();
    return;
  }
  if (alarm.name.startsWith("remind_")) {
    await fireAssignmentReminder(alarm.name);
    return;
  }
  if (alarm.name.startsWith("classstart_")) {
    await fireClassStart(alarm.name);
    return;
  }
  if (alarm.name.startsWith("class_")) {
    await fireClassReminder(alarm.name);
    return;
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "deadlines-updated") {
    checkDeadlines();
  }
  if (msg?.type === "classes-updated") {
    scheduleAllClassStartAlarms();
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  const { notifiedMap } = await chrome.storage.local.get("notifiedMap");
  const entry = notifiedMap?.[id];

  if (entry?.url) chrome.tabs.create({ url: entry.url });

  chrome.notifications.clear(id);
});

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
    if (d.isDone) continue;

    const dueMs = new Date(d.dueAt).getTime();
    const diff = dueMs - now;

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
        await pushAppNotification({
          id: `overdue-${d.id}`,
          type: "overdue",
          title: d.title,
          courseName: d.courseName,
          message: "You missed the deadline.",
          htmlUrl: d.htmlUrl,
        });
        sent[key] = now;
      }
      continue;
    }

    if (diff <= 0) continue;

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

    newMap[notifId] = { url: grouped[0].url, timestamp: now };

    for (const g of grouped) {
      await pushAppNotification({
        id: `tier-${g.url || g.title}-${now}`,
        type: "deadline-tier",
        title: g.title,
        courseName: g.course,
        message: `Due ${g.tier}`,
        htmlUrl: g.url,
      });
    }
  }

  const count = upcoming.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });

  let color = "#2f9e44";
  if (count >= 3) color = "#f08c00";
  if (count >= 5) color = "#e03131";
  chrome.action.setBadgeBackgroundColor({ color });

  const CLEANUP_THRESHOLD = 7 * DAY_MS;
  for (const id in newMap) {
    if (now - (newMap[id].timestamp || now) > CLEANUP_THRESHOLD) {
      delete newMap[id];
    }
  }

  await chrome.storage.local.set({ notified: sent, notifiedMap: newMap });
}

async function fireAssignmentReminder(alarmName) {
  const id = alarmName.replace(/^remind_/, "");
  const { deadlines = [], notifiedMap = {} } = await chrome.storage.local.get(["deadlines", "notifiedMap"]);
  const deadline = deadlines.find(d => String(d.id) === id);
  if (!deadline) return;

  const notifId = `remind-${id}-${Date.now()}`;
  chrome.notifications.create(notifId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "🔔 Assignment Reminder",
    message: `${deadline.courseName}\n${deadline.title}\nDue ${formatDue(deadline.dueAt)}`,
    priority: 2,
    requireInteraction: true,
  });

  notifiedMap[notifId] = { url: deadline.htmlUrl, timestamp: Date.now() };
  await chrome.storage.local.set({ notifiedMap });

  await pushAppNotification({
    id: notifId,
    type: "reminder",
    title: deadline.title,
    courseName: deadline.courseName,
    message: `Due ${formatDue(deadline.dueAt)}`,
    htmlUrl: deadline.htmlUrl,
  });
}

async function fireClassReminder(alarmName) {
  const id = alarmName.replace(/^class_/, "");
  const { classes = [], notifiedMap = {} } = await chrome.storage.local.get(["classes", "notifiedMap"]);
  const cls = classes.find(c => c.id === id);
  if (!cls) return;

  const notifId = `class-${id}-${Date.now()}`;
  chrome.notifications.create(notifId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "📚 Class Starting Soon",
    message: `${cls.name} starts in about 15 minutes.`,
    priority: 2,
    requireInteraction: true,
  });

  notifiedMap[notifId] = { url: cls.meetingLink, timestamp: Date.now() };
  await chrome.storage.local.set({ notifiedMap });

  await pushAppNotification({
    id: notifId,
    type: "class-reminder",
    title: cls.name,
    courseName: cls.name,
    message: "Starts in about 15 minutes.",
    htmlUrl: cls.meetingLink,
  });
}

async function fireClassStart(alarmName) {
  const id = alarmName.replace(/^classstart_/, "");
  const { classes = [], notifiedMap = {} } = await chrome.storage.local.get(["classes", "notifiedMap"]);
  const cls = classes.find(c => c.id === id);
  if (!cls) return;

  const notifId = `classstart-${id}-${Date.now()}`;
  chrome.notifications.create(notifId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "🎓 Class Starting Now",
    message: cls.meetingLink ? `${cls.name} is starting. Click to join.` : `${cls.name} is starting.`,
    priority: 2,
    requireInteraction: true,
  });

  notifiedMap[notifId] = { url: cls.meetingLink, timestamp: Date.now() };
  await chrome.storage.local.set({ notifiedMap });

  await pushAppNotification({
    id: notifId,
    type: "class-start",
    title: cls.name,
    courseName: cls.name,
    message: "Class is starting now.",
    htmlUrl: cls.meetingLink,
  });

  const next = getNextClassDate(cls, new Date(Date.now() + 60 * 1000));
  if (next) {
    chrome.alarms.create(`classstart_${cls.id}`, { when: next.getTime() });
  }
}

async function scheduleAllClassStartAlarms() {
  const existing = await chrome.alarms.getAll();
  for (const a of existing) {
    if (a.name.startsWith("classstart_")) {
      await chrome.alarms.clear(a.name);
    }
  }

  const { classes = [] } = await chrome.storage.local.get("classes");
  const now = new Date();
  for (const cls of classes) {
    const next = getNextClassDate(cls, now);
    if (next) {
      chrome.alarms.create(`classstart_${cls.id}`, { when: next.getTime() });
    }
  }
}

function getNextClassDate(cls, now) {
  if (!cls.days || !cls.days.length || !cls.classTime) return null;
  const [hh, mm] = cls.classTime.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const todayNum = now.getDay();
  let best = null;
  for (const d of cls.days) {
    const target = DAY_NUMBER[d];
    if (target === undefined) continue;
    let daysAhead = (target - todayNum + 7) % 7;
    const candidate = new Date(now);
    candidate.setHours(hh, mm, 0, 0);
    if (daysAhead === 0 && candidate.getTime() <= now.getTime()) daysAhead = 7;
    candidate.setDate(candidate.getDate() + daysAhead);
    if (!best || candidate < best) best = candidate;
  }
  return best;
}

function formatDue(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

async function pushAppNotification(item) {
  const { appNotifications = [] } = await chrome.storage.local.get("appNotifications");
  const entry = { postedAt: new Date().toISOString(), ...item };
  appNotifications.unshift(entry);
  await chrome.storage.local.set({ appNotifications: appNotifications.slice(0, 100) });
}

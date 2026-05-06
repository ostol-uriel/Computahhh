const els = {
  settingsToggle: document.getElementById("settingsToggle"),
  settingsPanel: document.getElementById("settingsPanel"),
  canvasUrl: document.getElementById("canvasUrl"),
  apiToken: document.getElementById("apiToken"),
  saveSettings: document.getElementById("saveSettings"),
  clearSettings: document.getElementById("clearSettings"),
  syncBtn: document.getElementById("syncBtn"),
  lastSync: document.getElementById("lastSync"),
  status: document.getElementById("status"),
  deadlineList: document.getElementById("deadlineList"),
  emptyState: document.getElementById("emptyState"),
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function setStatus(message, kind = "info") {
  if (!message) {
    els.status.classList.add("hidden");
    els.status.textContent = "";
    return;
  }
  els.status.classList.remove("hidden", "error", "success");
  if (kind === "error") els.status.classList.add("error");
  if (kind === "success") els.status.classList.add("success");
  els.status.textContent = message;
}

function normalizeBaseUrl(url) {
  if (!url) return "";
  let trimmed = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) trimmed = "https://" + trimmed;
  return trimmed;
}

function getUrgency(dueMs, nowMs) {
  const diff = dueMs - nowMs;
  if (diff < 0) return "overdue";
  if (diff < 24 * HOUR_MS) return "urgent";
  if (diff < 3 * DAY_MS) return "soon";
  return "normal";
}

function formatCountdown(dueMs, nowMs) {
  const diff = dueMs - nowMs;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((abs % HOUR_MS) / (60 * 1000));

  let text;
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m`;

  return diff < 0 ? `Overdue by ${text}` : `Due in ${text}`;
}

function formatDueDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function loadSettings() {
  const { canvasUrl, apiToken, lastSyncAt } = await chrome.storage.local.get([
    "canvasUrl",
    "apiToken",
    "lastSyncAt",
  ]);
  if (canvasUrl) els.canvasUrl.value = canvasUrl;
  if (apiToken) els.apiToken.value = apiToken;
  if (lastSyncAt) {
    const d = new Date(lastSyncAt);
    els.lastSync.textContent = `Last synced ${d.toLocaleString()}`;
  }
}

async function saveSettings() {
  const canvasUrl = normalizeBaseUrl(els.canvasUrl.value);
  const apiToken = els.apiToken.value.trim();
  if (!canvasUrl || !apiToken) {
    setStatus("Enter both Canvas URL and API token.", "error");
    return;
  }
  await chrome.storage.local.set({ canvasUrl, apiToken });
  els.canvasUrl.value = canvasUrl;
  setStatus("Settings saved.", "success");
  setTimeout(() => setStatus(""), 1800);
}

async function clearSettings() {
  await chrome.storage.local.clear();
  els.canvasUrl.value = "";
  els.apiToken.value = "";
  els.lastSync.textContent = "";
  renderDeadlines([]);
  setStatus("Cleared saved settings and deadlines.", "success");
  setTimeout(() => setStatus(""), 1800);
}

async function canvasFetch(baseUrl, token, path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${baseUrl}/api/v1${path}${sep}per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Canvas API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function fetchDeadlines() {
  const { canvasUrl, apiToken } = await chrome.storage.local.get([
    "canvasUrl",
    "apiToken",
  ]);
  if (!canvasUrl || !apiToken) {
    setStatus("Enter your Canvas URL and API token first.", "error");
    els.settingsPanel.classList.remove("hidden");
    return;
  }

  setStatus("Syncing with Canvas...");
  els.syncBtn.disabled = true;

  try {
    const courses = await canvasFetch(
      canvasUrl,
      apiToken,
      "/courses?enrollment_state=active"
    );

    const assignmentsLists = await Promise.all(
      courses.map(async (course) => {
        try {
          const items = await canvasFetch(
            canvasUrl,
            apiToken,
            `/courses/${course.id}/assignments?bucket=upcoming&order_by=due_at`
          );
          return items.map((a) => ({
            id: a.id,
            courseId: course.id,
            courseName: course.name || course.course_code || "Course",
            title: a.name,
            dueAt: a.due_at,
            htmlUrl: a.html_url,
          }));
        } catch {
          return [];
        }
      })
    );

    const now = Date.now();
    const deadlines = assignmentsLists
      .flat()
      .filter((a) => a.dueAt)
      .filter((a) => new Date(a.dueAt).getTime() >= now - 7 * DAY_MS)
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

    const lastSyncAt = new Date().toISOString();
    await chrome.storage.local.set({ deadlines, lastSyncAt });
    els.lastSync.textContent = `Last synced ${new Date(
      lastSyncAt
    ).toLocaleString()}`;

    renderDeadlines(deadlines);
    setStatus(
      deadlines.length
        ? `Synced ${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"}.`
        : "No upcoming deadlines found.",
      "success"
    );
    setTimeout(() => setStatus(""), 2200);

    chrome.runtime.sendMessage({ type: "deadlines-updated" });
  } catch (err) {
    console.error(err);
    setStatus(
      `Sync failed: ${err.message}. Check the Canvas URL and token.`,
      "error"
    );
  } finally {
    els.syncBtn.disabled = false;
  }
}

function renderDeadlines(deadlines) {
  els.deadlineList.innerHTML = "";

  if (!deadlines || deadlines.length === 0) {
    els.emptyState.classList.remove("hidden");
    return;
  }
  els.emptyState.classList.add("hidden");

  const now = Date.now();
  const fragment = document.createDocumentFragment();

  for (const d of deadlines) {
    const due = new Date(d.dueAt).getTime();
    const urgency = getUrgency(due, now);

    const li = document.createElement("li");
    li.className = "deadline-item";
    li.tabIndex = 0;
    li.setAttribute("role", "button");

    const title = document.createElement("p");
    title.className = "deadline-title";
    title.textContent = d.title;

    const course = document.createElement("p");
    course.className = "deadline-course";
    course.textContent = `${d.courseName} • ${formatDueDate(d.dueAt)}`;

    const meta = document.createElement("div");
    meta.className = "deadline-meta";

    const countdown = document.createElement("span");
    countdown.className = "countdown";
    countdown.textContent = formatCountdown(due, now);

    const urgencyBadge = document.createElement("span");
    urgencyBadge.className = `urgency ${urgency}`;
    urgencyBadge.textContent = urgency;

    meta.appendChild(countdown);
    meta.appendChild(urgencyBadge);

    li.appendChild(title);
    li.appendChild(course);
    li.appendChild(meta);

    const open = () => {
      if (d.htmlUrl) chrome.tabs.create({ url: d.htmlUrl });
    };
    li.addEventListener("click", open);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    fragment.appendChild(li);
  }

  els.deadlineList.appendChild(fragment);
}

async function renderFromStorage() {
  const { deadlines } = await chrome.storage.local.get(["deadlines"]);
  renderDeadlines(deadlines || []);
}

els.settingsToggle.addEventListener("click", () => {
  els.settingsPanel.classList.toggle("hidden");
});
els.saveSettings.addEventListener("click", saveSettings);
els.clearSettings.addEventListener("click", clearSettings);
els.syncBtn.addEventListener("click", fetchDeadlines);

(async function init() {
  await loadSettings();
  await renderFromStorage();
  const { canvasUrl, apiToken } = await chrome.storage.local.get([
    "canvasUrl",
    "apiToken",
  ]);
  if (!canvasUrl || !apiToken) {
    els.settingsPanel.classList.remove("hidden");
  }
})();

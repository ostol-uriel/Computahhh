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
  tab1Btn: document.getElementById("tab1Btn"),
  tab2Btn: document.getElementById("tab2Btn"),
  page1: document.getElementById("page1"),
  page2: document.getElementById("page2"),
  announcementsList: document.getElementById("announcementsList"),
  emptyAnnouncements: document.getElementById("emptyAnnouncements"),
  dueTodayCount: document.getElementById("dueTodayCount"),
  dueWeekCount: document.getElementById("dueWeekCount"),
  overdueCount: document.getElementById("overdueCount"),
  deadlineContainer: document.getElementById("deadlineContainer"),
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

function getTimeCategory(dueMs, nowMs) {
  const diff = dueMs - nowMs;
  if (diff < 0) return "overdue";
  if (diff < HOUR_MS) return "urgent";
  if (diff < 24 * HOUR_MS) return "today";
  if (diff < 7 * DAY_MS) return "week";
  return "later";
}

function updateSummaryCounts(deadlines) {
  const now = Date.now();
  let dueTodayCount = 0;
  let dueWeekCount = 0;
  let overdueCount = 0;

  for (const d of deadlines) {
    const due = new Date(d.dueAt).getTime();
    const diff = due - now;

    if (diff < 0) {
      overdueCount++;
    } else if (diff < 24 * HOUR_MS) {
      dueTodayCount++;
    } else if (diff < 7 * DAY_MS) {
      dueWeekCount++;
    }
  }

  els.dueTodayCount.textContent = dueTodayCount;
  els.dueWeekCount.textContent = dueWeekCount;
  els.overdueCount.textContent = overdueCount;
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
  renderAnnouncements([]);
  setStatus("Cleared saved settings and data.", "success");
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

async function fetchAssignmentDetails(baseUrl, token, courseId, assignmentId) {
  try {
    const assignment = await canvasFetch(
      baseUrl,
      token,
      `/courses/${courseId}/assignments/${assignmentId}`
    );
    return {
      prerequisites: assignment.prerequisites || [],
      description: assignment.description || "",
      locked: assignment.locked || false,
      lockExplanation: assignment.lock_explanation || "",
    };
  } catch (err) {
    return { prerequisites: [], description: "", locked: false, lockExplanation: "" };
  }
}

async function fetchAnnouncements(baseUrl, token) {
  try {
    const courses = await canvasFetch(
      baseUrl,
      token,
      "/courses?enrollment_state=active"
    );

    const announcementsLists = await Promise.all(
      courses.map(async (course) => {
        try {
          const items = await canvasFetch(
            baseUrl,
            token,
            `/courses/${course.id}/announcements`
          );
          return items.map((ann) => ({
            id: ann.id,
            courseId: course.id,
            courseName: course.name || course.course_code || "Course",
            title: ann.title,
            message: ann.message,
            postedAt: ann.posted_at,
            htmlUrl: ann.html_url,
          }));
        } catch {
          return [];
        }
      })
    );

    const now = Date.now();
    const announcements = announcementsLists
      .flat()
      .filter((a) => a.postedAt)
      .filter((a) => new Date(a.postedAt).getTime() >= now - 30 * DAY_MS)
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

    return announcements;
  } catch (err) {
    console.error("Failed to fetch announcements:", err);
    return [];
  }
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
          
          // Fetch details for each assignment to get prerequisites
          const assignmentsWithDetails = await Promise.all(
            items.map(async (a) => {
              const details = await fetchAssignmentDetails(
                canvasUrl,
                apiToken,
                course.id,
                a.id
              );
              return {
                id: a.id,
                courseId: course.id,
                courseName: course.name || course.course_code || "Course",
                title: a.name,
                dueAt: a.due_at,
                htmlUrl: a.html_url,
                prerequisites: details.prerequisites,
                description: details.description,
                locked: details.locked,
                lockExplanation: details.lockExplanation,
              };
            })
          );
          return assignmentsWithDetails;
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

    // Fetch announcements
    const announcements = await fetchAnnouncements(canvasUrl, apiToken);

    const lastSyncAt = new Date().toISOString();
    await chrome.storage.local.set({ deadlines, announcements, lastSyncAt });
    els.lastSync.textContent = `Last synced ${new Date(
      lastSyncAt
    ).toLocaleString()}`;

    renderDeadlines(deadlines);
    updateSummaryCounts(deadlines);
    setStatus(
      deadlines.length
        ? `Synced ${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} + ${announcements.length} announcement${announcements.length === 1 ? "" : "s"}.`
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

function renderDeadlines(deadlines, filter = "all") {
  els.deadlineList.innerHTML = "";

  if (!deadlines || deadlines.length === 0) {
    els.emptyState.classList.remove("hidden");
    return;
  }
  els.emptyState.classList.add("hidden");

  const now = Date.now();
  
  // Filter deadlines based on selected filter
  let filtered = deadlines;
  if (filter === "today") {
    filtered = deadlines.filter((d) => {
      const due = new Date(d.dueAt).getTime();
      const diff = due - now;
      return diff >= 0 && diff < 24 * HOUR_MS;
    });
  } else if (filter === "week") {
    filtered = deadlines.filter((d) => {
      const due = new Date(d.dueAt).getTime();
      const diff = due - now;
      return diff >= 24 * HOUR_MS && diff < 7 * DAY_MS;
    });
  } else if (filter === "overdue") {
    filtered = deadlines.filter((d) => {
      const due = new Date(d.dueAt).getTime();
      const diff = due - now;
      return diff < 0;
    });
  }

  if (filtered.length === 0) {
    els.emptyState.classList.remove("hidden");
    return;
  }

  // Group by time sections
  const sections = {
    overdue: [],
    today: [],
    week: [],
    later: [],
  };

  for (const d of filtered) {
    const due = new Date(d.dueAt).getTime();
    const category = getTimeCategory(due, now);
    sections[category].push(d);
  }

  const fragment = document.createDocumentFragment();
  const sectionLabels = {
    overdue: "OVERDUE",
    today: "TODAY",
    week: "THIS WEEK",
    later: "LATER",
  };

  // Render each section
  for (const [key, items] of Object.entries(sections)) {
    if (items.length === 0) continue;

    const header = document.createElement("div");
    header.className = "deadline-section-header";
    header.textContent = sectionLabels[key];
    fragment.appendChild(header);

    for (const d of items) {
      const due = new Date(d.dueAt).getTime();
      const urgency = getUrgency(due, now);

      const li = document.createElement("li");
      li.className = `deadline-item ${urgency}`;
      li.setAttribute("data-id", d.id);

      // Header with title and urgency badge
      const header = document.createElement("div");
      header.className = "deadline-header";

      const title = document.createElement("p");
      title.className = "deadline-title";
      title.textContent = d.title;

      const urgencyBadge = document.createElement("span");
      urgencyBadge.className = `urgency-badge ${urgency}`;
      urgencyBadge.textContent = urgency;

      header.appendChild(title);
      header.appendChild(urgencyBadge);
      li.appendChild(header);

      // Course and due date info
      const course = document.createElement("p");
      course.className = "deadline-course";
      course.textContent = d.courseName;
      li.appendChild(course);

      const due_info = document.createElement("p");
      due_info.className = "deadline-due";
      due_info.textContent = `Due: ${formatDueDate(d.dueAt)}`;
      li.appendChild(due_info);

      // Prerequisites section (hidden by default)
      const hasPrerequisites = d.prerequisites && d.prerequisites.length > 0;
      const hasDescription = d.description && d.description.trim();

      if (hasPrerequisites || hasDescription) {
        const prereqDiv = document.createElement("div");
        prereqDiv.className = "deadline-prerequisites";

        const label = document.createElement("div");
        label.className = "prerequisites-label";
        label.textContent = "PRE-REQUISITES:";
        prereqDiv.appendChild(label);

        const content = document.createElement("div");
        content.className = "prerequisites-content";

        if (hasPrerequisites) {
          const prereqList = d.prerequisites
            .map((p) => `• ${p.name || p}`)
            .join("\n");
          content.textContent = prereqList;
        } else if (hasDescription) {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = d.description;
          const text = tempDiv.textContent || tempDiv.innerText;
          content.textContent = text.substring(0, 150) + (text.length > 150 ? "..." : "");
        } else {
          content.textContent = "None specified";
        }

        prereqDiv.appendChild(content);
        li.appendChild(prereqDiv);
      }

      // Countdown and meta info
      const meta = document.createElement("div");
      meta.className = "deadline-meta";

      const countdown = document.createElement("span");
      countdown.className = "countdown";
      countdown.textContent = formatCountdown(due, now);

      meta.appendChild(countdown);
      li.appendChild(meta);

      // Locked indicator
      if (d.locked) {
        const lockedDiv = document.createElement("div");
        lockedDiv.className = "locked-indicator";
        
        const lockIcon = document.createElement("span");
        lockIcon.className = "lock-icon";
        lockIcon.innerHTML = "🔒";
        lockedDiv.appendChild(lockIcon);
        
        const lockText = document.createElement("span");
        lockText.className = "lock-text";
        lockText.textContent = d.lockExplanation || "This assignment is locked.";
        lockedDiv.appendChild(lockText);
        
        li.appendChild(lockedDiv);
      }

      // Action buttons
      const actions = document.createElement("div");
      actions.className = "deadline-actions";

      const openBtn = document.createElement("button");
      openBtn.className = "action-btn open";
      openBtn.innerHTML = "📂 Open";
      openBtn.disabled = d.locked;
      openBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (d.htmlUrl) chrome.tabs.create({ url: d.htmlUrl });
      });

      const remindBtn = document.createElement("button");
      remindBtn.className = "action-btn remind";
      remindBtn.innerHTML = "🔔 Remind";
      remindBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setStatus("Reminder set!", "success");
        setTimeout(() => setStatus(""), 2000);
      });

      const doneBtn = document.createElement("button");
      doneBtn.className = "action-btn done";
      doneBtn.innerHTML = "✓ Done";
      doneBtn.disabled = d.locked;
      doneBtn.addEventListener("click", (e) => {
        e.preventDefault();
        li.style.opacity = "0.5";
        li.style.textDecoration = "line-through";
        setStatus("Marked as done!", "success");
        setTimeout(() => setStatus(""), 2000);
      });

      actions.appendChild(openBtn);
      actions.appendChild(remindBtn);
      actions.appendChild(doneBtn);
      li.appendChild(actions);

      fragment.appendChild(li);
    }
  }

  els.deadlineList.appendChild(fragment);
}

function renderAnnouncements(announcements) {
  els.announcementsList.innerHTML = "";

  if (!announcements || announcements.length === 0) {
    els.emptyAnnouncements.classList.remove("hidden");
    return;
  }
  els.emptyAnnouncements.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  for (const ann of announcements) {
    const div = document.createElement("div");
    div.className = "announcement-item";
    div.tabIndex = 0;
    div.setAttribute("role", "button");

    const title = document.createElement("p");
    title.className = "announcement-title";
    title.textContent = ann.title;

    const course = document.createElement("p");
    course.className = "announcement-course";
    course.textContent = ann.courseName;

    const date = document.createElement("p");
    date.className = "announcement-date";
    date.textContent = `Posted: ${formatDueDate(ann.postedAt)}`;

    const message = document.createElement("div");
    message.className = "announcement-content";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = ann.message || "";
    const text = tempDiv.textContent || tempDiv.innerText || "";
    message.textContent = text.substring(0, 150) + (text.length > 150 ? "..." : "");

    div.appendChild(title);
    div.appendChild(course);
    div.appendChild(date);
    div.appendChild(message);

    const open = () => {
      if (ann.htmlUrl) chrome.tabs.create({ url: ann.htmlUrl });
    };
    div.addEventListener("click", open);
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    fragment.appendChild(div);
  }

  els.announcementsList.appendChild(fragment);
}

async function renderFromStorage() {
  const { deadlines, announcements } = await chrome.storage.local.get([
    "deadlines",
    "announcements",
  ]);
  renderDeadlines(deadlines || []);
  updateSummaryCounts(deadlines || []);
  renderAnnouncements(announcements || []);
}

els.settingsToggle.addEventListener("click", () => {
  els.settingsPanel.classList.toggle("hidden");
});
els.saveSettings.addEventListener("click", saveSettings);
els.clearSettings.addEventListener("click", clearSettings);
els.syncBtn.addEventListener("click", fetchDeadlines);

// Tab switching functionality
function switchTab(tabNumber) {
  // Hide all pages
  els.page1.classList.remove("active");
  els.page2.classList.add("hidden");
  
  // Deactivate all tab buttons
  els.tab1Btn.classList.remove("active");
  els.tab2Btn.classList.remove("active");

  // Show selected page and activate button
  if (tabNumber === 1) {
    els.page1.classList.add("active");
    els.tab1Btn.classList.add("active");
  } else if (tabNumber === 2) {
    els.page2.classList.remove("hidden");
    els.page2.classList.add("active");
    els.tab2Btn.classList.add("active");
    // Load announcements if needed
    loadAnnouncements();
  }
}

els.tab1Btn.addEventListener("click", () => switchTab(1));
els.tab2Btn.addEventListener("click", () => switchTab(2));

// Load announcements from storage
async function loadAnnouncements() {
  const { announcements } = await chrome.storage.local.get(["announcements"]);
  renderAnnouncements(announcements || []);
}

// Filter buttons
let currentFilter = "all";
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    currentFilter = e.target.dataset.filter;
    const { deadlines } = await chrome.storage.local.get(["deadlines"]);
    renderDeadlines(deadlines || [], currentFilter);
  });
});

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

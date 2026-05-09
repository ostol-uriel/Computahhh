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
  tab3Btn: document.getElementById("tab3Btn"),
  page1: document.getElementById("page1"),
  page2: document.getElementById("page2"),
  page3: document.getElementById("page3"),
  notificationsList: document.getElementById("announcementsList"),
  emptyNotifications: document.getElementById("emptyAnnouncements"),
  notificationsToolbar: document.getElementById("notificationsToolbar"),
  markAllRead: document.getElementById("markAllRead"),
  dueTodayCount: document.getElementById("dueTodayCount"),
  dueWeekCount: document.getElementById("dueWeekCount"),
  overdueCount: document.getElementById("overdueCount"),
  // Classes elements
  classInput: document.getElementById("classInput"),
  meetingLink: document.getElementById("meetingLink"),
  meetingType: document.getElementById("meetingType"),
  classTime: document.getElementById("classTime"),
  classEndTime: document.getElementById("classEndTime"),
  addClass: document.getElementById("addClass"),
  classList: document.getElementById("classList"),
  emptyClasses: document.getElementById("emptyClasses"),
  addClassToggle: document.getElementById("addClassToggle"),
  classFormContainer: document.getElementById("classFormContainer"),
  daysPicker: document.getElementById("daysPicker"),
  cancelClassForm: document.getElementById("cancelClassForm"),
  classesSectionHeader: document.getElementById("classesSectionHeader")
};

const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
const DAY_NUMBER = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MEETING_LABELS = {
  "google-meet": "Google Meet",
  "zoom": "Zoom",
  "teams": "Microsoft Teams",
  "other": "Other Link"
};

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function normalizeMeetingLink(link) {
  if (!link) return "";
  const trimmed = link.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return "https://" + trimmed;
  return trimmed;
}

function getNextClassDate(cls, now = new Date()) {
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

function formatStartsIn(date, now = new Date()) {
  if (!date) return null;
  const diff = date.getTime() - now.getTime();
  if (diff <= 0 && diff > -30 * 60000) return "In progress";
  if (diff <= 0) return null;
  const min = Math.round(diff / 60000);
  if (min < 60) return `Starts in ${min} minute${min === 1 ? "" : "s"}`;
  const hr = Math.round(diff / 3600000);
  if (hr < 24) return `Starts in about ${hr} hour${hr === 1 ? "" : "s"}`;
  const days = Math.round(diff / 86400000);
  return `Starts in ${days} day${days === 1 ? "" : "s"}`;
}

function getClassStatus(date, now = new Date()) {
  if (!date) return null;
  const diff = date.getTime() - now.getTime();
  if (diff <= 0 && diff > -30 * 60000) return { label: "Ongoing", className: "in-progress" };
  if (diff > 0 && diff <= 30 * 60000) return { label: "Starting Soon", className: "starting-soon" };
  return null;
}

function getOngoingClass(cls, now = new Date()) {
  if (!cls.days || !cls.days.length || !cls.classTime || !cls.endTime) return null;
  const [sh, sm] = cls.classTime.split(":").map(Number);
  const [eh, em] = cls.endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return null;

  const todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
  if (!cls.days.includes(todayKey)) return null;

  const start = new Date(now);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(now);
  end.setHours(eh, em, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);

  if (now >= start && now < end) return { start, end };
  return null;
}

function formatEndsIn(endDate, now = new Date()) {
  const diff = endDate.getTime() - now.getTime();
  if (diff <= 0) return null;
  const min = Math.round(diff / 60000);
  if (min < 60) return `Ends in ${min} minute${min === 1 ? "" : "s"}`;
  const hr = Math.floor(diff / 3600000);
  const remMin = Math.round((diff % 3600000) / 60000);
  return remMin === 0
    ? `Ends in ${hr} hour${hr === 1 ? "" : "s"}`
    : `Ends in ${hr}h ${remMin}m`;
}

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
    if (diff < 0) overdueCount++;
    else if (diff < 24 * HOUR_MS) dueTodayCount++;
    else if (diff < 7 * DAY_MS) dueWeekCount++;
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

  let timeText;
  if (days > 0) timeText = `${days}d ${hours}h`;
  else if (hours > 0) timeText = `${hours}h ${minutes}m`;
  else timeText = `${minutes}m`;

  if (diff < 0) {
    return `Overdue by ${timeText}`;
  }

  if (days > 0) {
    const dayName = new Date(dueMs).toLocaleDateString(undefined, { weekday: 'long' });
    return `Due ${dayName} (in ${timeText})`;
  }

  return `Due in ${timeText}`;
}

function formatDueDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

async function loadSettings() {
  const { canvasUrl, apiToken, lastSyncAt } = await chrome.storage.local.get(["canvasUrl", "apiToken", "lastSyncAt"]);
  if (canvasUrl) els.canvasUrl.value = canvasUrl;
  if (apiToken) els.apiToken.value = apiToken;
  if (lastSyncAt) els.lastSync.textContent = `Last synced ${new Date(lastSyncAt).toLocaleString()}`;
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
  await renderNotifications([]);
  await renderClasses();
  setStatus("Cleared saved settings and data.", "success");
  setTimeout(() => setStatus(""), 1800);
}

async function canvasFetch(baseUrl, token, path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${baseUrl}/api/v1${path}${sep}per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Canvas API ${res.status}`);
  return res.json();
}

async function fetchAssignmentDetails(baseUrl, token, courseId, assignmentId) {
  try {
    const assignment = await canvasFetch(baseUrl, token, `/courses/${courseId}/assignments/${assignmentId}`);
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

async function fetchUserSubmission(baseUrl, token, courseId, assignmentId) {
  try {
    const submission = await canvasFetch(baseUrl, token, `/courses/${courseId}/assignments/${assignmentId}/submissions/self`);
    return {
      submitted: !!submission.submitted_at,
      workflowState: submission.workflow_state || "unsubmitted",
    };
  } catch (err) {
    return { submitted: false, workflowState: "unsubmitted" };
  }
}

async function fetchAnnouncements(baseUrl, token) {
  try {
    const courses = await canvasFetch(baseUrl, token, "/courses?enrollment_state=active");
    if (!courses.length) return [];

    const courseMap = new Map(courses.map(c => [c.id, c.name || c.course_code || "Course"]));
    const contextParams = courses.map(c => `context_codes%5B%5D=course_${c.id}`).join("&");
    const startDate = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const items = await canvasFetch(
      baseUrl, token,
      `/announcements?${contextParams}&start_date=${encodeURIComponent(startDate)}&active_only=true`
    );

    return items.map((ann) => {
      const courseId = parseInt(String(ann.context_code || "").replace("course_", ""), 10);
      return {
        id: ann.id,
        type: "announcement",
        courseId,
        courseName: courseMap.get(courseId) || "Course",
        title: ann.title,
        message: ann.message,
        postedAt: ann.posted_at || ann.created_at,
        htmlUrl: ann.html_url,
      };
    });
  } catch (e) {
    return [];
  }
}

async function fetchInbox(baseUrl, token) {
  try {
    const messages = await canvasFetch(baseUrl, token, "/conversations");
    return messages.map((msg) => ({
      id: msg.id,
      type: "inbox",
      courseName: msg.context_name || "Direct Message",
      title: msg.subject || "No Subject",
      message: msg.last_message || "Open to view message...",
      postedAt: msg.last_message_at || msg.created_at,
      htmlUrl: `${baseUrl}/conversations#filter=type=inbox&conversation_id=${msg.id}`
    }));
  } catch (e) {
    return [];
  }
}

async function fetchDeadlines() {
  const { canvasUrl, apiToken, deadlines: oldDeadlines } = await chrome.storage.local.get(["canvasUrl", "apiToken", "deadlines"]);
  if (!canvasUrl || !apiToken) {
    setStatus("Enter your Canvas URL and API token first.", "error");
    els.settingsPanel.classList.remove("hidden");
    return;
  }

  setStatus("Syncing with Canvas...");
  els.syncBtn.disabled = true;

  try {
    const courses = await canvasFetch(canvasUrl, apiToken, "/courses?enrollment_state=active");
    const assignmentsLists = await Promise.all(
      courses.map(async (course) => {
        try {
          const items = await canvasFetch(canvasUrl, apiToken, `/courses/${course.id}/assignments?bucket=upcoming&order_by=due_at`);
          return await Promise.all(items.map(async (a) => {
            const [details, submission] = await Promise.all([
              fetchAssignmentDetails(canvasUrl, apiToken, course.id, a.id),
              fetchUserSubmission(canvasUrl, apiToken, course.id, a.id),
            ]);
            return {
              id: a.id, courseId: course.id, courseName: course.name || course.course_code || "Course",
              title: a.name, dueAt: a.due_at, htmlUrl: a.html_url,
              prerequisites: details.prerequisites, description: details.description,
              locked: details.locked, lockExplanation: details.lockExplanation,
              submitted: submission.submitted, workflowState: submission.workflowState,
            };
          }));
        } catch { return []; }
      })
    );

    const now = Date.now();
    const deadlines = assignmentsLists.flat().filter((a) => a.dueAt && new Date(a.dueAt).getTime() >= now - 7 * DAY_MS)
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

    const doneSet = oldDeadlines && Array.isArray(oldDeadlines)
      ? new Set(oldDeadlines.filter(d => d.isDone).map(d => d.id))
      : new Set();
    deadlines.forEach(d => {
      if (doneSet.has(d.id) || d.submitted) {
        d.isDone = true;
      }
    });

    const announcements = await fetchAnnouncements(canvasUrl, apiToken);
    const inbox = await fetchInbox(canvasUrl, apiToken);
    
    const notifications = [...announcements, ...inbox]
      .filter((n) => n.postedAt && new Date(n.postedAt).getTime() >= now - 7 * DAY_MS)
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

    const lastSyncAt = new Date().toISOString();
    
    await chrome.storage.local.set({ deadlines, notifications, lastSyncAt });
    els.lastSync.textContent = `Last synced ${new Date(lastSyncAt).toLocaleString()}`;

    renderDeadlines(deadlines);
    updateSummaryCounts(deadlines);
    await loadAndRenderNotifications();
    
    setStatus(`Synced ${deadlines.length} deadlines.`, "success");
    setTimeout(() => setStatus(""), 2200);
    chrome.runtime.sendMessage({ type: "deadlines-updated" });
  } catch (err) {
    setStatus(`Sync failed: ${err.message}`, "error");
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
  let filtered = deadlines;
  
  if (filter === "today") filtered = deadlines.filter((d) => { const diff = new Date(d.dueAt).getTime() - now; return diff >= 0 && diff < 24 * HOUR_MS; });
  else if (filter === "week") filtered = deadlines.filter((d) => { const diff = new Date(d.dueAt).getTime() - now; return diff >= 24 * HOUR_MS && diff < 7 * DAY_MS; });
  else if (filter === "overdue") filtered = deadlines.filter((d) => new Date(d.dueAt).getTime() - now < 0);

  if (filtered.length === 0) {
    els.emptyState.classList.remove("hidden");
    return;
  }

  const sections = { overdue: [], urgent: [], today: [], week: [], later: [] };
  for (const d of filtered) sections[getTimeCategory(new Date(d.dueAt).getTime(), now)].push(d);

  const fragment = document.createDocumentFragment();
  const sectionLabels = { overdue: "OVERDUE", urgent: "URGENT", today: "TODAY", week: "THIS WEEK", later: "LATER" };

  for (const [key, items] of Object.entries(sections)) {
    if (items.length === 0) continue;
    const header = document.createElement("div");
    header.className = "deadline-section-header";
    header.textContent = sectionLabels[key];
    fragment.appendChild(header);

    for (const d of items) {
      const dueTime = new Date(d.dueAt).getTime();
      const urgency = getUrgency(dueTime, now);

      const li = document.createElement("li");
      li.className = `deadline-item ${urgency}`;
      li.style.position = "relative"; 

      const head = document.createElement("div");
      head.className = "deadline-header";
      const title = document.createElement("p");
      title.className = "deadline-title";
      title.textContent = d.title;
      const urgencyBadge = document.createElement("span");
      urgencyBadge.className = `urgency-badge ${urgency}`;
      urgencyBadge.textContent = urgency;
      head.appendChild(title);
      head.appendChild(urgencyBadge);
      li.appendChild(head);

      const course = document.createElement("p");
      course.className = "deadline-course";
      course.textContent = d.courseName;
      li.appendChild(course);

      const due_info = document.createElement("p");
      due_info.className = "deadline-due";
      due_info.textContent = `Due: ${formatDueDate(d.dueAt)}`;
      li.appendChild(due_info);

      const meta = document.createElement("div");
      meta.className = "deadline-meta";
      const countdown = document.createElement("span");
      countdown.className = "countdown";
      countdown.textContent = formatCountdown(dueTime, now);
      meta.appendChild(countdown);
      li.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "deadline-actions";
      actions.style.position = "relative"; 

      const openBtn = document.createElement("button");
      openBtn.className = "action-btn open";
      openBtn.textContent = "📂 Open";
      openBtn.addEventListener("click", () => { if (d.htmlUrl) chrome.tabs.create({ url: d.htmlUrl }); });
      actions.appendChild(openBtn);

      const remindBtn = document.createElement("button");
      remindBtn.className = "action-btn remind";
      remindBtn.textContent = "🔔 Remind";
      
      remindBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const existing = document.querySelector(".reminder-menu");
        if (existing) existing.remove();

        const menu = document.createElement("div");
        menu.className = "reminder-menu";
        menu.style.position = "absolute";
        menu.style.top = "100%";
        menu.style.right = "0";
        menu.style.background = "#fff";
        menu.style.border = "1px solid #ccc";
        menu.style.borderRadius = "6px";
        menu.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
        menu.style.zIndex = "99999";
        menu.style.minWidth = "210px";
        menu.style.display = "flex";
        menu.style.flexDirection = "column";

        menu.addEventListener("click", (ev) => ev.stopPropagation());

        const suggestions = [
          { label: "1 hour before", ms: 60 * 60 * 1000 },
          { label: "12 hours before", ms: 12 * 60 * 60 * 1000 },
          { label: "1 day before", ms: 24 * 60 * 60 * 1000 },
          { label: "2 days before", ms: 2 * 24 * 60 * 60 * 1000 }
        ];

        const validSuggestions = suggestions.filter(s => (dueTime - s.ms) > Date.now());

        if (validSuggestions.length > 0) {
          validSuggestions.forEach(opt => {
            const btn = document.createElement("button");
            btn.textContent = opt.label;
            btn.style.padding = "10px 16px";
            btn.style.border = "none";
            btn.style.background = "none";
            btn.style.textAlign = "left";
            btn.style.cursor = "pointer";
            btn.style.fontSize = "13px";
            btn.style.color = "#333";
            btn.style.transition = "background 0.2s";
            
            btn.addEventListener("mouseover", () => btn.style.background = "#f5f5f5");
            btn.addEventListener("mouseout", () => btn.style.background = "none");
            
            btn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              const rTime = new Date(dueTime - opt.ms);
              chrome.alarms.create(`remind_${d.id}`, { when: rTime.getTime() });
              
              const timeString = rTime.toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
              });
              setStatus(`Reminder set for ${timeString}`, "success");
              setTimeout(() => setStatus(""), 3500);
              menu.remove();
            });
            menu.appendChild(btn);
          });
        }

        const separator = document.createElement("div");
        separator.style.height = "1px";
        separator.style.background = "#eee";
        separator.style.margin = "4px 0";
        menu.appendChild(separator);

        const customHeader = document.createElement("div");
        customHeader.textContent = "Custom Reminder";
        customHeader.style.padding = "8px 16px 4px 16px";
        customHeader.style.fontSize = "11px";
        customHeader.style.fontWeight = "bold";
        customHeader.style.color = "#888";
        menu.appendChild(customHeader);

        const customContainer = document.createElement("div");
        customContainer.style.display = "flex";
        customContainer.style.padding = "4px 16px 12px 16px";
        customContainer.style.gap = "4px";

        const customInput = document.createElement("input");
        customInput.type = "number";
        customInput.min = "1";
        customInput.value = "3";
        customInput.style.width = "45px";
        customInput.style.padding = "6px";
        customInput.style.border = "1px solid #ccc";
        customInput.style.borderRadius = "4px";

        const customSelect = document.createElement("select");
        customSelect.innerHTML = `
          <option value="${60 * 1000}">Min</option>
          <option value="${60 * 60 * 1000}" selected>Hrs</option>
          <option value="${24 * 60 * 60 * 1000}">Days</option>
        `;
        customSelect.style.padding = "6px";
        customSelect.style.border = "1px solid #ccc";
        customSelect.style.borderRadius = "4px";

        const customSetBtn = document.createElement("button");
        customSetBtn.textContent = "Set";
        customSetBtn.style.padding = "6px 10px";
        customSetBtn.style.background = "#0078d4";
        customSetBtn.style.color = "white";
        customSetBtn.style.border = "none";
        customSetBtn.style.borderRadius = "4px";
        customSetBtn.style.cursor = "pointer";

        customSetBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const amount = parseInt(customInput.value, 10);
          const multiplier = parseInt(customSelect.value, 10);

          if (isNaN(amount) || amount <= 0) {
            setStatus("Enter a valid number", "error");
            setTimeout(() => setStatus(""), 2000);
            return;
          }

          const rTime = new Date(dueTime - (amount * multiplier));

          if (rTime.getTime() <= Date.now()) {
            setStatus("Time has already passed!", "error");
            setTimeout(() => setStatus(""), 2500);
            return;
          }

          chrome.alarms.create(`remind_${d.id}`, { when: rTime.getTime() });
          const timeString = rTime.toLocaleString(undefined, {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
          });
          setStatus(`Reminder set for ${timeString}`, "success");
          setTimeout(() => setStatus(""), 3500);
          menu.remove();
        });

        customContainer.appendChild(customInput);
        customContainer.appendChild(customSelect);
        customContainer.appendChild(customSetBtn);
        menu.appendChild(customContainer);

        actions.appendChild(menu);

        setTimeout(() => {
          const closeMenu = (evt) => {
            if (!menu.contains(evt.target)) {
              menu.remove();
              document.removeEventListener("click", closeMenu);
            }
          };
          document.addEventListener("click", closeMenu);
        }, 0);
      });

      actions.appendChild(remindBtn);

      const doneBtn = document.createElement("button");
      doneBtn.className = "action-btn done";
      doneBtn.disabled = d.locked;
      
      let isMarkedDone = d.isDone === true;

      const applyDoneState = () => {
        if (isMarkedDone) {
          li.style.opacity = "0.5";
          li.style.textDecoration = "line-through";
          doneBtn.innerHTML = "↩ Undo";
        } else {
          li.style.opacity = "1";
          li.style.textDecoration = "none";
          doneBtn.innerHTML = "✓ Done";
        }
      };

      applyDoneState();

      doneBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        
        isMarkedDone = !isMarkedDone;
        applyDoneState();
        
        setStatus(isMarkedDone ? "Marked as done!" : "Task un-marked!", "success");
        setTimeout(() => setStatus(""), 2000);

        const { deadlines: savedDeadlines } = await chrome.storage.local.get(["deadlines"]);
        if (savedDeadlines) {
          const target = savedDeadlines.find(item => item.id === d.id);
          if (target) {
            target.isDone = isMarkedDone;
            await chrome.storage.local.set({ deadlines: savedDeadlines });
          }
        }
      });

      actions.appendChild(doneBtn);

      li.appendChild(actions);
      fragment.appendChild(li);
    }
  }
  els.deadlineList.appendChild(fragment);
}

const NOTIF_ICONS = {
  inbox: "✉️",
  announcement: "📢",
  reminder: "🔔",
  "deadline-tier": "📌",
  overdue: "❌",
  "class-reminder": "📚",
  "class-start": "🎓",
};

let notificationsRenderRunning = false;
let notificationsRenderPending = false;

async function loadAndRenderNotifications() {
  if (notificationsRenderRunning) {
    notificationsRenderPending = true;
    return;
  }
  notificationsRenderRunning = true;
  try {
    do {
      notificationsRenderPending = false;
      const { notifications = [], appNotifications = [] } = await chrome.storage.local.get(["notifications", "appNotifications"]);
      const cutoff = Date.now() - 7 * DAY_MS;
      const merged = [...appNotifications, ...notifications]
        .filter(n => n.postedAt && new Date(n.postedAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
      await renderNotifications(merged);
    } while (notificationsRenderPending);
  } finally {
    notificationsRenderRunning = false;
  }
}

async function renderNotifications(notifications) {
  const prevScrollY = window.scrollY;
  els.notificationsList.innerHTML = "";

  const { dismissedNotifications = [] } = await chrome.storage.local.get(["dismissedNotifications"]);
  const dismissedSet = new Set(dismissedNotifications);
  const visible = (notifications || []).filter(n => !dismissedSet.has(`${n.type}:${n.id}`));

  if (visible.length === 0) {
    els.emptyNotifications.classList.remove("hidden");
    els.emptyNotifications.innerHTML = "No notifications this week.";
    els.notificationsToolbar.classList.add("hidden");
    return;
  }
  els.emptyNotifications.classList.add("hidden");
  els.notificationsToolbar.classList.remove("hidden");

  const fragment = document.createDocumentFragment();
  for (const item of visible) {
    const div = document.createElement("div");
    div.className = "announcement-item";

    const icon = NOTIF_ICONS[item.type] || "🔔";
    const key = `${item.type}:${item.id}`;

    div.innerHTML = `
      <button class="announcement-dismiss" title="Dismiss" aria-label="Dismiss">✕</button>
      <p class="announcement-title">${icon} ${escapeHtml(item.title)}</p>
      <p class="announcement-course">${escapeHtml(item.courseName || "")}</p>
      <p class="announcement-date">${formatDueDate(item.postedAt)}</p>
    `;
    div.addEventListener("click", () => { if (item.htmlUrl) chrome.tabs.create({ url: item.htmlUrl }); });

    const dismissBtn = div.querySelector(".announcement-dismiss");
    dismissBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const { dismissedNotifications: current = [] } = await chrome.storage.local.get(["dismissedNotifications"]);
      if (!current.includes(key)) current.push(key);
      await chrome.storage.local.set({ dismissedNotifications: current });
    });

    fragment.appendChild(div);
  }
  els.notificationsList.appendChild(fragment);
  window.scrollTo(0, prevScrollY);
}

/* --- CLASSES LOGIC --- */

// Day picker — toggle active state via event delegation
els.daysPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".day-btn");
  if (!btn) return;
  btn.classList.toggle("active");
});

// Show/Hide form
els.addClassToggle.addEventListener("click", () => {
  showClassForm();
});

els.cancelClassForm.addEventListener("click", () => {
  resetClassForm();
});

function showClassForm() {
  els.classFormContainer.classList.remove("hidden");
  els.addClassToggle.classList.add("hidden");
}

function hideClassForm() {
  els.classFormContainer.classList.add("hidden");
  els.addClassToggle.classList.remove("hidden");
}

function getSelectedDays() {
  return Array.from(els.daysPicker.querySelectorAll(".day-btn.active"))
    .map(btn => btn.dataset.day);
}

function setSelectedDays(days) {
  const set = new Set(days || []);
  els.daysPicker.querySelectorAll(".day-btn").forEach(btn => {
    btn.classList.toggle("active", set.has(btn.dataset.day));
  });
}

function resetClassForm() {
  els.classInput.value = "";
  els.meetingLink.value = "";
  els.meetingType.value = "google-meet";
  els.classTime.value = "";
  els.classEndTime.value = "";
  setSelectedDays([]);
  els.addClass.dataset.editId = "";
  els.addClass.textContent = "Save Class";
  hideClassForm();
}

// Save / Update class
els.addClass.addEventListener("click", async () => {
  const name = els.classInput.value.trim();
  const meetingLink = normalizeMeetingLink(els.meetingLink.value);
  const meetingType = els.meetingType.value;
  const classTime = els.classTime.value;
  const endTime = els.classEndTime.value || null;
  const days = getSelectedDays();

  if (!name || days.length === 0 || !meetingLink) {
    setStatus("Please enter a subject name, a meeting link, and select at least one day.", "error");
    setTimeout(() => setStatus(""), 2800);
    return;
  }

  const editId = els.addClass.dataset.editId;
  const { classes } = await chrome.storage.local.get(["classes"]);
  const list = classes || [];

  if (editId) {
    const idx = list.findIndex(c => c.id === editId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], name, meetingLink, meetingType, classTime, endTime, days };
    }
  } else {
    list.push({
      id: 'class-' + Date.now(),
      name,
      meetingLink,
      meetingType,
      classTime,
      endTime,
      days
    });
  }

  await chrome.storage.local.set({ classes: list });
  chrome.runtime.sendMessage({ type: "classes-updated" });
  setStatus(editId ? "Class updated!" : "Class added!", "success");
  setTimeout(() => setStatus(""), 2000);
  resetClassForm();
  await renderClasses();
});

let editingClassId = null;

function buildInlineEditFormHtml(cls) {
  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat"];
  const labels = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
  const active = new Set(cls.days || []);
  const dayBtns = dayKeys.map(k =>
    `<button type="button" class="day-btn inline-day-btn ${active.has(k) ? "active" : ""}" data-day="${k}">${labels[k]}</button>`
  ).join("");
  const sel = (v) => cls.meetingType === v ? "selected" : "";

  return `
    <div class="class-card-edit">
      <input type="text" class="class-input edit-name" value="${escapeHtml(cls.name || "")}" placeholder="Subject name">
      <input type="url" class="class-input edit-link" value="${escapeHtml(cls.meetingLink || "")}" placeholder="Meeting link">
      <select class="class-input edit-type">
        <option value="google-meet" ${sel("google-meet")}>Google Meet</option>
        <option value="zoom" ${sel("zoom")}>Zoom</option>
        <option value="teams" ${sel("teams")}>Microsoft Teams</option>
        <option value="other" ${sel("other")}>Other Link</option>
      </select>
      <label class="days-label">Days</label>
      <div class="days-picker edit-days-picker">${dayBtns}</div>
      <div class="time-row">
        <label class="time-row-label">Start
          <input type="time" class="class-input edit-start-time" value="${escapeHtml(cls.classTime || "")}">
        </label>
        <label class="time-row-label">End
          <input type="time" class="class-input edit-end-time" value="${escapeHtml(cls.endTime || "")}">
        </label>
      </div>
      <div class="class-form-actions">
        <button class="primary edit-save" data-id="${cls.id}">Save</button>
        <button class="ghost edit-cancel" data-id="${cls.id}">Cancel</button>
      </div>
    </div>
  `;
}

async function renderClasses() {
  const { classes } = await chrome.storage.local.get(["classes"]);
  const classList = (classes || []).slice();

  els.classList.innerHTML = "";

  if (classList.length === 0) {
    els.emptyClasses.classList.remove("hidden");
    if (els.classesSectionHeader) els.classesSectionHeader.classList.add("hidden");
    return;
  }
  els.emptyClasses.classList.add("hidden");
  if (els.classesSectionHeader) els.classesSectionHeader.classList.remove("hidden");

  const now = new Date();
  classList.forEach(c => {
    c._ongoing = getOngoingClass(c, now);
    c._nextDate = getNextClassDate(c, now);
  });
  classList.sort((a, b) => {
    if (a._ongoing && !b._ongoing) return -1;
    if (!a._ongoing && b._ongoing) return 1;
    if (a._ongoing && b._ongoing) return a._ongoing.end - b._ongoing.end;
    if (!a._nextDate && !b._nextDate) return 0;
    if (!a._nextDate) return 1;
    if (!b._nextDate) return -1;
    return a._nextDate - b._nextDate;
  });

  const videoIcon = `<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;

  const fragment = document.createDocumentFragment();
  for (const cls of classList) {
    const card = document.createElement("div");
    card.className = "class-card";

    if (editingClassId === cls.id) {
      card.classList.add("editing");
      card.dataset.id = cls.id;
      card.innerHTML = buildInlineEditFormHtml(cls);
      fragment.appendChild(card);
      continue;
    }

    const meetingType = cls.meetingType || "other";
    const meetingLabel = MEETING_LABELS[meetingType] || "Other Link";
    const hasLink = !!cls.meetingLink;
    const ongoing = cls._ongoing;
    const startsIn = formatStartsIn(cls._nextDate, now);
    const status = ongoing
      ? { label: "Ongoing", className: "in-progress" }
      : getClassStatus(cls._nextDate, now);

    const daysDisplay = (cls.days && cls.days.length)
      ? cls.days.map(d => DAY_LABELS[d]).filter(Boolean).join(", ")
      : "";
    const scheduleFallbackParts = [daysDisplay, cls.classTime].filter(Boolean);
    const scheduleFallback = scheduleFallbackParts.length ? scheduleFallbackParts.join(" · ") : "No schedule set";
    const timeText = ongoing
      ? (formatEndsIn(ongoing.end, now) || scheduleFallback)
      : (startsIn || scheduleFallback);

    const statusBadgeHtml = status
      ? `<span class="class-status-badge ${status.className}">${status.label}</span>`
      : "";

    const linkPillHtml = hasLink
      ? `<span class="link-pill saved">Link Saved</span>`
      : `<span class="link-pill missing">Missing Link</span>`;

    const actionsHtml = hasLink
      ? `<button class="class-action-btn primary-action btn-join" data-id="${cls.id}">${videoIcon}<span>Join Class</span></button>
         <button class="class-action-btn btn-edit" data-id="${cls.id}">Edit Link</button>
         <button class="class-action-btn btn-remind" data-id="${cls.id}">Remind Me</button>`
      : `<button class="class-action-btn primary-action wide btn-edit" data-id="${cls.id}">Add Link</button>
         <button class="class-action-btn btn-remind" data-id="${cls.id}">Remind Me</button>`;

    card.innerHTML = `
      <div class="class-card-header">
        <h3 class="class-card-title">${escapeHtml(cls.name)}</h3>
        <div class="class-card-header-right">
          ${statusBadgeHtml}
          <button class="class-card-delete" data-id="${cls.id}" title="Delete">✕</button>
        </div>
      </div>
      <p class="class-card-time">${escapeHtml(timeText)}</p>
      <div class="class-card-pills">
        <span class="meeting-pill ${escapeHtml(meetingType)}">${escapeHtml(meetingLabel)}</span>
        ${linkPillHtml}
      </div>
      <div class="class-card-actions">
        ${actionsHtml}
      </div>
    `;

    fragment.appendChild(card);
  }
  els.classList.appendChild(fragment);

  els.classList.querySelectorAll(".class-card-delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const { classes } = await chrome.storage.local.get(["classes"]);
      const updated = (classes || []).filter(c => c.id !== id);
      await chrome.storage.local.set({ classes: updated });
      chrome.runtime.sendMessage({ type: "classes-updated" });
      await renderClasses();
      setStatus("Class deleted!", "success");
      setTimeout(() => setStatus(""), 2000);
    });
  });

  els.classList.querySelectorAll(".btn-join").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const { classes } = await chrome.storage.local.get(["classes"]);
      const cls = (classes || []).find(c => c.id === id);
      const url = normalizeMeetingLink(cls && cls.meetingLink);
      if (url) chrome.tabs.create({ url });
    });
  });

  els.classList.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", async () => {
      editingClassId = btn.dataset.id;
      await renderClasses();
    });
  });

  els.classList.querySelectorAll(".class-card.editing").forEach(card => {
    card.querySelectorAll(".inline-day-btn").forEach(b => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        b.classList.toggle("active");
      });
    });

    const cancelBtn = card.querySelector(".edit-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        editingClassId = null;
        await renderClasses();
      });
    }

    const saveBtn = card.querySelector(".edit-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const id = saveBtn.dataset.id;
        const name = card.querySelector(".edit-name").value.trim();
        const meetingLink = normalizeMeetingLink(card.querySelector(".edit-link").value);
        const meetingType = card.querySelector(".edit-type").value;
        const classTime = card.querySelector(".edit-start-time").value;
        const endTime = card.querySelector(".edit-end-time").value || null;
        const days = Array.from(card.querySelectorAll(".inline-day-btn.active")).map(b => b.dataset.day);

        if (!name || days.length === 0 || !meetingLink) {
          setStatus("Please enter a subject name, a meeting link, and select at least one day.", "error");
          setTimeout(() => setStatus(""), 2800);
          return;
        }

        const { classes } = await chrome.storage.local.get(["classes"]);
        const list = (classes || []).slice();
        const idx = list.findIndex(c => c.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], name, meetingLink, meetingType, classTime, endTime, days };
          await chrome.storage.local.set({ classes: list });
          chrome.runtime.sendMessage({ type: "classes-updated" });
          setStatus("Class updated!", "success");
          setTimeout(() => setStatus(""), 2000);
        }
        editingClassId = null;
        await renderClasses();
      });
    }
  });

  els.classList.querySelectorAll(".btn-remind").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const { classes } = await chrome.storage.local.get(["classes"]);
      const cls = (classes || []).find(c => c.id === id);
      if (!cls) return;
      const next = getNextClassDate(cls, new Date());
      if (!next) {
        setStatus("Set days and a time first to schedule a reminder.", "error");
        setTimeout(() => setStatus(""), 2500);
        return;
      }
      const remindAt = next.getTime() - 15 * 60 * 1000;
      if (remindAt <= Date.now()) {
        setStatus("Class is too soon to set a reminder.", "error");
        setTimeout(() => setStatus(""), 2500);
        return;
      }
      chrome.alarms.create(`class_${cls.id}`, { when: remindAt });
      setStatus(`Reminder set for ${new Date(remindAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`, "success");
      setTimeout(() => setStatus(""), 3000);
    });
  });
}

async function renderFromStorage() {
  const { deadlines } = await chrome.storage.local.get(["deadlines"]);
  renderDeadlines(deadlines || []);
  updateSummaryCounts(deadlines || []);
  await loadAndRenderNotifications();
  await renderClasses();
}

// --- TAB SWITCHING ---
function switchTab(tabNumber) {
  // Hide all
  els.page1.classList.add("hidden");
  els.page2.classList.add("hidden");
  els.page3.classList.add("hidden");
  els.page1.classList.remove("active");
  els.page2.classList.remove("active");
  els.page3.classList.remove("active");
  
  els.tab1Btn.classList.remove("active");
  els.tab2Btn.classList.remove("active");
  els.tab3Btn.classList.remove("active");

  // Show selected
  if (tabNumber === 1) {
    els.page1.classList.remove("hidden");
    els.page1.classList.add("active");
    els.tab1Btn.classList.add("active");
  } else if (tabNumber === 2) {
    els.page2.classList.remove("hidden");
    els.page2.classList.add("active");
    els.tab2Btn.classList.add("active");
  } else if (tabNumber === 3) {
    els.page3.classList.remove("hidden");
    els.page3.classList.add("active");
    els.tab3Btn.classList.add("active");
  }
}

els.settingsToggle.addEventListener("click", () => els.settingsPanel.classList.toggle("hidden"));
els.saveSettings.addEventListener("click", saveSettings);
els.clearSettings.addEventListener("click", clearSettings);
els.syncBtn.addEventListener("click", fetchDeadlines);

els.markAllRead.addEventListener("click", async () => {
  const { notifications = [], appNotifications = [], dismissedNotifications = [] } =
    await chrome.storage.local.get(["notifications", "appNotifications", "dismissedNotifications"]);
  const dismissedSet = new Set(dismissedNotifications);
  let added = 0;
  for (const n of [...appNotifications, ...notifications]) {
    const key = `${n.type}:${n.id}`;
    if (!dismissedSet.has(key)) {
      dismissedSet.add(key);
      added++;
    }
  }
  if (added === 0) {
    setStatus("No new notifications to mark.", "info");
    setTimeout(() => setStatus(""), 1800);
    return;
  }
  await chrome.storage.local.set({ dismissedNotifications: Array.from(dismissedSet) });
  await loadAndRenderNotifications();
  setStatus(`Marked ${added} as read.`, "success");
  setTimeout(() => setStatus(""), 1800);
});

els.tab1Btn.addEventListener("click", () => switchTab(1));
els.tab2Btn.addEventListener("click", () => switchTab(2));
els.tab3Btn.addEventListener("click", () => switchTab(3));

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    const { deadlines } = await chrome.storage.local.get(["deadlines"]);
    renderDeadlines(deadlines || [], e.target.dataset.filter);
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.appNotifications || changes.notifications || changes.dismissedNotifications) {
    loadAndRenderNotifications();
  }
});

(async function init() {
  await loadSettings();
  await renderFromStorage();
  const { canvasUrl, apiToken } = await chrome.storage.local.get(["canvasUrl", "apiToken"]);
  if (!canvasUrl || !apiToken) els.settingsPanel.classList.remove("hidden");
})();
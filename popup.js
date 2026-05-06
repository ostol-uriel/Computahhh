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
  // We keep the original HTML IDs so your popup.html doesn't break
  notificationsList: document.getElementById("announcementsList"), 
  emptyNotifications: document.getElementById("emptyAnnouncements"),
  dueTodayCount: document.getElementById("dueTodayCount"),
  dueWeekCount: document.getElementById("dueWeekCount"),
  overdueCount: document.getElementById("overdueCount"),
  // Classes elements
  classInput: document.getElementById("classInput"),
  meetingLink: document.getElementById("meetingLink"),
  meetingType: document.getElementById("meetingType"),
  classTime: document.getElementById("classTime"),
  addClass: document.getElementById("addClass"),
  classList: document.getElementById("classList"),
  emptyClasses: document.getElementById("emptyClasses")
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

  let text;
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m`;

  return diff < 0 ? `Overdue by ${text}` : `Due in ${text}`;
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
  renderNotifications([]);
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
      submitted: submission.submitted_at ? true : false,
      grade: submission.grade || null,
      workflowState: submission.workflow_state || "unsubmitted"
    };
  } catch (err) {
    return { submitted: false, grade: null, workflowState: "unsubmitted" };
  }
}

async function fetchAnnouncements(baseUrl, token) {
  try {
    const courses = await canvasFetch(baseUrl, token, "/courses?enrollment_state=active");
    const announcementsLists = await Promise.all(
      courses.map(async (course) => {
        try {
          const items = await canvasFetch(baseUrl, token, `/courses/${course.id}/announcements`);
          return items.map((ann) => ({
            id: `ann-${course.id}-${ann.id}`, 
            type: "announcement",
            courseId: course.id, 
            courseName: course.name || course.course_code || "Course",
            title: ann.title, 
            message: ann.message, 
            postedAt: ann.posted_at, 
            htmlUrl: ann.html_url,
          }));
        } catch (err) { 
          console.error(`Failed to fetch announcements for course ${course.id}:`, err);
          return []; 
        }
      })
    );
    return announcementsLists.flat();
  } catch (err) { 
    console.error("Failed to fetch announcements:", err);
    return []; 
  }
}

async function fetchInbox(baseUrl, token) {
  try {
    const messages = await canvasFetch(baseUrl, token, "/conversations");
    return messages.map((msg) => ({
      id: `inbox-${msg.id}`,
      type: "inbox",
      courseName: msg.context_name || "Direct Message",
      title: msg.subject || "No Subject",
      message: msg.last_message,
      postedAt: msg.last_message_at,
      htmlUrl: `${baseUrl}/conversations/${msg.id}`
    }));
  } catch (err) { 
    console.error("Failed to fetch inbox:", err);
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
            const details = await fetchAssignmentDetails(canvasUrl, apiToken, course.id, a.id);
            const submission = await fetchUserSubmission(canvasUrl, apiToken, course.id, a.id);
            return {
              id: a.id, courseId: course.id, courseName: course.name || course.course_code || "Course",
              title: a.name, dueAt: a.due_at, htmlUrl: a.html_url,
              prerequisites: details.prerequisites, description: details.description,
              locked: details.locked, lockExplanation: details.lockExplanation,
              submitted: submission.submitted,
              workflowState: submission.workflowState
            };
          }));
        } catch { return []; }
      })
    );

    const now = Date.now();
    const deadlines = assignmentsLists.flat().filter((a) => a.dueAt && new Date(a.dueAt).getTime() >= now - 7 * DAY_MS)
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

    // Preserve the "Done" state and auto-mark submitted assignments
    if (oldDeadlines && Array.isArray(oldDeadlines)) {
      const doneSet = new Set(oldDeadlines.filter(d => d.isDone).map(d => d.id));
      deadlines.forEach(d => {
        // Mark as done if manually marked OR if submitted on Canvas
        if (doneSet.has(d.id) || d.submitted) {
          d.isDone = true;
        }
      });
    } else {
      // First sync: mark submitted assignments as done
      deadlines.forEach(d => {
        if (d.submitted) {
          d.isDone = true;
        }
      });
    }

    // Fetch Announcements & Inbox
    const announcements = await fetchAnnouncements(canvasUrl, apiToken);
    const inbox = await fetchInbox(canvasUrl, apiToken);
    
    // Combine, filter out old ones (> 30 days), and sort chronologically
    const notifications = [...announcements, ...inbox]
      .filter((n) => n.postedAt && new Date(n.postedAt).getTime() >= now - 30 * DAY_MS)
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

    const lastSyncAt = new Date().toISOString();
    
    await chrome.storage.local.set({ deadlines, notifications, lastSyncAt });
    els.lastSync.textContent = `Last synced ${new Date(lastSyncAt).toLocaleString()}`;

    renderDeadlines(deadlines);
    updateSummaryCounts(deadlines);
    renderNotifications(notifications);
    
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

  const sections = { overdue: [], today: [], week: [], later: [] };
  for (const d of filtered) sections[getTimeCategory(new Date(d.dueAt).getTime(), now)].push(d);

  const fragment = document.createDocumentFragment();
  const sectionLabels = { overdue: "OVERDUE", today: "TODAY", week: "THIS WEEK", later: "LATER" };

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

      // Header
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

      // Course Info
      const course = document.createElement("p");
      course.className = "deadline-course";
      course.textContent = d.courseName;
      li.appendChild(course);

      const due_info = document.createElement("p");
      due_info.className = "deadline-due";
      due_info.textContent = `Due: ${formatDueDate(d.dueAt)}`;
      li.appendChild(due_info);

      // Countdown
      const meta = document.createElement("div");
      meta.className = "deadline-meta";
      const countdown = document.createElement("span");
      countdown.className = "countdown";
      countdown.textContent = formatCountdown(dueTime, now);
      meta.appendChild(countdown);
      li.appendChild(meta);

      // Actions Container
      const actions = document.createElement("div");
      actions.className = "deadline-actions";
      actions.style.position = "relative"; 

      // 1. OPEN BUTTON
      const openBtn = document.createElement("button");
      openBtn.className = "action-btn open";
      openBtn.textContent = "📂 Open";
      openBtn.addEventListener("click", () => { if (d.htmlUrl) chrome.tabs.create({ url: d.htmlUrl }); });
      actions.appendChild(openBtn);

      // 2. REMIND BUTTON
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

        // Predefined Options
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

        // Custom Time Divider
        const separator = document.createElement("div");
        separator.style.height = "1px";
        separator.style.background = "#eee";
        separator.style.margin = "4px 0";
        menu.appendChild(separator);

        // Custom Time Header
        const customHeader = document.createElement("div");
        customHeader.textContent = "Custom Reminder";
        customHeader.style.padding = "8px 16px 4px 16px";
        customHeader.style.fontSize = "11px";
        customHeader.style.fontWeight = "bold";
        customHeader.style.color = "#888";
        menu.appendChild(customHeader);

        // Custom Time Inputs
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

        // Auto-close menu when clicking outside
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

      // 3. DONE BUTTON (With Toggle and Storage Saving)
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

function renderNotifications(notifications) {
  els.notificationsList.innerHTML = "";
  if (!notifications || notifications.length === 0) {
    els.emptyNotifications.classList.remove("hidden");
    els.emptyNotifications.textContent = "No recent notifications.";
    return;
  }
  els.emptyNotifications.classList.add("hidden");

  const fragment = document.createDocumentFragment();
  for (const item of notifications) {
    const div = document.createElement("div");
    div.className = "announcement-item";
    
    // Add an emoji icon based on what type of notification it is
    const icon = item.type === "inbox" ? "✉️" : "📢";
    
    // Strip HTML tags and truncate message
    const messagePreview = item.message 
      ? item.message.replace(/<[^>]*>/g, '').substring(0, 100) + (item.message.length > 100 ? "..." : "")
      : "(No message)";

    div.innerHTML = `
      <p class="announcement-title">${icon} ${item.title}</p>
      <p class="announcement-course">${item.courseName}</p>
      <p class="announcement-content">${messagePreview}</p>
      <p class="announcement-date">${formatDueDate(item.postedAt)}</p>
    `;
    div.style.cursor = "pointer";
    div.addEventListener("click", () => { if (item.htmlUrl) chrome.tabs.create({ url: item.htmlUrl }); });
    fragment.appendChild(div);
  }
  els.notificationsList.appendChild(fragment);
}

async function renderFromStorage() {
  const { deadlines, notifications } = await chrome.storage.local.get(["deadlines", "notifications"]);
  renderDeadlines(deadlines || []);
  updateSummaryCounts(deadlines || []);
  renderNotifications(notifications || []);
  await renderClasses();
}

async function renderClasses() {
  const { classes } = await chrome.storage.local.get(["classes"]);
  const classList = classes || [];
  
  els.classList.innerHTML = "";
  
  if (classList.length === 0) {
    els.emptyClasses.classList.remove("hidden");
    return;
  }
  els.emptyClasses.classList.add("hidden");
  
  const fragment = document.createDocumentFragment();
  for (const cls of classList) {
    const div = document.createElement("div");
    div.className = "class-item";
    
    const meetingIcon = {
      "google-meet": "🎥",
      "zoom": "🎥",
      "teams": "👥",
      "other": "🔗"
    }[cls.meetingType] || "🔗";
    
    const timeDisplay = cls.classTime ? ` - ${cls.classTime}` : "";
    
    div.innerHTML = `
      <div class="class-header">
        <p class="class-name">${cls.name}</p>
        <button class="delete-class-btn" data-id="${cls.id}" title="Delete">✕</button>
      </div>
      <p class="class-time">${timeDisplay || "No time set"}</p>
      <div class="class-actions">
        ${cls.meetingLink ? `<a href="${cls.meetingLink}" target="_blank" class="class-link-btn">${meetingIcon} ${cls.meetingType.replace("-", " ").charAt(0).toUpperCase() + cls.meetingType.slice(1)}</a>` : '<span class="no-link">No link</span>'}
        <button class="edit-class-btn" data-id="${cls.id}" title="Edit">Edit</button>
        <button class="remind-class-btn" data-id="${cls.id}" title="Remind">🔔 Remind</button>
      </div>
    `;
    
    fragment.appendChild(div);
  }
  els.classList.appendChild(fragment);
  
  // Add event listeners
  els.classList.querySelectorAll(".delete-class-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const { classes } = await chrome.storage.local.get(["classes"]);
      const updated = (classes || []).filter(c => c.id !== id);
      await chrome.storage.local.set({ classes: updated });
      await renderClasses();
      setStatus("Class deleted!", "success");
      setTimeout(() => setStatus(""), 2000);
    });
  });
  
  els.classList.querySelectorAll(".edit-class-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const { classes } = await chrome.storage.local.get(["classes"]);
      const cls = (classes || []).find(c => c.id === id);
      if (cls) {
        els.classInput.value = cls.name;
        els.meetingLink.value = cls.meetingLink || "";
        els.meetingType.value = cls.meetingType;
        els.classTime.value = cls.classTime || "";
        // Mark for editing
        els.addClass.dataset.editId = id;
        els.addClass.textContent = "Update Class";
      }
    });
  });
  
  els.classList.querySelectorAll(".remind-class-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const { classes } = await chrome.storage.local.get(["classes"]);
      const cls = (classes || []).find(c => c.id === id);
      if (cls && cls.classTime) {
        setStatus("Reminder set for " + cls.classTime, "success");
        setTimeout(() => setStatus(""), 2000);
      }
    });
  });
}

async function addClass() {
  const name = els.classInput.value.trim();
  const meetingLink = els.meetingLink.value.trim();
  const meetingType = els.meetingType.value;
  const classTime = els.classTime.value;
  
  if (!name) {
    setStatus("Enter a class name", "error");
    return;
  }
  
  const { classes } = await chrome.storage.local.get(["classes"]);
  let classList = classes || [];
  
  const editId = els.addClass.dataset.editId;
  if (editId) {
    // Update existing class
    const idx = classList.findIndex(c => c.id === editId);
    if (idx !== -1) {
      classList[idx] = {
        ...classList[idx],
        name,
        meetingLink,
        meetingType,
        classTime
      };
    }
    els.addClass.dataset.editId = "";
    els.addClass.textContent = "Add Class";
  } else {
    // Add new class
    classList.push({
      id: Date.now().toString(),
      name,
      meetingLink,
      meetingType,
      classTime
    });
  }
  
  await chrome.storage.local.set({ classes: classList });
  els.classInput.value = "";
  els.meetingLink.value = "";
  els.meetingType.value = "google-meet";
  els.classTime.value = "";
  
  await renderClasses();
  setStatus("Class saved!", "success");
  setTimeout(() => setStatus(""), 2000);
}


els.settingsToggle.addEventListener("click", () => els.settingsPanel.classList.toggle("hidden"));
els.saveSettings.addEventListener("click", saveSettings);
els.clearSettings.addEventListener("click", clearSettings);
els.syncBtn.addEventListener("click", fetchDeadlines);

function switchTab(tabNumber) {
  els.page1.classList.remove("active");
  els.page2.classList.remove("active");
  els.page3.classList.remove("active");
  els.page1.classList.add("hidden");
  els.page2.classList.add("hidden");
  els.page3.classList.add("hidden");
  els.tab1Btn.classList.remove("active");
  els.tab2Btn.classList.remove("active");
  els.tab3Btn.classList.remove("active");

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

els.tab1Btn.addEventListener("click", () => switchTab(1));
els.tab2Btn.addEventListener("click", () => switchTab(2));
els.tab3Btn.addEventListener("click", () => {
  switchTab(3);
  renderClasses();
});

els.addClass.addEventListener("click", addClass);

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    const { deadlines } = await chrome.storage.local.get(["deadlines"]);
    renderDeadlines(deadlines || [], e.target.dataset.filter);
  });
});

(async function init() {
  await loadSettings();
  await renderFromStorage();
  const { canvasUrl, apiToken } = await chrome.storage.local.get(["canvasUrl", "apiToken"]);
  if (!canvasUrl || !apiToken) els.settingsPanel.classList.remove("hidden");
})();
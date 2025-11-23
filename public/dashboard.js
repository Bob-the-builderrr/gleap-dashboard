// Gleap Dashboard - Direct API Calls
const GLEAP_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE";
const PROJECT_ID = "64d9fa1b014ae7130f2e58d1";
const TEAM_ID = "66595e93b58fb2a1e6b8a83f";
const IST_OFFSET_MINUTES = 330; // UTC+5:30
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

const GLEAP_HEADERS = {
  "Authorization": `Bearer ${GLEAP_TOKEN}`,
  "project": PROJECT_ID,
  "Accept": "application/json"
};

const SHIFTS_ROSTER = {
  morning: {
    label: "Morning",
    leader: "pratik@smartlead.ai",
    members: ["chandra@smartlead.ai"]
  },
  noon: {
    label: "Noon",
    leader: "vanshree@smartlead.ai",
    members: [
      "danielle@smartlead.ai",
      "hemylyn@smartlead.ai",
      "jan@smartlead.ai",
      "elizhabeth@smartlead.ai",
      "gayathri@smartlead.ai"
    ]
  },
  night: {
    label: "Night",
    leader: "evan",
    members: [
      "edward@smartlead.ai",
      "graham@smartlead.ai",
      "sivaraman@smartlead.ai",
      "abigail@smartlead.ai"
    ]
  }
};

// DOM Elements
const dom = {
  startInput: document.getElementById("startInput"),
  endInput: document.getElementById("endInput"),
  fetchBtn: document.getElementById("fetchBtn"),
  errorBanner: document.getElementById("errorBanner"),
  lastUpdated: document.getElementById("lastUpdated"),
  tableBody: document.getElementById("tableBody"),
  agentSearch: document.getElementById("agentSearch"),
  totalTicketsValue: document.getElementById("totalTicketsValue"),
  averageRatingValue: document.getElementById("averageRatingValue"),
  totalAgentsValue: document.getElementById("totalAgentsValue"),
  visibleAgentsCount: document.getElementById("visibleAgentsCount"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  autoRefresh: document.getElementById("autoRefresh"),
  exportBtn: document.getElementById("exportBtn"),
  overviewView: document.getElementById("overviewView"),
  shiftsView: document.getElementById("shiftsView"),
  archivedView: document.getElementById("archivedView"),
  morningBody: document.getElementById("morningBody"),
  noonBody: document.getElementById("noonBody"),
  nightBody: document.getElementById("nightBody"),
  archivedTableBody: document.getElementById("archivedTableBody"),
  archivedWindow: document.getElementById("archivedWindow"),
  archivedSearch: document.getElementById("archivedSearch"),
  archivedHourlyBreakdown: document.getElementById("archivedHourlyBreakdown")
};

// State
let agentsData = [];
let shiftsData = null;
let sortKey = "ticket_activity";
let sortDir = "desc";
let lastRange = null;
let autoRefreshTimer = null;
let currentView = "overview";

// === UTILITY FUNCTIONS ===

function toInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function istToUtcIso(istDateStr, isEndOfDay = false) {
  const date = new Date(istDateStr);
  if (isEndOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  const utcMs = date.getTime() - (IST_OFFSET_MINUTES * 60 * 1000);
  return new Date(utcMs).toISOString();
}

function setInputsForRange(startUtc, endUtc) {
  dom.startInput.value = toInputValue(startUtc);
  dom.endInput.value = toInputValue(endUtc);
}

function getRangeFromInputs() {
  try {
    const startIso = istToUtcIso(dom.startInput.value);
    const endIso = istToUtcIso(dom.endInput.value, true);
    if (new Date(startIso) >= new Date(endIso)) {
      throw new Error("Start time must be before end time");
    }
    return { startIso, endIso };
  } catch (err) {
    showError(err.message || "Invalid date range");
    return null;
  }
}

function showError(message) {
  dom.errorBanner.textContent = message;
  dom.errorBanner.classList.remove("hidden");
}

function clearError() {
  dom.errorBanner.classList.add("hidden");
}

function setLoading(state) {
  dom.loadingOverlay.classList.toggle("hidden", !state);
  if (dom.fetchBtn) dom.fetchBtn.disabled = state;
}

function updateLastUpdated() {
  const now = new Date();
  dom.lastUpdated.textContent = `• Updated ${now.toLocaleTimeString()}`;
}

function formatLastSeen(iso) {
  if (!iso) return { date: "--", time: "--" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "--", time: "--" };
  return {
    date: d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  };
}

function ratingClass(score) {
  if (!Number.isFinite(score)) return "";
  if (score >= 90) return "good";
  if (score >= 75) return "";
  return "bad";
}

// === API FUNCTIONS ===

async function fetchTeamPerformance(startIso, endIso) {
  const url = new URL("https://dashapi.gleap.io/v3/statistics/lists");
  url.searchParams.set("chartType", "TEAM_PERFORMANCE_LIST");
  url.searchParams.set("startDate", startIso);
  url.searchParams.set("endDate", endIso);
  url.searchParams.set("useWorkingHours", "false");
  url.searchParams.set("team", TEAM_ID);
  url.searchParams.set("aggsType", "MEDIAN");

  const res = await fetch(url.toString(), { headers: GLEAP_HEADERS });
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();
  const rawList = data.data || data.list || [];

  return rawList.map(item => {
    const user = item.processingUser || {};
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Unknown";

    if (!name || name === "Unknown") return null;

    return {
      agent_name: name,
      agent_email: user.email || "",
      profile_image: user.profileImageUrl || "",
      last_seen_iso: user.lastSeen || null,
      total_tickets: item.totalCountForUser?.value || 0,
      closed_tickets: item.rawClosed?.value || 0,
      median_reply_time: formatDuration(item.medianReplyTime?.rawValue),
      median_reply_seconds: item.medianReplyTime?.rawValue || 0,
      median_first_reply: formatDuration(item.medianTimeToFirstReplyInSec?.rawValue),
      median_first_reply_seconds: item.medianTimeToFirstReplyInSec?.rawValue || 0,
      average_rating: item.averageRating?.value || "--",
      rating_score: parseRating(item.averageRating?.value),
      ticket_activity: item.ticketActivityCount?.value || 0,
      hours_active: formatHoursActive(item.hoursActive?.rawValue)
    };
  }).filter(Boolean);
}

async function fetchArchivedTickets(minutes) {
  let limit = 200;
  if (minutes >= 480) limit = 1000;
  else if (minutes >= 120) limit = 500;

  const url = `https://dashapi.gleap.io/v3/tickets?skip=0&limit=${limit}&filter={}&sort=-archivedAt&ignoreArchived=true&isSpam=false&type[]=INQUIRY&archived=true`;
  const res = await fetch(url, { headers: GLEAP_HEADERS });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.tickets || [];
}

function formatDuration(rawValue) {
  const seconds = Number(rawValue);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  const hours = seconds / 3600;
  return `${hours.toFixed(1)}h`;
}

function formatHoursActive(rawValue) {
  const numeric = Number(rawValue);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${(numeric / 3600).toFixed(1)}h`;
  }
  return "--";
}

function parseRating(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const match = String(value).match(/(-?\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

// === RENDER FUNCTIONS ===

function renderTable() {
  const tbody = dom.tableBody;
  tbody.innerHTML = "";

  const searchTerm = dom.agentSearch.value.trim().toLowerCase();
  const filtered = agentsData.filter(agent => {
    const name = (agent.agent_name || "").toLowerCase();
    const email = (agent.agent_email || "").toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm);
  });

  const dir = sortDir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * dir;
    }
    return String(va).localeCompare(String(vb)) * dir;
  });

  dom.visibleAgentsCount.textContent = sorted.length;

  if (!sorted.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="8" class="no-data">No agents found</td>';
    tbody.appendChild(row);
    updateSortIndicators();
    return;
  }

  sorted.forEach(agent => {
    const lastSeen = formatLastSeen(agent.last_seen_iso);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="agent">
          <div class="avatar ${agent.profile_image ? "" : "placeholder"}">
            ${agent.profile_image ? `<img src="${agent.profile_image}" alt="${agent.agent_name}">` : agent.agent_name.charAt(0)}
          </div>
          <div>
            <div class="agent-name">${agent.agent_name}</div>
            <div class="agent-email">${agent.agent_email || ""}</div>
          </div>
        </div>
      </td>
      <td class="number">${agent.ticket_activity ?? 0}</td>
      <td class="number">${agent.closed_tickets ?? 0}</td>
      <td><span class="chip time">${agent.median_reply_time}</span></td>
      <td><span class="chip time">${agent.median_first_reply}</span></td>
      <td><span class="chip rating ${ratingClass(agent.rating_score)}">${agent.average_rating}</span></td>
      <td>${lastSeen.date} ${lastSeen.time}</td>
      <td>${agent.hours_active || "--"}</td>
    `;
    tbody.appendChild(row);
  });

  updateSortIndicators();
}

function getSortValue(agent, key) {
  if (!agent) return 0;
  if (key === "hours_active") {
    const numeric = parseFloat(String(agent.hours_active).replace("h", ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  if (key === "last_seen_iso") {
    const ts = new Date(agent.last_seen_iso || 0).getTime();
    return Number.isFinite(ts) ? ts : 0;
  }
  return agent[key] ?? 0;
}

function updateSortIndicators() {
  document.querySelectorAll("th.sortable").forEach(th => {
    const key = th.getAttribute("data-sort");
    const indicator = th.querySelector(".sort-indicator");
    th.classList.toggle("active", key === sortKey);
    if (indicator) {
      indicator.textContent = key === sortKey ? (sortDir === "asc" ? "↑" : "↓") : "";
    }
  });
}

function updateSummaryCards(agents) {
  const totalTickets = agents.reduce((sum, a) => sum + (a.ticket_activity || 0), 0);
  dom.totalTicketsValue.textContent = totalTickets;

  const ratings = agents.map(a => a.rating_score).filter(v => Number.isFinite(v));
  const avgRating = ratings.length ? (ratings.reduce((sum, v) => sum + v, 0) / ratings.length).toFixed(1) : "--";
  dom.averageRatingValue.textContent = avgRating;

  dom.totalAgentsValue.textContent = agents.length;
}

function renderShifts() {
  if (!shiftsData) return;

  renderShiftTable(dom.morningBody, shiftsData.morning, SHIFTS_ROSTER.morning);
  renderShiftTable(dom.noonBody, shiftsData.noon, SHIFTS_ROSTER.noon);
  renderShiftTable(dom.nightBody, shiftsData.night, SHIFTS_ROSTER.night);
}

function renderShiftTable(tbody, agents, roster) {
  tbody.innerHTML = "";

  const shiftAgents = agents.filter(a => {
    const email = (a.agent_email || "").toLowerCase();
    const name = (a.agent_name || "").toLowerCase();
    const isLeader = email === roster.leader || name.includes(roster.leader);
    const isMember = roster.members.some(m => email === m || name.includes(m));
    return isLeader || isMember;
  });

  if (!shiftAgents.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="no-data">No agents active</td></tr>';
    return;
  }

  shiftAgents.sort((a, b) => (b.ticket_activity || 0) - (a.ticket_activity || 0));

  shiftAgents.forEach(agent => {
    const email = (agent.agent_email || "").toLowerCase();
    const name = (agent.agent_name || "").toLowerCase();
    const isLeader = email === roster.leader || name.includes(roster.leader);
    const lastSeen = formatLastSeen(agent.last_seen_iso);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="agent">
          <div class="avatar ${agent.profile_image ? "" : "placeholder"}">
            ${agent.profile_image ? `<img src="${agent.profile_image}">` : agent.agent_name.charAt(0)}
          </div>
          <div>
            <div class="agent-name">
              ${agent.agent_name}
              ${isLeader ? '<span class="leader-badge">Leader</span>' : ''}
            </div>
          </div>
        </div>
      </td>
      <td class="number">${agent.ticket_activity ?? 0}</td>
      <td><span class="chip rating ${ratingClass(agent.rating_score)}">${agent.average_rating}</span></td>
      <td>${lastSeen.time}</td>
    `;
    tbody.appendChild(row);
  });
}

function processArchivedTickets(tickets, minutes) {
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const windowStartIST = new Date(nowIST.getTime() - minutes * 60 * 1000);

  const agentMap = new Map();
  const hourlyMap = new Map();

  tickets.forEach(ticket => {
    if (!ticket.archived || !ticket.archivedAt) return;

    const user = ticket.processingUser || {};
    const agentId = user.id || "unknown";
    const agentName = user.firstName || user.email?.split("@")[0] || "Unknown";
    const agentEmail = user.email || "";
    const profileImage = user.profileImageUrl || "";
    const lastSeen = user.lastSeen || null;

    const archivedUTC = new Date(ticket.archivedAt);
    if (isNaN(archivedUTC.getTime())) return;

    const archivedIST = new Date(archivedUTC.getTime() + IST_OFFSET_MINUTES * 60 * 1000);

    if (archivedIST >= windowStartIST && archivedIST <= nowIST) {
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          name: agentName,
          email: agentEmail,
          profileImage,
          lastSeen,
          tickets: [],
          latestArchived: archivedIST
        });
      }

      const agentData = agentMap.get(agentId);
      agentData.tickets.push(archivedIST);
      if (archivedIST > agentData.latestArchived) {
        agentData.latestArchived = archivedIST;
      }

      const hour = archivedIST.getUTCHours();
      const hourKey = `h${hour}`;

      if (!hourlyMap.has(hourKey)) {
        hourlyMap.set(hourKey, new Map());
      }

      const hourAgents = hourlyMap.get(hourKey);
      if (!hourAgents.has(agentId)) {
        hourAgents.set(agentId, { name: agentName, email: agentEmail, count: 0 });
      }

      hourAgents.get(agentId).count++;
    }
  });

  return { agentMap, hourlyMap };
}

function renderArchivedTable(agentMap) {
  const tbody = dom.archivedTableBody;
  tbody.innerHTML = "";

  const rows = Array.from(agentMap.values()).map(agent => ({
    name: agent.name,
    email: agent.email,
    profileImage: agent.profileImage,
    lastSeen: agent.lastSeen,
    count: agent.tickets.length,
    latestArchived: agent.latestArchived
  }));

  rows.sort((a, b) => b.count - a.count);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="no-data">No archived tickets in this window</td></tr>';
    return;
  }

  rows.forEach(r => {
    const archivedDate = r.latestArchived.toISOString().split('T')[0];
    const archivedTime = r.latestArchived.toISOString().split('T')[1].substring(0, 5);

    let lastSeenTime = "--";
    if (r.lastSeen) {
      const lastSeenUTC = new Date(r.lastSeen);
      const lastSeenIST = new Date(lastSeenUTC.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
      lastSeenTime = lastSeenIST.toISOString().split('T')[1].substring(0, 5);
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="agent">
          <div class="avatar ${r.profileImage ? "" : "placeholder"}">
            ${r.profileImage ? `<img src="${r.profileImage}">` : r.name.charAt(0)}
          </div>
          <div>
            <div class="agent-name">${r.name}</div>
            <div class="agent-email">${r.email}</div>
          </div>
        </div>
      </td>
      <td class="number">${r.count}</td>
      <td>${archivedDate} ${archivedTime}</td>
      <td>${lastSeenTime}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderHourlyBreakdown(hourlyMap) {
  const container = dom.archivedHourlyBreakdown;
  container.innerHTML = "";

  if (hourlyMap.size === 0) {
    container.innerHTML = '<p class="no-data">No hourly data available</p>';
    return;
  }

  const hours = Array.from(hourlyMap.keys()).sort((a, b) => {
    const hourA = parseInt(a.substring(1));
    const hourB = parseInt(b.substring(1));
    return hourA - hourB;
  });

  hours.forEach(hourKey => {
    const hour = parseInt(hourKey.substring(1));
    const agents = hourlyMap.get(hourKey);
    const totalTickets = Array.from(agents.values()).reduce((sum, a) => sum + a.count, 0);

    const hourSection = document.createElement("div");
    hourSection.style.cssText = "background: rgba(59, 130, 246, 0.05); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 1px solid var(--border);";

    let agentsList = "";
    agents.forEach(agent => {
      agentsList += `<div style="display: inline-block; margin-right: 1rem; margin-bottom: 0.5rem;"><span style="color: var(--text);">${agent.name}</span>: <span style="color: var(--accent); font-weight: 600;">${agent.count}</span></div>`;
    });

    hourSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h4 style="font-size: 1rem; margin: 0;">${String(hour).padStart(2, '0')}:00</h4>
        <span style="background: var(--accent); color: white; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.875rem;">${totalTickets} tickets</span>
      </div>
      <div>${agentsList}</div>
    `;

    container.appendChild(hourSection);
  });
}

// === DATA FETCHING ===

async function fetchData() {
  const range = getRangeFromInputs();
  if (!range) return;

  clearError();
  setLoading(true);

  try {
    const agents = await fetchTeamPerformance(range.startIso, range.endIso);

    agentsData = agents;
    shiftsData = {
      morning: agents,
      noon: agents,
      night: agents
    };

    updateSummaryCards(agents);
    renderTable();
    if (currentView === "shifts") renderShifts();

    updateLastUpdated();
    lastRange = range;

    if (dom.autoRefresh.checked) {
      startAutoRefresh();
    }
  } catch (err) {
    showError(err.message || "Failed to load data");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

async function fetchAndRenderArchived() {
  const minutes = Number(dom.archivedWindow.value);
  setLoading(true);

  try {
    const tickets = await fetchArchivedTickets(minutes);
    const { agentMap, hourlyMap } = processArchivedTickets(tickets, minutes);

    renderArchivedTable(agentMap);
    renderHourlyBreakdown(hourlyMap);
  } catch (err) {
    showError(err.message || "Failed to load archived tickets");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// === VIEW SWITCHING ===

function switchView(view) {
  currentView = view;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  dom.overviewView.classList.add("hidden");
  dom.shiftsView.classList.add("hidden");
  dom.archivedView.classList.add("hidden");

  if (view === "overview") {
    dom.overviewView.classList.remove("hidden");
  } else if (view === "shifts") {
    dom.shiftsView.classList.remove("hidden");
    renderShifts();
  } else if (view === "archived") {
    dom.archivedView.classList.remove("hidden");
    fetchAndRenderArchived();
  }
}

// === AUTO REFRESH ===

function startAutoRefresh() {
  clearInterval(autoRefreshTimer);
  if (dom.autoRefresh.checked && lastRange) {
    autoRefreshTimer = setInterval(() => {
      fetchData();
      if (currentView === "archived") fetchAndRenderArchived();
    }, AUTO_REFRESH_MS);
  }
}

// === EVENT HANDLERS ===

function handleQuickRange(hours) {
  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - hours * 60 * 60 * 1000);
  setInputsForRange(startUtc, endUtc);
  fetchData();
}

function exportToCsv() {
  if (!agentsData.length) {
    showError("No data to export");
    return;
  }

  const headers = ["Agent", "Email", "Tickets", "Closed", "Reply Time", "First Reply", "Rating", "Hours Active"];
  const rows = agentsData.map(a => [
    a.agent_name,
    a.agent_email,
    a.ticket_activity,
    a.closed_tickets,
    a.median_reply_time,
    a.median_first_reply,
    a.average_rating,
    a.hours_active
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-performance-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// === INITIALIZATION ===

function init() {
  // Event listeners
  dom.fetchBtn.addEventListener("click", fetchData);
  dom.agentSearch.addEventListener("input", renderTable);
  dom.exportBtn.addEventListener("click", exportToCsv);
  dom.autoRefresh.addEventListener("change", () => startAutoRefresh());
  dom.archivedWindow.addEventListener("change", fetchAndRenderArchived);

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.querySelectorAll(".quick-actions button").forEach(btn => {
    btn.addEventListener("click", () => handleQuickRange(Number(btn.dataset.hours)));
  });

  document.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      if (!key) return;
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = "desc";
      }
      renderTable();
    });
  });

  // Set default time range (current hour)
  const now = new Date();
  const startUtc = new Date(now);
  startUtc.setMinutes(0, 0, 0);
  const endUtc = new Date(startUtc);
  endUtc.setHours(endUtc.getHours() + 1);
  setInputsForRange(startUtc, endUtc);

  // Initial fetch
  fetchData();
}

document.addEventListener("DOMContentLoaded", init);

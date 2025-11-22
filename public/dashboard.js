// public/dashboard.js

const FIVE_MINUTES_MS = 5 * 60 * 1000;

let agentsData = [];
let shiftsData = null; // Stores the result of the shift fetch
let hourlyData = null;
let sortKey = "ticket_activity";
let sortDir = "desc";
let lastRange = null;
let autoRefreshTimer = null;
let isLoading = false;
let currentView = "overview"; // 'overview' or 'shifts'

const SHIFTS_ROSTER = {
  morning: {
    label: "Morning",
    leader: "pratik@smartlead.ai",
    members: ["chandra@smartlead.ai"],
  },
  noon: {
    label: "Noon",
    leader: "vanshree@smartlead.ai",
    members: [
      "danielle@smartlead.ai",
      "hemylyn@smartlead.ai",
      "jan@smartlead.ai",
      "elizhabeth@smartlead.ai",
      "gayathri@smartlead.ai",
    ],
  },
  night: {
    label: "Night",
    leader: "evan", // Will match by name if email fails
    members: [
      "edward@smartlead.ai",
      "graham@smartlead.ai",
      "sivaraman@smartlead.ai",
      "abigail@smartlead.ai",
    ],
  },
};

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
  // Views
  overviewView: document.getElementById("overviewView"),
  shiftsView: document.getElementById("shiftsView"),
  tabBtns: document.querySelectorAll(".tab-btn"),
  // Shifts
  morningBody: document.getElementById("morningBody"),
  noonBody: document.getElementById("noonBody"),
  nightBody: document.getElementById("nightBody"),
  morningTotal: document.getElementById("morningTotal"),
  noonTotal: document.getElementById("noonTotal"),
  nightTotal: document.getElementById("nightTotal"),
  // Hourly Matrix
  hourlyMatrixBody: document.getElementById("hourlyMatrixBody"),
  hourlyMatrixHeader: document.getElementById("hourlyMatrixHeader"),
};

function toInputValue(date) {
  const local = new Date(date);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  const h = String(local.getHours()).padStart(2, "0");
  const min = String(local.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function parseInputToUtcIso(value, isEndOfDay) {
  const trimmed = (value || "").trim();
  if (!trimmed) throw new Error("Please select both start and end dates.");

  let datePart = "";
  let timePart = "";
  if (trimmed.includes("T")) {
    [datePart, timePart] = trimmed.split("T");
  } else {
    [datePart, timePart] = trimmed.split(" ");
  }

  datePart = (datePart || "").replace(/\//g, "-");
  if (!timePart) timePart = isEndOfDay ? "23:59" : "00:00";

  let normalized;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    normalized = `${datePart}T${timePart}`;
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
    const [day, month, year] = datePart.split("-").map(Number);
    if ([day, month, year].some(Number.isNaN)) {
      throw new Error("Invalid date format. Use dd-mm-yyyy or yyyy-mm-dd.");
    }
    normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}T${timePart}`;
  } else {
    throw new Error("Invalid date format. Use dd-mm-yyyy or yyyy-mm-dd.");
  }

  const date = new Date(normalized); // local time
  if (Number.isNaN(date.getTime())) throw new Error("Invalid time format.");
  if (isEndOfDay) date.setSeconds(59, 999);
  return date.toISOString();
}

function setInputsForRange(startUtc, endUtc) {
  dom.startInput.value = toInputValue(startUtc);
  dom.endInput.value = toInputValue(endUtc);
}

function getRangeFromInputs() {
  try {
    const startIso = parseInputToUtcIso(dom.startInput.value, false);
    const endIso = parseInputToUtcIso(dom.endInput.value, true);
    if (new Date(startIso) >= new Date(endIso)) {
      throw new Error("Start time must be before end time.");
    }
    return { startIso, endIso };
  } catch (err) {
    showError(err.message || "Invalid date range");
    return null;
  }
}

function setLoading(state, message = "Loading metrics...") {
  isLoading = state;
  dom.fetchBtn.disabled = state;
  dom.fetchBtn.classList.toggle("is-loading", state);
  dom.loadingOverlay.classList.toggle("hidden", !state);
  const loaderText = dom.loadingOverlay.querySelector(".loader-text");
  if (loaderText) loaderText.textContent = message;
}

function showError(message) {
  dom.errorBanner.textContent = message;
  dom.errorBanner.classList.remove("hidden");
}

function clearError() {
  dom.errorBanner.classList.add("hidden");
  dom.errorBanner.textContent = "";
}

function ratingClass(score) {
  if (!Number.isFinite(score)) return "";
  if (score >= 90) return "good";
  if (score >= 75) return "";
  return "bad";
}

function formatLastSeen(iso) {
  if (!iso) return { date: "--", time: "--" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "--", time: "--" };
  return {
    date: d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function renderTable() {
  const tbody = dom.tableBody;
  tbody.innerHTML = "";

  const searchTerm = dom.agentSearch.value.trim().toLowerCase();
  const filtered = agentsData.filter((agent) => {
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
    row.innerHTML =
      '<td class="no-data" colspan="9">No data for this range</td>';
    tbody.appendChild(row);
    updateSortIndicators();
    return;
  }

  sorted.forEach((agent) => {
    const lastSeen = formatLastSeen(agent.last_seen_iso);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="agent">
          <div class="avatar ${agent.profile_image ? "" : "placeholder"}">
            ${agent.profile_image
        ? `<img src="${agent.profile_image}" alt="${agent.agent_name}" loading="lazy" />`
        : (agent.agent_name || "?").charAt(0)
      }
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
      <td><span class="chip rating ${ratingClass(
        agent.rating_score
      )}">${agent.average_rating || "--"}</span></td>
      <td>${lastSeen.date}</td>
      <td>${lastSeen.time}</td>
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
  document.querySelectorAll("th.sortable").forEach((th) => {
    const key = th.getAttribute("data-sort");
    const indicator = th.querySelector(".sort-indicator");
    th.classList.toggle("active", key === sortKey);
    if (indicator) {
      indicator.textContent =
        key === sortKey ? (sortDir === "asc" ? "↑" : "↓") : "";
    }
  });
}

function updateSummaryCards(totals, totalAgents) {
  const totalTickets = Number(totals?.total_tickets);
  dom.totalTicketsValue.textContent = Number.isFinite(totalTickets)
    ? totalTickets
    : "--";

  const avgRating = Number(totals?.avg_rating);
  dom.averageRatingValue.textContent = Number.isFinite(avgRating)
    ? avgRating.toFixed(1)
    : "--";
  dom.totalAgentsValue.textContent =
    totalAgents != null ? totalAgents : agentsData.length;
}

function updateLastUpdated() {
  const now = new Date();
  dom.lastUpdated.textContent = `• Updated ${now.toLocaleTimeString()}`;
}

function renderShiftTable(tbody, agents, roster, totalEl) {
  tbody.innerHTML = "";

  // Filter agents belonging to this roster
  const shiftAgents = agents.filter(a => {
    const email = (a.agent_email || "").toLowerCase();
    const name = (a.agent_name || "").toLowerCase();

    const isLeader = email === roster.leader || name.includes(roster.leader);
    const isMember = roster.members.some(m => email === m || name.includes(m));
    return isLeader || isMember;
  });

  // Calculate Total for this shift (sum of displayed agents)
  const totalTickets = shiftAgents.reduce((sum, a) => sum + (a.ticket_activity || 0), 0);
  totalEl.textContent = totalTickets;

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
            ${agent.profile_image
        ? `<img src="${agent.profile_image}" alt="${agent.agent_name}" loading="lazy" />`
        : (agent.agent_name || "?").charAt(0)
      }
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
      <td><span class="chip rating ${ratingClass(agent.rating_score)}">${agent.average_rating || "--"}</span></td>
      <td>${lastSeen.time}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderHourlyMatrix() {
  if (!hourlyData || !dom.hourlyMatrixBody) return;

  const tbody = dom.hourlyMatrixBody;
  tbody.innerHTML = "";

  // We need to list all agents who appeared in ANY hour
  const allAgentsMap = new Map();

  Object.keys(hourlyData).forEach(key => {
    const res = hourlyData[key];
    if (res && res.agents) {
      res.agents.forEach(a => {
        const id = a.agent_email || a.agent_name;
        if (!allAgentsMap.has(id)) {
          allAgentsMap.set(id, { name: a.agent_name, email: a.agent_email, image: a.profile_image });
        }
      });
    }
  });

  const agents = Array.from(allAgentsMap.values());

  // Sort agents by shift roster (Morning -> Noon -> Night)
  const getShiftOrder = (email) => {
    if (email === SHIFTS_ROSTER.morning.leader || SHIFTS_ROSTER.morning.members.includes(email)) return 1;
    if (email === SHIFTS_ROSTER.noon.leader || SHIFTS_ROSTER.noon.members.includes(email)) return 2;
    if (email === SHIFTS_ROSTER.night.leader || SHIFTS_ROSTER.night.members.includes(email)) return 3;
    return 4; // Others
  };

  agents.sort((a, b) => getShiftOrder(a.email) - getShiftOrder(b.email));

  agents.forEach(agent => {
    const row = document.createElement("tr");

    // Agent Info
    let html = `
      <td class="sticky-col">
        <div class="agent small">
          <div class="agent-name">${agent.name}</div>
        </div>
      </td>
    `;

    // 24 Hours Columns
    let totalForRow = 0;
    for (let h = 0; h < 24; h++) {
      const hourKey = `h${h}`;
      const hourData = hourlyData[hourKey];
      const agentInHour = hourData?.agents?.find(a => (a.agent_email === agent.email || a.agent_name === agent.name));
      const count = agentInHour ? agentInHour.ticket_activity : 0;
      totalForRow += count;

      const intensityClass = count > 5 ? 'high' : (count > 0 ? 'low' : '');
      html += `<td class="hour-cell ${intensityClass}">${count || ''}</td>`;
    }

    html += `<td class="number strong">${totalForRow}</td>`;
    row.innerHTML = html;
    tbody.appendChild(row);
  });
}

function renderShifts() {
  if (!shiftsData) return;

  const { morning, noon, night } = shiftsData;

  renderShiftTable(dom.morningBody, morning?.agents || [], SHIFTS_ROSTER.morning, dom.morningTotal);
  renderShiftTable(dom.noonBody, noon?.agents || [], SHIFTS_ROSTER.noon, dom.noonTotal);
  renderShiftTable(dom.nightBody, night?.agents || [], SHIFTS_ROSTER.night, dom.nightTotal);
}

async function fetchData(startIso, endIso) {
  if (!startIso || !endIso) return;
  clearError();
  setLoading(true, `Fetching ${formatDateRange(startIso, endIso)}`);

  try {
    // Single API call for all data
    const url = `/api/team-performance?startDate=${encodeURIComponent(
      startIso
    )}&endDate=${encodeURIComponent(endIso)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) throw new Error(data?.error || "Failed to fetch data");

    // 1. Process Overview
    const overview = data.overview;
    agentsData = Array.isArray(overview?.agents)
      ? overview.agents.filter(
        (a) => a.agent_name && (a.agent_email || a.agent_name !== "Unknown")
      )
      : [];
    updateSummaryCards(overview?.totals || {}, overview?.total_agents);
    renderTable();

    // 2. Process Shifts
    if (data.shifts) {
      shiftsData = data.shifts;
      renderShifts();
    }

    // 3. Process Hourly
    if (data.hourly) {
      hourlyData = data.hourly;
      renderHourlyMatrix();
      document.getElementById("hourlySection").classList.remove("hidden");
    } else {
      document.getElementById("hourlySection").classList.add("hidden");
    }

    updateLastUpdated();
    lastRange = { startIso, endIso };
    if (dom.autoRefresh.checked) {
      setAutoRefresh(true);
    }
  } catch (err) {
    showError(err.message || "Unable to load data");
    console.error(err);
    agentsData = [];
    renderTable();
  } finally {
    setLoading(false);
  }
}

function formatDateRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleDateString()} -> ${end.toLocaleDateString()}`;
}

function handleQuickRange(hours) {
  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - hours * 60 * 60 * 1000);
  setInputsForRange(startUtc, endUtc);
  fetchData(startUtc.toISOString(), endUtc.toISOString());
}

function exportToCsv() {
  if (!agentsData.length) {
    showError("No data to export");
    return;
  }

  const headers = [
    "Agent",
    "Ticket Worked",
    "Email",
    "Closed",
    "Median Reply",
    "First Reply",
    "Rating",
    "Last Seen Date",
    "Last Seen Time",
    "Hours Active",
  ];

  const rows = agentsData.map((a) => {
    const lastSeen = formatLastSeen(a.last_seen_iso);
    return [
      a.agent_name,
      a.ticket_activity,
      a.agent_email,
      a.closed_tickets,
      a.median_reply_time,
      a.median_first_reply,
      a.average_rating,
      lastSeen.date,
      lastSeen.time,
      a.hours_active,
    ];
  });

  const csv = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))]
    .join("\n")
    .trim();

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-performance-${new Date()
    .toISOString()
    .split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  if (value == null) return "";
  const stringified = String(value).replace(/"/g, '""');
  return `"${stringified}"`;
}

function setAutoRefresh(enabled) {
  clearInterval(autoRefreshTimer);
  if (enabled && lastRange) {
    autoRefreshTimer = setInterval(() => {
      fetchData(lastRange.startIso, lastRange.endIso);
    }, FIVE_MINUTES_MS);
  }
}

function switchView(view) {
  currentView = view;
  dom.tabBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  if (view === "overview") {
    dom.overviewView.classList.remove("hidden");
    dom.shiftsView.classList.add("hidden");
  } else {
    dom.overviewView.classList.add("hidden");
    dom.shiftsView.classList.remove("hidden");
  }
}

function bindEvents() {
  dom.fetchBtn.addEventListener("click", () => {
    const range = getRangeFromInputs();
    if (range) {
      fetchData(range.startIso, range.endIso);
    }
  });

  document.querySelectorAll(".quick-actions button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hours = Number(btn.dataset.hours);
      if (!Number.isFinite(hours)) return;
      handleQuickRange(hours);
    });
  });

  document.querySelectorAll("th.sortable").forEach((th) => {
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

  dom.agentSearch.addEventListener("input", () => renderTable());
  document.getElementById("exportBtn").addEventListener("click", exportToCsv);
  dom.autoRefresh.addEventListener("change", (e) => {
    setAutoRefresh(e.target.checked);
  });

  dom.tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.view);
    });
  });
}

function init() {
  bindEvents();
  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - 60 * 60 * 1000);
  setInputsForRange(startUtc, endUtc);
  fetchData(startUtc.toISOString(), endUtc.toISOString());
}

document.addEventListener("DOMContentLoaded", init);

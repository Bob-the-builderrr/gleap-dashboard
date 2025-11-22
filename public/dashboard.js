// public/dashboard.js

const FIVE_MINUTES_MS = 5 * 60 * 1000;

let agentsData = [];
let sortKey = "ticket_activity";
let sortDir = "desc";
let lastRange = null;
let autoRefreshTimer = null;
let isLoading = false;

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
};

/**
 * Format a Date object into the yyyy-mm-ddThh:mm string
 * that <input type="datetime-local"> expects, using LOCAL time.
 */
function toIstInputValue(date) {
  // Note: despite the name, this now uses the browser's local timezone.
  const local = new Date(date);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  const h = String(local.getHours()).padStart(2, "0");
  const min = String(local.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

/**
 * Parse a user input date/time and convert it to a UTC ISO string.
 * Accepts:
 *  - "yyyy-mm-ddThh:mm" (from datetime-local)
 *  - "yyyy-mm-dd hh:mm"
 *  - "dd-mm-yyyy hh:mm"
 * If time is missing, uses 00:00 for start, 23:59 for end.
 * Uses LOCAL timezone automatically, then converts to UTC.
 */
function parseIstInput(value, isEndOfDay) {
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

  if (!timePart || timePart === "") {
    timePart = isEndOfDay ? "23:59" : "00:00";
  }

  let normalized;

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    // yyyy-mm-dd
    normalized = `${datePart}T${timePart}`;
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
    // dd-mm-yyyy
    const [day, month, year] = datePart.split("-").map(Number);
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
      throw new Error("Invalid date format. Use dd-mm-yyyy or yyyy-mm-dd.");
    }
    const y = String(year).padStart(4, "0");
    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    normalized = `${y}-${m}-${d}T${timePart}`;
  } else {
    throw new Error("Invalid date format. Use dd-mm-yyyy or yyyy-mm-dd.");
  }

  const date = new Date(normalized); // interpreted as LOCAL time
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid time format.");
  }

  if (isEndOfDay) {
    // Push to the end of the selected minute
    date.setSeconds(59, 999);
  }

  // Convert local time to UTC ISO string
  return date.toISOString();
}

function setInputsForRange(startUtc, endUtc) {
  dom.startInput.value = toIstInputValue(startUtc);
  dom.endInput.value = toIstInputValue(endUtc);
}

function getRangeFromInputs() {
  try {
    const startIso = parseIstInput(dom.startInput.value, false);
    const endIso = parseIstInput(dom.endInput.value, true);

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

  if (sorted.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td class="no-data" colspan="9">No data for this range</td>';
    tbody.appendChild(row);
    updateSortIndicators();
    return;
  }

  sorted.forEach((agent) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="number">${agent.ticket_activity ?? 0}</td>
      <td>
        <div class="agent">
          <div class="avatar ${agent.profile_image ? "" : "placeholder"}">
            ${
              agent.profile_image
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
      <td class="number">${agent.closed_tickets ?? 0}</td>
      <td><span class="chip time">${agent.median_reply_time}</span></td>
      <td><span class="chip time">${agent.median_first_reply}</span></td>
      <td><span class="chip time">${agent.median_assignment_reply}</span></td>
      <td><span class="chip time">${agent.time_to_last_close}</span></td>
      <td><span class="chip rating ${ratingClass(
        agent.rating_score
      )}">${agent.average_rating || "--"}</span></td>
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

async function fetchData(startIso, endIso) {
  if (!startIso || !endIso) return;
  clearError();
  setLoading(true, `Fetching ${formatDateRange(startIso, endIso)}`);

  try {
    const url = `/api/team-performance?startDate=${encodeURIComponent(
      startIso
    )}&endDate=${encodeURIComponent(endIso)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to fetch data");
    }

    agentsData = Array.isArray(data?.agents)
      ? data.agents.filter(
          (a) => a.agent_name && (a.agent_email || a.agent_name !== "Unknown")
        )
      : [];

    updateSummaryCards(data?.totals || {}, data?.total_agents);
    renderTable();
    updateLastUpdated();
    lastRange = { startIso, endIso };
    if (dom.autoRefresh.checked) {
      setAutoRefresh(true);
    }
  } catch (err) {
    showError(err.message || "Unable to load data");
    agentsData = [];
    renderTable();
  } finally {
    setLoading(false);
  }
}

function formatDateRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
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
    "Ticket Worked",
    "Agent",
    "Email",
    "Closed",
    "Median Reply",
    "First Reply",
    "Assign Reply",
    "Time To Last Close",
    "Rating",
    "Ticket Worked",
    "Hours Active",
  ];

  const rows = agentsData.map((a) => [
    a.ticket_activity,
    a.agent_name,
    a.agent_email,
    a.closed_tickets,
    a.median_reply_time,
    a.median_first_reply,
    a.median_assignment_reply,
    a.time_to_last_close,
    a.average_rating,
    a.ticket_activity,
    a.hours_active,
  ]);

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
}

function init() {
  bindEvents();
  // Default: load last 1 hour window (local-time inputs, UTC query)
  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - 60 * 60 * 1000);
  setInputsForRange(startUtc, endUtc);
  fetchData(startUtc.toISOString(), endUtc.toISOString());
}

document.addEventListener("DOMContentLoaded", init);

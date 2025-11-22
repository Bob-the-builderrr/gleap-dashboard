const IST_OFFSET_MIN = 330; // +05:30
const FIVE_MINUTES_MS = 5 * 60 * 1000;

let agentsData = [];
let sortKey = "total_tickets";
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

function looksLikeIsoWithTz(value) {
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
}

function toIstInputValue(date) {
  const istDate = new Date(date.getTime() + IST_OFFSET_MIN * 60000);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istDate.getUTCDate()).padStart(2, "0");
  const h = String(istDate.getUTCHours()).padStart(2, "0");
  const min = String(istDate.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function istToUtcIso(datePart, timePart, isEndOfDay) {
  const [year, month, day] = (datePart || "").split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid date");

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let ms = 0;

  if (timePart) {
    const [h, m = "0", sRaw = "0"] = timePart.split(":");
    hours = Number(h);
    minutes = Number(m);

    if (String(sRaw).includes(".")) {
      const [s, msRaw] = String(sRaw).split(".");
      seconds = Number(s);
      ms = Number(msRaw.padEnd(3, "0").slice(0, 3));
    } else {
      seconds = Number(sRaw);
    }
  } else if (isEndOfDay) {
    hours = 23;
    minutes = 59;
    seconds = 59;
    ms = 999;
  }

  if (
    [hours, minutes, seconds, ms].some((v) => Number.isNaN(v)) ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    throw new Error("Invalid time");
  }

  const utcMs =
    Date.UTC(year, month - 1, day, hours, minutes, seconds, ms) -
    IST_OFFSET_MIN * 60 * 1000;
  return new Date(utcMs).toISOString();
}

function normalizeToUtc(value, isEndOfDay) {
  const trimmed = (value || "").trim();
  if (!trimmed) throw new Error("Please select both start and end dates.");

  if (looksLikeIsoWithTz(trimmed)) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date format.");
    return parsed.toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return istToUtcIso(trimmed, null, isEndOfDay);
  }

  const [datePart, timePart] = trimmed.split(/[T\s]/).filter(Boolean);
  return istToUtcIso(datePart, timePart || null, isEndOfDay);
}

function setInputsForRange(startUtc, endUtc) {
  dom.startInput.value = toIstInputValue(startUtc);
  dom.endInput.value = toIstInputValue(endUtc);
}

function getRangeFromInputs() {
  try {
    const startIso = normalizeToUtc(dom.startInput.value, false);
    const endIso = normalizeToUtc(dom.endInput.value, true);

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
      '<td class="no-data" colspan="10">No data for this range</td>';
    tbody.appendChild(row);
    updateSortIndicators();
    return;
  }

  sorted.forEach((agent) => {
    const row = document.createElement("tr");
    row.innerHTML = `
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
      <td class="number">${agent.total_tickets ?? 0}</td>
      <td class="number">${agent.closed_tickets ?? 0}</td>
      <td><span class="chip time">${agent.median_reply_time}</span></td>
      <td><span class="chip time">${agent.median_first_reply}</span></td>
      <td><span class="chip time">${agent.median_assignment_reply}</span></td>
      <td><span class="chip time">${agent.time_to_last_close}</span></td>
      <td><span class="chip rating ${ratingClass(
        agent.rating_score
      )}">${agent.average_rating || "--"}</span></td>
      <td class="number">${agent.ticket_activity ?? 0}</td>
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
    "Agent",
    "Email",
    "Total Tickets",
    "Closed",
    "Median Reply",
    "First Reply",
    "Assign Reply",
    "Time To Last Close",
    "Rating",
    "Ticket Activity",
    "Hours Active",
  ];

  const rows = agentsData.map((a) => [
    a.agent_name,
    a.agent_email,
    a.total_tickets,
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
  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - 60 * 60 * 1000);
  setInputsForRange(startUtc, endUtc);

  bindEvents();
  fetchData(startUtc.toISOString(), endUtc.toISOString());
}

document.addEventListener("DOMContentLoaded", init);

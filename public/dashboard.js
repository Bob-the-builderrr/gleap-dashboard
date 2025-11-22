// public/dashboard.js
//
// Frontend logic for Team Performance Dashboard.
// - Computes default ranges (last 1h/2h/4h)
// - Converts datetime-local inputs to proper query params
// - Calls /api/team-performance
// - Updates summary cards and table with sortable columns

const API_URL = "/api/team-performance";

let agentsData = [];
let currentSortKey = "total_tickets";
let currentSortDir = "desc";

document.addEventListener("DOMContentLoaded", () => {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  const btnFetch = document.getElementById("fetchBtn");
  const btn1h = document.getElementById("btn1h");
  const btn2h = document.getElementById("btn2h");
  const btn4h = document.getElementById("btn4h");

  // Table header sorting
  document
    .querySelectorAll("th.sortable")
    .forEach((th) =>
      th.addEventListener("click", () => onHeaderClick(th.dataset.sortKey))
    );

  btnFetch.addEventListener("click", () => {
    const range = buildRangeFromInputs(startInput.value, endInput.value);
    if (!range) {
      showError("Please pick both start and end date-time before fetching.");
      return;
    }
    fetchAndRender(range.start, range.end, true);
  });

  btn1h.addEventListener("click", () => {
    const range = buildRelativeRangeHours(1);
    setInputsFromDateObjects(startInput, endInput, range.startDate, range.endDate);
    fetchAndRender(range.start, range.end, true);
  });

  btn2h.addEventListener("click", () => {
    const range = buildRelativeRangeHours(2);
    setInputsFromDateObjects(startInput, endInput, range.startDate, range.endDate);
    fetchAndRender(range.start, range.end, true);
  });

  btn4h.addEventListener("click", () => {
    const range = buildRelativeRangeHours(4);
    setInputsFromDateObjects(startInput, endInput, range.startDate, range.endDate);
    fetchAndRender(range.start, range.end, true);
  });

  // On initial load: last 1 hour
  const initialRange = buildRelativeRangeHours(1);
  setInputsFromDateObjects(
    startInput,
    endInput,
    initialRange.startDate,
    initialRange.endDate
  );
  fetchAndRender(initialRange.start, initialRange.end, false);
});

function onHeaderClick(sortKey) {
  if (!sortKey) return;
  if (currentSortKey === sortKey) {
    currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
  } else {
    currentSortKey = sortKey;
    currentSortDir = "desc";
  }
  renderTable();
}

/**
 * Convert datetime-local input values into query params for the API.
 *
 * - If value length is 10 (yyyy-mm-dd) treat as plain date and pass as-is.
 * - If includes time, convert from local time to UTC ISO string.
 */
function buildRangeFromInputs(startVal, endVal) {
  const s = (startVal || "").trim();
  const e = (endVal || "").trim();
  if (!s || !e) return null;

  const isDateOnlyS = s.length === 10;
  const isDateOnlyE = e.length === 10;

  let startOut = s;
  let endOut = e;

  if (!isDateOnlyS) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    startOut = d.toISOString();
  }

  if (!isDateOnlyE) {
    const d = new Date(e);
    if (Number.isNaN(d.getTime())) return null;
    endOut = d.toISOString();
  }

  return { start: startOut, end: endOut };
}

/**
 * Build a relative range of N hours back from "now".
 */
function buildRelativeRangeHours(hours) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

  return {
    startDate,
    endDate,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

/**
 * Set datetime-local inputs from Date objects.
 */
function setInputsFromDateObjects(startInput, endInput, startDate, endDate) {
  if (startInput) startInput.value = toLocalInputValue(startDate);
  if (endInput) endInput.value = toLocalInputValue(endDate);
}

function toLocalInputValue(date) {
  if (!(date instanceof Date)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${mi}`;
}

/**
 * Main fetch function.
 */
async function fetchAndRender(startParam, endParam, showNotifications) {
  clearError();
  setLoading(true);

  try {
    const url = `${API_URL}?startDate=${encodeURIComponent(
      startParam
    )}&endDate=${encodeURIComponent(endParam)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      if (showNotifications) {
        showError(
          `API returned ${res.status}. Check Gleap token / project or try again.`
        );
      }
      console.error("API error:", res.status, text);
      agentsData = [];
      updateSummary(null);
      renderTable();
      return;
    }

    const json = await res.json();
    agentsData = Array.isArray(json.agents) ? json.agents : [];
    updateSummary(json);
    renderTable();
    updateMeta(json);
  } catch (err) {
    console.error("Fetch failed", err);
    if (showNotifications) {
      showError("Failed to load data. Check your connection and try again.");
    }
    agentsData = [];
    updateSummary(null);
    renderTable();
  } finally {
    setLoading(false);
  }
}

/**
 * Summary cards.
 */
function updateSummary(payload) {
  const totalTickets = document.getElementById("totalTickets");
  const avgRating = document.getElementById("avgRating");
  const activeAgents = document.getElementById("activeAgents");
  const avgHoursActive = document.getElementById("avgHoursActive");

  if (!payload) {
    totalTickets.textContent = "-";
    avgRating.textContent = "-";
    activeAgents.textContent = "-";
    avgHoursActive.textContent = "-";
    return;
  }

  const totals = payload.totals || {};
  const total = Number(totals.total_tickets || 0);
  const rating = totals.avg_rating;
  const active = Number(payload.total_agents || 0);
  const hoursActive = totals.avg_hours_active;

  totalTickets.textContent = formatNumber(total);
  avgRating.textContent =
    rating == null || Number.isNaN(rating) ? "-" : `${rating.toFixed(1)}`;
  activeAgents.textContent = formatNumber(active);
  avgHoursActive.textContent =
    hoursActive == null || Number.isNaN(hoursActive)
      ? "-"
      : `${hoursActive.toFixed(1)}h`;
}

/**
 * Update meta labels under the controls.
 */
function updateMeta(payload) {
  const rangeLabel = document.getElementById("dateRangeLabel");
  const lastUpdated = document.getElementById("lastUpdated");

  if (!payload || !payload.date_range) {
    rangeLabel.textContent = "";
    lastUpdated.textContent = "";
    return;
  }

  const start = payload.date_range.start;
  const end = payload.date_range.end;

  const from = formatDateTimeRangePart(start);
  const to = formatDateTimeRangePart(end);

  rangeLabel.textContent = `Range: ${from} → ${to}`;
  lastUpdated.textContent = `Last updated: ${formatDateTimeRangePart(
    payload.timestamp || new Date().toISOString()
  )}`;
}

/**
 * Render the table body with current sort state.
 */
function renderTable() {
  const tbody = document.getElementById("agentsTableBody");
  const noDataRow = document.getElementById("noDataRow");

  if (!Array.isArray(agentsData) || agentsData.length === 0) {
    tbody.innerHTML = "";
    if (noDataRow) {
      tbody.appendChild(noDataRow);
      noDataRow.hidden = false;
    }
    resetSortIndicators();
    return;
  }

  // Compute max tickets to shade rows
  const maxTickets = agentsData.reduce(
    (m, a) => Math.max(m, Number(a.total_tickets || 0)),
    0
  );

  // Sorting
  const sorted = [...agentsData].sort((a, b) => {
    const dir = currentSortDir === "asc" ? 1 : -1;
    const av = valueForSort(a, currentSortKey);
    const bv = valueForSort(b, currentSortKey);

    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    const diff = av - bv;
    if (diff !== 0) return diff * dir;

    // secondary sort: by agent name
    return String(a.agent_name || "").localeCompare(
      String(b.agent_name || "")
    );
  });

  resetSortIndicators();
  updateSortIndicator();

  tbody.innerHTML = "";

  for (const agent of sorted) {
    const tr = document.createElement("tr");

    // Intensity class by tickets
    const ticketCount = Number(agent.total_tickets || 0);
    if (maxTickets > 0 && ticketCount > 0) {
      const ratio = ticketCount / maxTickets;
      if (ratio >= 0.7) {
        tr.classList.add("row-high");
      } else if (ratio >= 0.35) {
        tr.classList.add("row-mid");
      } else {
        tr.classList.add("row-low");
      }
    }

    const agentCell = document.createElement("td");
    agentCell.classList.add("agent-cell");

    const avatar = document.createElement("div");
    const imgUrl = agent.profile_image || "";
    if (imgUrl) {
      avatar.className = "avatar";
      avatar.style.backgroundImage = `url("${escapeHtmlAttr(imgUrl)}")`;
    } else {
      avatar.className = "avatar placeholder";
      avatar.textContent = initials(agent.agent_name);
    }

    const meta = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "agent-name";
    nameEl.textContent = agent.agent_name || "Unknown";

    const emailMobile = document.createElement("div");
    emailMobile.className = "agent-email-mobile";
    emailMobile.textContent = agent.agent_email || "";

    meta.appendChild(nameEl);
    meta.appendChild(emailMobile);

    agentCell.appendChild(avatar);
    agentCell.appendChild(meta);

    const emailCell = tdText(agent.agent_email || "");

    const totalTicketsCell = tdText(
      formatNumber(agent.total_tickets || 0)
    );
    const closedCell = tdText(formatNumber(agent.closed_tickets || 0));

    const medianReplyCell = tdText(agent.median_reply_time || "--");
    const firstReplyCell = tdText(agent.first_reply_time || "--");
    const assignReplyCell = tdText(agent.assign_reply_time || "--");
    const timeToCloseCell = tdText(agent.time_to_last_close || "--");

    const ratingDisplay =
      agent.rating_display ||
      (agent.rating_score != null
        ? `${agent.rating_score.toFixed(1)}`
        : "--");
    const ratingCell = tdText(ratingDisplay);

    const ticketActivityCell = tdText(
      formatNumber(agent.ticket_activity || 0)
    );

    const hoursActiveCell = tdText(agent.hours_active || "--");

    tr.appendChild(agentCell);
    tr.appendChild(emailCell);
    tr.appendChild(totalTicketsCell);
    tr.appendChild(closedCell);
    tr.appendChild(medianReplyCell);
    tr.appendChild(firstReplyCell);
    tr.appendChild(assignReplyCell);
    tr.appendChild(timeToCloseCell);
    tr.appendChild(ratingCell);
    tr.appendChild(ticketActivityCell);
    tr.appendChild(hoursActiveCell);

    tbody.appendChild(tr);
  }
}

/**
 * Pick a numeric value for sorting keys.
 */
function valueForSort(agent, key) {
  switch (key) {
    case "total_tickets":
      return Number(agent.total_tickets || 0);
    case "closed_tickets":
      return Number(agent.closed_tickets || 0);
    case "rating_score":
      return agent.rating_score == null
        ? null
        : Number(agent.rating_score);
    case "ticket_activity":
      return Number(agent.ticket_activity || 0);
    default:
      return null;
  }
}

function resetSortIndicators() {
  document.querySelectorAll(".sort-indicator").forEach((el) => {
    el.textContent = "";
  });
}

function updateSortIndicator() {
  const th = document.querySelector(
    `th.sortable[data-sort-key="${currentSortKey}"]`
  );
  if (!th) return;
  const span = th.querySelector(".sort-indicator");
  if (!span) return;
  span.textContent = currentSortDir === "asc" ? "▲" : "▼";
}

/**
 * Helpers
 */

function setLoading(isLoading) {
  const btn = document.getElementById("fetchBtn");
  const label = document.getElementById("fetchLabel");
  const spinner = document.getElementById("fetchSpinner");
  if (!btn || !label || !spinner) return;

  btn.disabled = isLoading;
  spinner.hidden = !isLoading;
  label.textContent = isLoading ? "Loading..." : "Fetch data";
}

function showError(message) {
  const box = document.getElementById("errorBox");
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

function clearError() {
  const box = document.getElementById("errorBox");
  if (!box) return;
  box.textContent = "";
  box.hidden = true;
}

function tdText(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function formatNumber(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return "0";
  if (num >= 1000) {
    return num.toLocaleString("en-IN");
  }
  return String(num);
}

function formatDateTimeRangePart(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleString("en-GB", {
    year: "2-digit",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtmlAttr(str) {
  return String(str || "").replace(/[&"'<>]/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return c;
    }
  });
}

function initials(name) {
  if (!name) return "?";
  const parts = String(name).split(/\s+/);
  const first = parts[0] || "";
  const last = parts[1] || "";
  const chars = (first[0] || "") + (last[0] || "");
  return chars.toUpperCase() || "?";
}

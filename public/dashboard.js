let agents = [];
let currentSortKey = "total_tickets";
let currentSortDir = "desc"; // "asc" or "desc"

// Build UTC range based on IST date and optional time
// If times are empty -> full 24 hours for those dates in IST.
function buildUtcRangeFromInputs() {
  const startDate = document.getElementById("startDate").value;
  const endDateRaw = document.getElementById("endDate").value;
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;

  if (!startDate) {
    alert("Please select at least a start date");
    return null;
  }

  const endDate = endDateRaw || startDate;

  // Helper to make ISO using explicit IST offset
  const toIsoIst = (dateStr, timeStrMs) => {
    // timeStrMs is something like "00:00:00.000" or "23:59:59.999"
    const iso = new Date(`${dateStr}T${timeStrMs}+05:30`).toISOString();
    return iso;
  };

  let startUtc;
  let endUtc;

  if (startTime && endTime) {
    // Use explicit time window on those dates, interpreted as IST
    startUtc = toIsoIst(startDate, `${startTime}:00.000`);
    endUtc = toIsoIst(endDate, `${endTime}:59.999`);
  } else {
    // Full 24h range
    startUtc = toIsoIst(startDate, "00:00:00.000");
    endUtc = toIsoIst(endDate, "23:59:59.999");
  }

  // Ensure correct ordering
  if (new Date(startUtc) > new Date(endUtc)) {
    alert("Start must be before end");
    return null;
  }

  return { startUtc, endUtc };
}

async function fetchData(startUtc, endUtc) {
  const url = `/api/team-performance?startDate=${encodeURIComponent(
    startUtc
  )}&endDate=${encodeURIComponent(endUtc)}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error("API error:", data);
    alert("Failed to fetch data");
    return;
  }

  agents = data.agents || [];
  updateSummary(data.totals || {});
  updateRangeLabel(data.date_range);
  renderTable();
}

// Summary cards
function updateSummary(totals) {
  document.getElementById("totalTickets").textContent =
    totals.total_tickets != null ? totals.total_tickets : "--";

  const avg = totals.average_rating;
  document.getElementById("averageRating").textContent =
    avg != null && !isNaN(avg) ? avg.toFixed(1) : "--";

  document.getElementById("totalAgents").textContent =
    totals.total_agents != null ? totals.total_agents : "--";
}

// Show applied range
function updateRangeLabel(range) {
  if (!range || !range.start || !range.end) {
    document.getElementById("rangeLabel").textContent = "";
    return;
  }

  const start = new Date(range.start);
  const end = new Date(range.end);

  const fmt = (d) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate()
    ).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes()
    ).padStart(2, "0")} UTC`;

  document.getElementById("rangeLabel").textContent =
    "Showing data from " + fmt(start) + " to " + fmt(end);
}

// Sorting
function sortAgents() {
  const key = currentSortKey;
  const dir = currentSortDir === "asc" ? 1 : -1;

  return [...agents].sort((a, b) => {
    const aVal = a[key] ?? 0;
    const bVal = b[key] ?? 0;

    if (typeof aVal === "number" && typeof bVal === "number") {
      if (aVal === bVal) return 0;
      return aVal > bVal ? dir : -dir;
    }

    const aStr = String(aVal);
    const bStr = String(bVal);
    return aStr.localeCompare(bStr) * dir;
  });
}

function renderTable() {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  const sorted = sortAgents();

  sorted.forEach((agent) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${agent.agent_name}</td>
      <td>${agent.total_tickets}</td>
      <td>${agent.closed_tickets}</td>
      <td>${agent.median_reply_time}</td>
      <td>${agent.median_first_reply}</td>
      <td>${agent.median_assignment_reply}</td>
      <td>${agent.time_to_last_close}</td>
      <td>${agent.average_rating}</td>
      <td>${agent.ticket_activity}</td>
      <td>${agent.hours_active}</td>
    `;
    tbody.appendChild(row);
  });
}

// Header click sorting
function setupSorting() {
  const headers = document.querySelectorAll("th.sortable");
  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort-key");
      if (!key) return;

      if (currentSortKey === key) {
        currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
      } else {
        currentSortKey = key;
        currentSortDir = "desc";
      }

      headers.forEach((h) => {
        h.classList.remove("sorted-asc", "sorted-desc");
      });
      th.classList.add(currentSortDir === "asc" ? "sorted-asc" : "sorted-desc");

      renderTable();
    });
  });
}

// Quick range buttons: last X hours relative to now
function setupQuickRanges() {
  document.querySelectorAll(".quick-row .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hours = Number(btn.dataset.hours || "1");
      const end = new Date();
      const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

      fetchData(start.toISOString(), end.toISOString());
    });
  });
}

// Manual fetch button
function setupFetchButton() {
  document.getElementById("fetchBtn").addEventListener("click", () => {
    const range = buildUtcRangeFromInputs();
    if (!range) return;
    fetchData(range.startUtc, range.endUtc);
  });
}

// Initial defaults
function initDefaults() {
  // Pre-fill date inputs with today in IST
  const now = new Date();
  // Create a date in IST using fixed offset
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const yy = istNow.getFullYear();
  const mm = String(istNow.getMonth() + 1).padStart(2, "0");
  const dd = String(istNow.getDate()).padStart(2, "0");
  const todayStr = `${yy}-${mm}-${dd}`;

  document.getElementById("startDate").value = todayStr;
  document.getElementById("endDate").value = todayStr;
}

// On page load: set up and fetch last 1 hour (top agents by ticket count)
window.addEventListener("load", () => {
  initDefaults();
  setupSorting();
  setupQuickRanges();
  setupFetchButton();

  const end = new Date();
  const start = new Date(end.getTime() - 1 * 60 * 60 * 1000);
  fetchData(start.toISOString(), end.toISOString());
});

// dashboard.js

let agents = [];
let currentSortKey = "total_tickets";
let currentSortDir = "desc";

// Convert IST date+time to UTC ISO
function istDateTimeToUtcIso(dateStr, timeStr, isEnd) {
  if (!dateStr) return null;

  const [y, m, d] = dateStr.split("-").map(Number);

  let hh = 0;
  let mm = 0;
  let ss = 0;
  let ms = 0;

  if (timeStr && timeStr.includes(":")) {
    const [th, tm] = timeStr.split(":").map(Number);
    hh = th;
    mm = tm;
  } else {
    if (isEnd) {
      hh = 23;
      mm = 59;
      ss = 59;
      ms = 999;
    }
  }

  // Build timestamp as IST, then subtract 5.5 hours to get UTC
  const istMs = Date.UTC(y, m - 1, d, hh, mm, ss, ms);
  const utcMs = istMs - 5.5 * 60 * 60 * 1000;

  return new Date(utcMs).toISOString();
}

function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;
  overlay.classList.toggle("hidden", !show);
}

async function fetchData(startUtcIso, endUtcIso) {
  if (!startUtcIso || !endUtcIso) return;
  showLoading(true);
  try {
    const url =
      "/api/team-performance" +
      `?startDate=${encodeURIComponent(startUtcIso)}` +
      `&endDate=${encodeURIComponent(endUtcIso)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.error("API error:", data);
      alert("Failed to fetch data from API");
      return;
    }

    agents = Array.isArray(data.agents) ? data.agents : [];

    if (!data.totals) {
      data.totals = { total_agents: 0, total_tickets: 0, avg_rating: 0 };
    }

    updateSummary(data.totals);
    renderTable();
  } catch (err) {
    console.error("Fetch error:", err);
    alert("Error fetching data");
  } finally {
    showLoading(false);
  }
}

function updateSummary(totals) {
  document.getElementById("totalTickets").textContent =
    totals.total_tickets || 0;
  document.getElementById("avgRating").textContent =
    (totals.avg_rating || 0).toFixed(1);
  document.getElementById("totalAgents").textContent =
    totals.total_agents || 0;
}

function renderTable() {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  const sorted = [...agents].sort((a, b) => {
    const key = currentSortKey;
    const dir = currentSortDir === "asc" ? 1 : -1;

    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;

    if (typeof av === "number" && typeof bv === "number") {
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    }

    const as = String(av);
    const bs = String(bv);
    if (as === bs) return 0;
    return as > bs ? dir : -dir;
  });

  sorted.forEach((agent) => {
    const name = agent.agent_name || "Unknown";
    const email = agent.agent_email || "";
    const avatarUrl = agent.profile_image || "";

    const initials = name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <div class="agent-cell">
          <div class="agent-avatar">
            ${
              avatarUrl
                ? `<img src="${avatarUrl}" alt="${name}"/>`
                : `<span>${initials}</span>`
            }
          </div>
          <div>
            <div class="agent-name">${name}</div>
            <div class="agent-email">${email}</div>
          </div>
        </div>
      </td>
      <td>${agent.total_tickets ?? 0}</td>
      <td>${agent.closed_tickets ?? 0}</td>
      <td>${agent.median_reply_time ?? "--"}</td>
      <td>${agent.median_first_reply ?? "--"}</td>
      <td>${agent.time_to_last_close ?? "--"}</td>
      <td>${agent.average_rating ?? "--"}</td>
      <td>${agent.ticket_activity ?? 0}</td>
      <td>${agent.hours_active ?? "--"}</td>
    `;

    tbody.appendChild(row);
  });
}

// Sorting handlers
document.querySelectorAll("th[data-sort-key]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-sort-key");
    if (!key) return;

    if (currentSortKey === key) {
      currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
    } else {
      currentSortKey = key;
      currentSortDir = "desc";
    }
    renderTable();
  });
});

// Manual fetch button
document.getElementById("fetchBtn").addEventListener("click", () => {
  const startDate = document.getElementById("startDate").value;
  const startTime = document.getElementById("startTime").value;
  const endDate = document.getElementById("endDate").value;
  const endTime = document.getElementById("endTime").value;

  if (!startDate || !endDate) {
    alert("Please select start and end dates");
    return;
  }

  const startUtc = istDateTimeToUtcIso(startDate, startTime, false);
  const endUtc = istDateTimeToUtcIso(endDate, endTime, true);

  fetchData(startUtc, endUtc);
});

// Quick range buttons: last X hours from now (real time)
document.querySelectorAll(".quick-range button[data-hours]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const hours = Number(btn.getAttribute("data-hours") || "1");
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    fetchData(start.toISOString(), end.toISOString());
  });
});

// On load: show last 1 hour, top performer by tickets
window.addEventListener("load", () => {
  currentSortKey = "total_tickets";
  currentSortDir = "desc";

  const end = new Date();
  const start = new Date(end.getTime() - 1 * 60 * 60 * 1000);
  fetchData(start.toISOString(), end.toISOString());
});

const IST_OFFSET_MIN = 330; // +5:30

let agentsData = [];
let currentSortKey = "total_tickets";
let currentSortDir = "desc";

// Convert IST date+time to UTC ISO string
function istToUtcIso(dateStr, timeStr, isEndOfDay) {
  if (!dateStr) return null;

  const [year, month, day] = dateStr.split("-").map(Number);

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let ms = 0;

  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    hours = h;
    minutes = m;
  } else if (isEndOfDay) {
    hours = 23;
    minutes = 59;
    seconds = 59;
    ms = 999;
  }

  // Build a Date as if this is IST wall time, then subtract offset to get UTC
  const asUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms));
  const utcMs = asUtc.getTime() - IST_OFFSET_MIN * 60 * 1000;
  return new Date(utcMs).toISOString();
}

function showLoading(on) {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;
  overlay.classList.toggle("hidden", !on);
}

async function fetchData(startIso, endIso) {
  try {
    showLoading(true);
    const url = `${window.location.origin}/api/team-performance?startDate=${encodeURIComponent(
      startIso
    )}&endDate=${encodeURIComponent(endIso)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data || data.error) {
      console.error("API error:", data);
      alert("Failed to fetch team performance data");
      return;
    }

    agentsData = data.agents || [];
    updateSummary(data.totals || {});
    sortAndRender();
  } catch (err) {
    console.error("Frontend fetch error:", err);
    alert("Error loading data");
  } finally {
    showLoading(false);
  }
}

function updateSummary(totals) {
  document.getElementById("totalTicketsValue").textContent =
    totals.total_tickets ?? "--";
  const avg = typeof totals.avg_rating === "number" ? totals.avg_rating.toFixed(1) : "--";
  document.getElementById("averageRatingValue").textContent = avg;
  document.getElementById("totalAgentsValue").textContent =
    totals.total_agents ?? "--";
}

function sortAndRender() {
  const key = currentSortKey;
  const dir = currentSortDir === "asc" ? 1 : -1;

  const sorted = [...agentsData].sort((a, b) => {
    const va = a[key];
    const vb = b[key];

    if (key === "agent_name") {
      return String(va).localeCompare(String(vb)) * dir;
    }

    const na = Number(va);
    const nb = Number(vb);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na === nb) return 0;
      return na > nb ? dir : -dir;
    }

    // Fallback string compare
    return String(va).localeCompare(String(vb)) * dir;
  });

  renderTable(sorted);
  updateSortIndicators();
}

function renderTable(agents) {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  agents.forEach(a => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="agent-cell">
          <div class="agent-avatar">
            ${
              a.profile_image
                ? `<img src="${a.profile_image}" alt="${a.agent_name}" />`
                : ""
            }
          </div>
          <div class="agent-meta">
            <span class="agent-name">${a.agent_name}</span>
            <span class="agent-email">${a.agent_email || ""}</span>
          </div>
        </div>
      </td>
      <td>${a.total_tickets}</td>
      <td>${a.closed_tickets}</td>
      <td>${a.median_reply_time}</td>
      <td>${a.median_first_reply}</td>
      <td>${a.median_assignment_reply}</td>
      <td>${a.time_to_last_close}</td>
      <td>${a.average_rating}</td>
      <td>${a.ticket_activity}</td>
      <td>${a.hours_active}</td>
    `;
    tbody.appendChild(row);
  });
}

function updateSortIndicators() {
  document.querySelectorAll("th.sortable").forEach(th => {
    const key = th.getAttribute("data-sort");
    if (key === currentSortKey) {
      th.classList.add("active");
      th.textContent = th.textContent.replace("⇅", "");
    } else {
      th.classList.remove("active");
    }
  });
}

// Event: manual Fetch Data
document.getElementById("fetchBtn").addEventListener("click", () => {
  const startDate = document.getElementById("startDate").value;
  const startTime = document.getElementById("startTime").value;
  const endDate = document.getElementById("endDate").value;
  const endTime = document.getElementById("endTime").value;

  if (!startDate || !endDate) {
    alert("Please select both start and end dates");
    return;
  }

  const startIso = istToUtcIso(startDate, startTime || "00:00", false);
  const endIso = istToUtcIso(endDate, endTime || null, true);

  fetchData(startIso, endIso);
});

// Event: quick last N hours
document.querySelectorAll(".quick-buttons button").forEach(btn => {
  btn.addEventListener("click", () => {
    const hours = parseInt(btn.dataset.hours, 10);
    const endUtc = new Date();
    const startUtc = new Date(endUtc.getTime() - hours * 60 * 60 * 1000);

    fetchData(startUtc.toISOString(), endUtc.toISOString());
  });
});

// Event: table header sorting
document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-sort");
    if (!key) return;

    if (currentSortKey === key) {
      currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
    } else {
      currentSortKey = key;
      currentSortDir = "desc";
    }

    sortAndRender();
  });
});

// Default: last 1 hour, sorted by total_tickets desc
window.addEventListener("load", () => {
  // Pre-fill dates with today as a quality of life thing
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  document.getElementById("startDate").value = `${yyyy}-${mm}-${dd}`;
  document.getElementById("endDate").value = `${yyyy}-${mm}-${dd}`;

  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - 1 * 60 * 60 * 1000);
  fetchData(startUtc.toISOString(), endUtc.toISOString());
});

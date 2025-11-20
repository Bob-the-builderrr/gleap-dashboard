// API endpoint
const API_URL = "https://gleap-dashboard.vercel.app/api/agents";

let tickets = [];
let currentSortKey = "Agent_Open_Ticket";
let currentSortDir = "desc";

// Convert "2 hours 7 minutes", "19 minutes", "1 days 3 hours" to minutes
function durationToMinutes(str) {
  if (!str || typeof str !== "string") return 0;

  const lower = str.toLowerCase();
  let days = 0;
  let hours = 0;
  let minutes = 0;

  const dayMatch = lower.match(/(\d+)\s*day/);
  const hourMatch = lower.match(/(\d+)\s*hour/);
  const minMatch = lower.match(/(\d+)\s*minute/);

  if (dayMatch) days = parseInt(dayMatch[1], 10);
  if (hourMatch) hours = parseInt(hourMatch[1], 10);
  if (minMatch) minutes = parseInt(minMatch[1], 10);

  return days * 24 * 60 + hours * 60 + minutes;
}

function isBreached(row) {
  const v = row.SLA_Breached;
  return v === true || v === "true" || v === "TRUE";
}

// Normalize row so we never get undefined in UI
function normalizeRow(r) {
  return {
    Ticket_ID: r.Ticket_ID ?? "",
    Agent_Name: r.Agent_Name ?? "",
    Agent_Open_Ticket: Number(r.Agent_Open_Ticket ?? 0),
    Ticket_Status: r.Ticket_Status ?? "",
    Ticket_Type: r.Ticket_Type ?? "",
    Priority: r.Priority ?? "",
    Plan_Type: r.Plan_Type ?? "",
    User_Email: r.User_Email ?? "",
    User_Name: r.User_Name ?? "",
    Updated_At: r.Updated_At ?? "",
    SLA_Breached: r.SLA_Breached ?? "",
    Has_Agent_Reply: r.Has_Agent_Reply ?? "",
    Tags: r.Tags ?? "",
    Latest_Comment_Created_At: r.Latest_Comment_Created_At ?? "",
    Time_Open_Duration: r.Time_Open_Duration ?? "",
    refreshed_at: r.refreshed_at ?? ""
  };
}

// Stats rendering

function renderStats() {
  const totalEl = document.getElementById("totalTickets");
  const totalNoteEl = document.getElementById("totalTicketsNote");
  const agentsEl = document.getElementById("agentsWithTickets");
  const slaEl = document.getElementById("slaBreachedCount");
  const avgEl = document.getElementById("avgAge");
  const lastRefreshedEl = document.getElementById("lastRefreshed");

  const openTickets = tickets.length;

  const agents = new Set(
    tickets
      .map(t => t.Agent_Name)
      .filter(name => name && name !== "UNASSIGNED")
  );

  const slaCount = tickets.filter(isBreached).length;

  const durations = tickets.map(t => durationToMinutes(t.Time_Open_Duration));
  const avgMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  totalEl.textContent = openTickets;
  totalNoteEl.textContent = `Across ${agents.size || 0} active agent(s)`;

  agentsEl.textContent = agents.size;
  slaEl.textContent = slaCount;
  avgEl.textContent =
    avgMinutes < 60
      ? `${avgMinutes} m`
      : `${Math.floor(avgMinutes / 60)} h ${avgMinutes % 60} m`;

  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata"
  });
  lastRefreshedEl.textContent = `Last refreshed: ${now}`;
}

// Plan breakdown rendering

function renderPlans() {
  const container = document.getElementById("planBreakdown");
  container.innerHTML = "";

  const counts = {};
  tickets.forEach(t => {
    const key = t.Plan_Type || "UNKNOWN_PLAN";
    counts[key] = (counts[key] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  entries.forEach(([plan, count]) => {
    const chip = document.createElement("div");
    chip.className = "plan-chip";

    const label = document.createElement("span");
    label.className = "plan-chip-label";
    label.textContent = plan;

    const countSpan = document.createElement("span");
    countSpan.className = "plan-chip-count";
    countSpan.textContent = count;

    chip.appendChild(label);
    chip.appendChild(countSpan);

    container.appendChild(chip);
  });
}

// Table rendering

function clearSortIndicators() {
  document
    .querySelectorAll("#ticketTable thead th")
    .forEach(th => th.classList.remove("sorted-asc", "sorted-desc"));
}

function applySortIndicator() {
  const th = document.querySelector(
    `#ticketTable thead th[data-sort="${currentSortKey}"]`
  );
  if (!th) return;
  th.classList.add(
    currentSortDir === "asc" ? "sorted-asc" : "sorted-desc"
  );
}

function sortTickets() {
  tickets.sort((a, b) => {
    const av = a[currentSortKey];
    const bv = b[currentSortKey];

    // Special case: age
    if (currentSortKey === "Time_Open_Duration") {
      const am = durationToMinutes(av);
      const bm = durationToMinutes(bv);
      return currentSortDir === "asc" ? am - bm : bm - am;
    }

    // Numeric
    if (
      currentSortKey === "Agent_Open_Ticket"
    ) {
      const an = Number(av || 0);
      const bn = Number(bv || 0);
      return currentSortDir === "asc" ? an - bn : bn - an;
    }

    // String compare
    const as = (av ?? "").toString().toLowerCase();
    const bs = (bv ?? "").toString().toLowerCase();

    if (as < bs) return currentSortDir === "asc" ? -1 : 1;
    if (as > bs) return currentSortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function renderTable() {
  const tbody = document.getElementById("ticketRows");
  tbody.innerHTML = "";

  tickets.forEach(t => {
    const minutes = durationToMinutes(t.Time_Open_Duration);
    const breached = isBreached(t);

    const tr = document.createElement("tr");

    if (minutes > 45) {
      tr.classList.add("row-critical");
    }
    if (breached) {
      tr.classList.add("row-breached");
    }

    // Agent
    const tdAgent = document.createElement("td");
    tdAgent.textContent = t.Agent_Name || "UNASSIGNED";
    tr.appendChild(tdAgent);

    // Open tickets (right aligned)
    const tdOpen = document.createElement("td");
    tdOpen.className = "text-right";
    tdOpen.textContent = t.Agent_Open_Ticket;
    tr.appendChild(tdOpen);

    // Priority badge
    const tdPriority = document.createElement("td");
    const priority = (t.Priority || "").toUpperCase();
    const priSpan = document.createElement("span");
    priSpan.classList.add("badge");

    if (priority === "HIGH") {
      priSpan.classList.add("badge-priority-high");
    } else if (priority === "MEDIUM") {
      priSpan.classList.add("badge-priority-medium");
    } else if (priority === "LOW") {
      priSpan.classList.add("badge-priority-low");
    } else {
      priSpan.classList.add("badge-priority-medium");
    }

    priSpan.textContent = priority || "NA";
    tdPriority.appendChild(priSpan);
    tr.appendChild(tdPriority);

    // Status
    const tdStatus = document.createElement("td");
    const status = (t.Ticket_Status || "").toUpperCase();
    const statusSpan = document.createElement("span");
    statusSpan.classList.add("badge");
    if (status === "OPEN") {
      statusSpan.classList.add("badge-status-open");
    } else {
      statusSpan.classList.add("badge-status-other");
    }
    statusSpan.textContent = status || "NA";
    tdStatus.appendChild(statusSpan);
    tr.appendChild(tdStatus);

    // Age
    const tdAge = document.createElement("td");
    tdAge.textContent = t.Time_Open_Duration || "";
    tr.appendChild(tdAge);

    // User email
    const tdEmail = document.createElement("td");
    tdEmail.textContent = t.User_Email || "";
    tr.appendChild(tdEmail);

    // Plan
    const tdPlan = document.createElement("td");
    tdPlan.textContent = t.Plan_Type || "";
    tr.appendChild(tdPlan);

    // Tags
    const tdTags = document.createElement("td");
    tdTags.textContent = t.Tags || "";
    tr.appendChild(tdTags);

    tbody.appendChild(tr);
  });
}

// Sorting handlers

function attachSortHandlers() {
  const headers = document.querySelectorAll("#ticketTable thead th[data-sort]");
  headers.forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      if (!key) return;

      if (currentSortKey === key) {
        currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
      } else {
        currentSortKey = key;
        currentSortDir = key === "Agent_Open_Ticket" ? "desc" : "asc";
      }

      clearSortIndicators();
      sortTickets();
      renderTable();
      applySortIndicator();
    });
  });
}

// Main load

async function load() {
  try {
    const res = await fetch(API_URL);
    const raw = await res.json();

    // Normalize and pre sort by open tickets desc
    tickets = raw.map(normalizeRow);
    currentSortKey = "Agent_Open_Ticket";
    currentSortDir = "desc";

    sortTickets();
    renderStats();
    renderPlans();
    renderTable();
    clearSortIndicators();
    applySortIndicator();
    attachSortHandlers();
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    const tbody = document.getElementById("ticketRows");
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-muted">Error loading data</td></tr>';
  }
}

load();

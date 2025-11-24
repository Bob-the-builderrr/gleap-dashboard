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
  // Updated IDs for Archived View
  archivedStart: document.getElementById("archivedStart"),
  archivedEnd: document.getElementById("archivedEnd"),
  archivedFetchBtn: document.getElementById("archivedFetchBtn"),
  archivedSearch: document.getElementById("archivedSearch"),
  archivedMatrixHeader: document.getElementById("archivedMatrixHeader"),
  archivedMatrixBody: document.getElementById("archivedMatrixBody"),
  ticketModal: document.getElementById("ticketModal"),
  modalContent: document.getElementById("modalContent"),
  modalTitle: document.getElementById("modalTitle")
};

// State
let agentsData = [];
let shiftsData = null;
let archivedAgentMap = new Map(); // Store for modal access
let archivedHourlyMap = new Map(); // Store for matrix sorting
let sortKey = "ticket_activity";
let sortDir = "desc";
let matrixSortDir = "desc"; // For sorting the matrix by Total
let lastRange = null;
let autoRefreshTimer = null;
let currentView = "overview";

// === UTILITY FUNCTIONS ===

function toInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");

  dom.ticketModal.classList.remove("hidden");
};

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
  const customStartIST = dom.archivedStart.value;
  const customEndIST = dom.archivedEnd.value;

  if (!customStartIST || !customEndIST) {
    showError("Please select start and end times");
    return;
  }

  // Convert IST inputs to UTC for API
  const tableStartUtc = istToUtcIso(customStartIST);
  const tableEndUtc = istToUtcIso(customEndIST);

  setLoading(true);

  try {
    // 1. TABLE: Fetch tickets for custom range
    const [archivedTickets, doneTickets] = await Promise.all([
      fetchArchivedTickets(tableStartUtc, tableEndUtc),
      fetchDoneTickets(tableStartUtc, tableEndUtc)
    ]);

    const allTickets = [...archivedTickets, ...doneTickets];
    const { agentMap } = processArchivedTickets(allTickets, tableStartUtc, tableEndUtc);
    renderArchivedTable(agentMap);

    // 2. MATRIX: Fetch tickets for LAST 24 HOURS (Independent)
    const { startUtc, endUtc } = getLast24HoursUtc();

    const [matrix24Archived, matrix24Done] = await Promise.all([
      fetchArchivedTickets(startUtc, endUtc),
      fetchDoneTickets(startUtc, endUtc)
    ]);

    const matrixTickets = [...matrix24Archived, ...matrix24Done];
    const { hourlyMap } = processArchivedTickets(matrixTickets, startUtc, endUtc);
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
  }
}

// === AUTO REFRESH ===

function startAutoRefresh() {
  clearInterval(autoRefreshTimer);
  if (dom.autoRefresh.checked && lastRange) {
    autoRefreshTimer = setInterval(() => {
      fetchData();
      if (currentView === "archived") {
        fetchAndRenderArchived();
      }
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

function handleArchivedQuickRange(hours) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  dom.archivedStart.value = toInputValue(start);
  dom.archivedEnd.value = toInputValue(end);
  fetchAndRenderArchived();
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

function init() {
  // Event listeners
  dom.fetchBtn.addEventListener("click", fetchData);
  dom.archivedFetchBtn.addEventListener("click", fetchAndRenderArchived);
  dom.autoRefresh.addEventListener("change", startAutoRefresh);
  dom.exportBtn.addEventListener("click", exportToCsv);
  dom.agentSearch.addEventListener("input", renderTable);
  dom.archivedSearch.addEventListener("input", () => renderArchivedTable(archivedAgentMap));

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => switchView(e.target.dataset.view));
  });

  document.querySelectorAll(".quick-actions button").forEach(btn => {
    if (btn.dataset.hours) {
      btn.addEventListener("click", () => handleQuickRange(Number(btn.dataset.hours)));
    } else if (btn.dataset.archivedHours) {
      btn.addEventListener("click", () => handleArchivedQuickRange(Number(btn.dataset.archivedHours)));
    }
  });

  // Set default main range
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  setInputsForRange(start, end);

  // Set default archived range (Last 1 hour)
  const archNow = new Date();
  const archStart = new Date(archNow.getTime() - 1 * 60 * 60 * 1000);
  dom.archivedStart.value = toInputValue(archStart);
  dom.archivedEnd.value = toInputValue(archNow);

  // Initial fetch
  fetchData();
}

document.addEventListener("DOMContentLoaded", init);

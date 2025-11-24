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
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

/**
 * Converts IST datetime string to UTC ISO string
 * Since the system is in IST, new Date() handles the offset automatically.
 */
function istToUtcIso(istDatetimeString, isEndOfDay = false) {
  const date = new Date(istDatetimeString);
  if (isEndOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date.toISOString();
}

/**
 * Gets the last 24-hour window in IST, returns UTC ISO strings for API
 */
function getLast24HoursUtc() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString()
  };
}

function setInputsForRange(startDate, endDate) {
  dom.startInput.value = toInputValue(startDate);
  dom.endInput.value = toInputValue(endDate);
}

function getRangeFromInputs() {
  try {
    if (!dom.startInput.value || !dom.endInput.value) {
      const now = new Date();
      const start = new Date(now);
      start.setMinutes(0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      setInputsForRange(start, end);
    }

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
  if (dom.archivedFetchBtn) dom.archivedFetchBtn.disabled = state;
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

async function fetchArchivedTickets(startUtc, endUtc) {
  const limit = 1000;
  const url = `https://dashapi.gleap.io/v3/tickets?skip=0&limit=${limit}&filter={}&sort=-archivedAt&ignoreArchived=true&isSpam=false&type[]=INQUIRY&archived=true`;

  const res = await fetch(url, { headers: GLEAP_HEADERS });
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();
  const tickets = data.tickets || [];

  // Filter by UTC time range
  const startMs = new Date(startUtc).getTime();
  const endMs = new Date(endUtc).getTime();

  return tickets.filter(t => {
    if (!t.archivedAt) return false;
    const ticketMs = new Date(t.archivedAt).getTime();
    return ticketMs >= startMs && ticketMs <= endMs;
  });
}

async function fetchDoneTickets(startUtc, endUtc) {
  const limit = 1000;
  const url = `https://dashapi.gleap.io/v3/tickets?type=INQUIRY&status=DONE&skip=0&limit=${limit}&filter={}&sort=-lastNotification`;

  const res = await fetch(url, { headers: GLEAP_HEADERS });
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();
  const tickets = data.tickets || [];

  // Filter by UTC time range
  const startMs = new Date(startUtc).getTime();
  const endMs = new Date(endUtc).getTime();

  return tickets.filter(t => {
    if (!t.updatedAt) return false;
    const ticketMs = new Date(t.updatedAt).getTime();
    return ticketMs >= startMs && ticketMs <= endMs;
  });
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

function processArchivedTickets(tickets, startUtc, endUtc) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  const windowStartMs = new Date(startUtc).getTime();
  const windowEndMs = new Date(endUtc).getTime();

  const agentMap = new Map();
  const hourlyMap = new Map();

  tickets.forEach(ticket => {
    let type = "Archived";
    let timestampUtc = null;

    if (ticket.archived && ticket.archivedAt) {
      type = "Archived";
      timestampUtc = new Date(ticket.archivedAt);
    } else if (ticket.status === "DONE" && ticket.updatedAt) {
      type = "Done";
      timestampUtc = new Date(ticket.updatedAt);
    } else {
      return;
    }

    if (!timestampUtc || isNaN(timestampUtc.getTime())) return;

    const ticketMs = timestampUtc.getTime();
    if (ticketMs < windowStartMs || ticketMs > windowEndMs) return;

    // Convert UTC to IST for display
    const timestampIST = new Date(ticketMs + IST_OFFSET_MS);

    // Get Agent Info
    let user = {};
    if (type === "Archived") {
      user = ticket.processingUser || {};
    } else {
      user = ticket.latestComment || {};
      // Fallback if latestComment is missing user info
      if (!user.email && ticket.processingUser) user = ticket.processingUser;
    }

    // Use email as the primary ID to ensure consistent grouping between Archived (processingUser) and Done (latestComment)
    const agentId = user.email || user.id || "unknown";
    const agentName = user.firstName || user.email?.split("@")[0] || "Unknown";
    const agentEmail = user.email || "";
    const profileImage = user.profileImageUrl || "";
    const lastSeen = user.lastSeen || null;

    const ticketDetails = {
      id: ticket.id,
      bugId: ticket.bugId,
      timestamp: timestampIST,
      type: type
    };

    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, {
        id: agentId,
        name: agentName,
        email: agentEmail,
        profileImage,
        lastSeen,
        tickets: [],
        ticketDetails: [],
        latestTimestamp: timestampIST
      });
    }

    const agentData = agentMap.get(agentId);
    agentData.tickets.push(timestampIST);
    agentData.ticketDetails.push(ticketDetails);

    if (timestampIST > agentData.latestTimestamp) {
      agentData.latestTimestamp = timestampIST;
    }

    // For hourly matrix, use IST hour
    const hour = timestampIST.getUTCHours();
    const hourKey = `h${hour}`;

    if (!hourlyMap.has(hourKey)) {
      hourlyMap.set(hourKey, new Map());
    }

    const hourAgents = hourlyMap.get(hourKey);
    if (!hourAgents.has(agentId)) {
      hourAgents.set(agentId, {
        name: agentName,
        email: agentEmail,
        profileImage: profileImage,
        count: 0,
        tickets: [] // Store tickets for matrix modal
      });
    }

    const hourAgentData = hourAgents.get(agentId);
    hourAgentData.count++;
    hourAgentData.tickets.push(ticketDetails);
  });

  return { agentMap, hourlyMap };
}

function renderArchivedTable(agentMap) {
  const tbody = dom.archivedTableBody;
  tbody.innerHTML = "";
  archivedAgentMap = agentMap; // Save for modal

  const rows = Array.from(agentMap.values()).map(agent => ({
    id: agent.id,
    name: agent.name,
    email: agent.email,
    profileImage: agent.profileImage,
    lastSeen: agent.lastSeen,
    count: agent.tickets.length,
    latestTimestamp: agent.latestTimestamp
  }));

  rows.sort((a, b) => b.count - a.count);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No archived tickets in this window</td></tr>';
    return;
  }

  rows.forEach(r => {
    const archivedDate = r.latestTimestamp.toISOString().split('T')[0];
    const archivedTime = r.latestTimestamp.toISOString().split('T')[1].substring(0, 5);

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
      <td>
        <button class="ghost-btn" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;" onclick="showTicketModal('${r.id}')">
          View Tickets
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderHourlyBreakdown(hourlyMap) {
  archivedHourlyMap = hourlyMap; // Save for re-rendering if needed
  const headerRow = dom.archivedMatrixHeader;
  const body = dom.archivedMatrixBody;

  // 1. Render Header (0-23 + Total)
  let headerHtml = '<th class="sticky-col">Agent</th>';
  for (let i = 0; i < 24; i++) {
    headerHtml += `<th>${String(i).padStart(2, '0')}</th>`;
  }
  headerHtml += `<th class="sortable" id="matrixTotalHeader" style="cursor: pointer;">Total <span id="matrixSortIndicator">${matrixSortDir === 'desc' ? '↓' : '↑'}</span></th>`;
  headerRow.innerHTML = headerHtml;

  // Add event listener for sorting
  const totalHeader = document.getElementById("matrixTotalHeader");
  if (totalHeader) {
    totalHeader.addEventListener("click", () => {
      matrixSortDir = matrixSortDir === 'desc' ? 'asc' : 'desc';
      renderHourlyBreakdown(archivedHourlyMap);
    });
  }

  // 2. Get all agents who have data and calculate totals
  const allAgents = new Map();
  hourlyMap.forEach(hourMap => {
    hourMap.forEach((data, agentId) => {
      if (!allAgents.has(agentId)) {
        allAgents.set(agentId, {
          name: data.name,
          profileImage: data.profileImage,
          total: 0
        });
      }
      allAgents.get(agentId).total += data.count;
    });
  });

  if (allAgents.size === 0) {
    body.innerHTML = '<tr><td colspan="26" class="no-data">No data available</td></tr>';
    return;
  }

  // 3. Sort Agents by Total
  const sortedAgents = Array.from(allAgents.entries()).sort((a, b) => {
    return matrixSortDir === 'desc' ? b[1].total - a[1].total : a[1].total - b[1].total;
  });

  // 4. Render Rows
  body.innerHTML = "";
  sortedAgents.forEach(([agentId, agentData]) => {
    let rowHtml = `
      <td class="sticky-col">
        <div class="agent" style="gap: 0.5rem;">
          <div class="avatar ${agentData.profileImage ? "" : "placeholder"}" style="width: 24px; height: 24px; font-size: 0.7rem;">
            ${agentData.profileImage ? `<img src="${agentData.profileImage}">` : agentData.name.charAt(0)}
          </div>
          <span style="font-weight: 500; font-size: 0.75rem;">${agentData.name}</span>
        </div>
      </td>`;

    for (let i = 0; i < 24; i++) {
      const hourKey = `h${i}`;
      const hourData = hourlyMap.get(hourKey);
      const count = hourData?.get(agentId)?.count || 0;
      const cellClass = count > 5 ? 'high-data' : (count > 0 ? 'has-data' : '');

      // Make cell clickable if there is data
      if (count > 0) {
        rowHtml += `<td class="${cellClass} clickable-cell" onclick="showTicketModal('${agentId}', ${i})">${count}</td>`;
      } else {
        rowHtml += `<td class="${cellClass}">${count || ''}</td>`;
      }
    }

    rowHtml += `<td style="font-weight: 700; background: rgba(59, 130, 246, 0.1);">${agentData.total}</td>`;

    const tr = document.createElement("tr");
    tr.innerHTML = rowHtml;
    body.appendChild(tr);
  });
}

window.showTicketModal = function (agentId, filterHour = null) {
  const agent = archivedAgentMap.get(agentId);
  // If not found in the main map (e.g. from matrix which uses a different scope), try to reconstruct or find in matrix data
  // Ideally, we should have a unified store. For now, let's assume archivedAgentMap is populated by the last fetch.
  // NOTE: The matrix fetch runs separate from the table fetch. We need to ensure we have the data.
  // If filterHour is provided, we are likely clicking the matrix. The matrix data might be different from the table data if ranges differ.
  // However, the user request implies the matrix is "Last 24h" and the table is "Custom".
  // To support clicking the matrix, we need to store the matrix tickets somewhere accessible.

  // Let's check if we are in "matrix mode" (filterHour is not null)
  let tickets = [];
  let agentName = "";

  if (filterHour !== null) {
    // We need to find tickets for this agent in this hour from the MATRIX dataset.
    // Currently we don't store the raw tickets for the matrix globally, only the counts in hourlyMap.
    // We need to fix processArchivedTickets to store the raw tickets in the map.
    // See the fix in processArchivedTickets below.
    const hourKey = `h${filterHour}`;
    const hourData = archivedHourlyMap.get(hourKey);
    const agentData = hourData?.get(agentId);
    if (agentData && agentData.tickets) {
      tickets = agentData.tickets;
      agentName = agentData.name;
    }
  } else {
    if (!agent) return;
    tickets = agent.ticketDetails;
    agentName = agent.name;
  }

  if (!tickets || !tickets.length) return;

  dom.modalTitle.textContent = `Tickets - ${agentName} ${filterHour !== null ? `(Hour ${filterHour})` : ''}`;
  dom.modalContent.innerHTML = "";

  const sortedTickets = [...tickets].sort((a, b) => b.timestamp - a.timestamp);

  sortedTickets.forEach(t => {
    const timeStr = t.timestamp.toISOString().split('T')[1].substring(0, 8);
    const displayId = t.bugId ? `Bug #${t.bugId}` : `Ticket #${t.id}`;
    const url = `https://app.gleap.io/projects/${PROJECT_ID}/inquiries/${t.id}`;

    // Color coding
    const typeClass = t.type === "Archived" ? "chip-archived" : "chip-done";
    const typeLabel = t.type;

    const div = document.createElement("div");
    div.className = "ticket-list-item";
    div.innerHTML = `
      <a href="${url}" target="_blank">${displayId}</a>
      <div style="display: flex; gap: 1rem; align-items: center;">
        <span class="chip ${typeClass}" style="font-size: 0.7rem; padding: 0.125rem 0.5rem;">${typeLabel}</span>
        <span class="ticket-time">${timeStr} (IST)</span>
      </div>
    `;
    dom.modalContent.appendChild(div);
  });

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

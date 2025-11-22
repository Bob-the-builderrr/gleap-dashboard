const IST_OFFSET_MIN = 330; // +5:30

let agentsData = [];
let filteredAgentsData = [];
let currentSortKey = "total_tickets";
let currentSortDir = "desc";
let currentPage = 1;
const pageSize = 15;
let autoRefreshInterval = null;
let lastFetchParams = null;

// Enhanced IST to UTC conversion with validation
function istToUtcIso(dateStr, timeStr, isEndOfDay) {
  if (!dateStr) {
    showError("Date is required");
    return null;
  }

  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    
    // Validate date
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) {
      showError("Invalid date selected");
      return null;
    }

    let hours = 0, minutes = 0, seconds = 0, ms = 0;

    if (timeStr) {
      const [h, m] = timeStr.split(":").map(Number);
      if (h > 23 || m > 59) {
        showError("Invalid time format");
        return null;
      }
      hours = h;
      minutes = m;
    } else if (isEndOfDay) {
      hours = 23;
      minutes = 59;
      seconds = 59;
      ms = 999;
    }

    // Create date in local timezone, then convert to UTC
    const localDate = new Date(year, month - 1, day, hours, minutes, seconds, ms);
    const utcMs = localDate.getTime() - (localDate.getTimezoneOffset() + IST_OFFSET_MIN) * 60 * 1000;
    
    const result = new Date(utcMs).toISOString();
    
    // Validate result isn't in the future for end dates
    if (isEndOfDay && new Date(result) > new Date()) {
      return new Date().toISOString();
    }
    
    return result;
  } catch (error) {
    console.error("Date conversion error:", error);
    showError("Date conversion error");
    return null;
  }
}

// Enhanced loading with progress
function showLoading(on, message = "Loading metrics...") {
  const overlay = document.getElementById("loadingOverlay");
  const loadingText = document.querySelector(".loading-text");
  const loadingDetails = document.getElementById("loadingDetails");
  
  if (!overlay) return;
  
  if (on) {
    loadingText.textContent = message;
    loadingDetails.textContent = "Fetching data from Gleap API...";
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
    loadingDetails.textContent = "";
  }
}

// Toast notifications
function showError(message) {
  const toast = document.getElementById("errorToast");
  const toastMessage = document.getElementById("toastMessage");
  
  toastMessage.textContent = message;
  toast.classList.remove("hidden");
  
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 5000);
}

function showSuccess(message) {
  // Could implement success toast similarly
  console.log("Success:", message);
}

// Enhanced data fetching with retry logic
async function fetchData(startIso, endIso, retryCount = 0) {
  if (!startIso || !endIso) {
    showError("Invalid date range");
    return;
  }

  // Validate date range
  const start = new Date(startIso);
  const end = new Date(endIso);
  
  if (start >= end) {
    showError("Start date must be before end date");
    return;
  }
  
  if (end > new Date()) {
    showError("End date cannot be in the future");
    return;
  }

  try {
    showLoading(true, `Fetching data for ${formatDateRange(startIso, endIso)}`);
    lastFetchParams = { startIso, endIso };
    
    const url = `${window.location.origin}/api/team-performance?startDate=${encodeURIComponent(startIso)}&endDate=${encodeURIComponent(endIso)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();

    if (!data || data.error) {
      console.error("API error:", data);
      throw new Error(data?.error || "Failed to fetch data");
    }

    // Filter out unknown/invalid agents
    agentsData = (data.agents || []).filter(agent => 
      agent.agent_name && 
      agent.agent_name !== "Unknown" && 
      agent.total_tickets > 0
    );

    updateSummary(data.totals || {});
    updateLastUpdated();
    applyFilters();
    
    showSuccess(`Loaded ${agentsData.length} agents`);
    
  } catch (err) {
    console.error("Fetch error:", err);
    
    if (err.name === 'AbortError') {
      showError("Request timeout - please try again");
    } else if (retryCount < 2) {
      showLoading(true, `Retrying... (${retryCount + 1}/3)`);
      setTimeout(() => fetchData(startIso, endIso, retryCount + 1), 2000);
    } else {
      showError(err.message || "Failed to load data");
    }
  } finally {
    showLoading(false);
  }
}

// Enhanced summary with trends
function updateSummary(totals) {
  document.getElementById("totalTicketsValue").textContent = totals.total_tickets ?? "--";
  const avg = typeof totals.avg_rating === "number" ? totals.avg_rating.toFixed(1) : "--";
  document.getElementById("averageRatingValue").textContent = avg;
  document.getElementById("totalAgentsValue").textContent = totals.total_agents ?? "--";
  document.getElementById("responseTimeValue").textContent = totals.avg_response_time ?? "--";
}

function updateLastUpdated() {
  const element = document.getElementById("lastUpdated");
  const now = new Date();
  element.textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

// Enhanced sorting with numeric fallback
function sortAndRender() {
  const key = currentSortKey;
  const dir = currentSortDir === "asc" ? 1 : -1;

  const sorted = [...filteredAgentsData].sort((a, b) => {
    let va = a[key];
    let vb = b[key];

    // Handle numeric sorting for numeric keys
    if (key.includes('_seconds') || ['total_tickets', 'closed_tickets', 'ticket_activity', 'rating_score'].includes(key)) {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return (va - vb) * dir;
    }

    // String sorting
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * dir;
    }

    return 0;
  });

  renderTable(sorted);
  updateSortIndicators();
  updatePagination();
}

// Enhanced table rendering with pagination
function renderTable(agents) {
  const tbody = document.getElementById("tableBody");
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAgents = agents.slice(startIndex, startIndex + pageSize);

  tbody.innerHTML = "";

  if (paginatedAgents.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="10" class="no-data">No agents found matching your criteria</td>`;
    tbody.appendChild(row);
    return;
  }

  paginatedAgents.forEach(a => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="agent-cell">
          <div class="agent-avatar ${!a.profile_image ? 'default-avatar' : ''}">
            ${a.profile_image ? `<img src="${a.profile_image}" alt="${a.agent_name}" />` : a.agent_name?.charAt(0) || '?'}
          </div>
          <div class="agent-meta">
            <span class="agent-name">${a.agent_name}</span>
            <span class="agent-email">${a.agent_email || ''}</span>
          </div>
        </div>
      </td>
      <td><span class="metric-value">${a.total_tickets}</span></td>
      <td><span class="metric-value">${a.closed_tickets}</span></td>
      <td><span class="time-metric ${getTimeMetricClass(a.median_reply_time)}">${a.median_reply_time}</span></td>
      <td><span class="time-metric ${getTimeMetricClass(a.median_first_reply)}">${a.median_first_reply}</span></td>
      <td><span class="time-metric ${getTimeMetricClass(a.median_assignment_reply)}">${a.median_assignment_reply}</span></td>
      <td><span class="time-metric ${getTimeMetricClass(a.time_to_last_close)}">${a.time_to_last_close}</span></td>
      <td><span class="rating-metric ${getRatingClass(a.rating_score)}">${a.average_rating}</span></td>
      <td><span class="activity-metric">${a.ticket_activity}</span></td>
      <td><span class="hours-metric">${a.hours_active}</span></td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("visibleAgentsCount").textContent = agents.length;
}

// Utility functions for metric styling
function getTimeMetricClass(timeStr) {
  if (!timeStr || timeStr === '--') return 'time-neutral';
  const minutes = timeStr.includes('h') ? parseFloat(timeStr) * 60 : parseInt(timeStr);
  if (minutes < 5) return 'time-excellent';
  if (minutes < 15) return 'time-good';
  if (minutes < 30) return 'time-average';
  return 'time-poor';
}

function getRatingClass(rating) {
  if (!rating || rating === '--') return 'rating-neutral';
  if (rating >= 4.5) return 'rating-excellent';
  if (rating >= 4.0) return 'rating-good';
  if (rating >= 3.0) return 'rating-average';
  return 'rating-poor';
}

function updateSortIndicators() {
  document.querySelectorAll("th.sortable").forEach(th => {
    const key = th.getAttribute("data-sort");
    const indicator = th.querySelector(".sort-indicator");
    
    th.classList.remove("active", "asc", "desc");
    
    if (key === currentSortKey) {
      th.classList.add("active", currentSortDir);
      if (indicator) {
        indicator.textContent = currentSortDir === "asc" ? "↑" : "↓";
      }
    }
  });
}

function updatePagination() {
  const totalPages = Math.ceil(filteredAgentsData.length / pageSize);
  const currentPageElement = document.getElementById("currentPage");
  const totalPagesElement = document.getElementById("totalPages");
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");

  currentPageElement.textContent = currentPage;
  totalPagesElement.textContent = totalPages;
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Enhanced filtering with search
function applyFilters() {
  const searchTerm = document.getElementById("agentSearch").value.toLowerCase();
  
  filteredAgentsData = agentsData.filter(agent => 
    agent.agent_name.toLowerCase().includes(searchTerm) ||
    (agent.agent_email && agent.agent_email.toLowerCase().includes(searchTerm))
  );
  
  currentPage = 1; // Reset to first page when filtering
  sortAndRender();
}

// Export to CSV functionality
function exportToCSV() {
  if (agentsData.length === 0) {
    showError("No data to export");
    return;
  }

  const headers = ["Agent", "Email", "Total Tickets", "Closed Tickets", "Median Reply", "First Reply", "Assign Reply", "Last Close", "Rating", "Activity", "Hours Active"];
  const csvData = agentsData.map(agent => [
    agent.agent_name,
    agent.agent_email,
    agent.total_tickets,
    agent.closed_tickets,
    agent.median_reply_time,
    agent.median_first_reply,
    agent.median_assignment_reply,
    agent.time_to_last_close,
    agent.average_rating,
    agent.ticket_activity,
    agent.hours_active
  ]);

  const csvContent = [
    headers.join(","),
    ...csvData.map(row => row.map(field => `"${field}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-performance-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showSuccess("Data exported successfully");
}

// Auto-refresh functionality
function setupAutoRefresh() {
  const toggle = document.getElementById("autoRefresh");
  
  toggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      autoRefreshInterval = setInterval(() => {
        if (lastFetchParams) {
          fetchData(lastFetchParams.startIso, lastFetchParams.endIso);
        }
      }, 5 * 60 * 1000); // 5 minutes
      showSuccess("Auto-refresh enabled");
    } else {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
      showSuccess("Auto-refresh disabled");
    }
  });
}

// Date formatting utility
function formatDateRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

// Event Listeners
document.getElementById("fetchBtn").addEventListener("click", () => {
  const startDate = document.getElementById("startDate").value;
  const startTime = document.getElementById("startTime").value;
  const endDate = document.getElementById("endDate").value;
  const endTime = document.getElementById("endTime").value;

  if (!startDate || !endDate) {
    showError("Please select both start and end dates");
    return;
  }

  const startIso = istToUtcIso(startDate, startTime || "00:00", false);
  const endIso = istToUtcIso(endDate, endTime || null, true);

  if (startIso && endIso) {
    fetchData(startIso, endIso);
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("startDate").value = "";
  document.getElementById("startTime").value = "";
  document.getElementById("endDate").value = "";
  document.getElementById("endTime").value = "";
  document.getElementById("agentSearch").value = "";
  agentsData = [];
  filteredAgentsData = [];
  renderTable([]);
  updateSummary({});
});

document.getElementById("exportBtn").addEventListener("click", exportToCSV);

document.getElementById("agentSearch").addEventListener("input", applyFilters);

document.getElementById("prevPage").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    sortAndRender();
  }
});

document.getElementById("nextPage").addEventListener("click", () => {
  const totalPages = Math.ceil(filteredAgentsData.length / pageSize);
  if (currentPage < totalPages) {
    currentPage++;
    sortAndRender();
  }
});

// Quick buttons
document.querySelectorAll(".quick-buttons button").forEach(btn => {
  btn.addEventListener("click", () => {
    const hours = parseInt(btn.dataset.hours, 10);
    const endUtc = new Date();
    const startUtc = new Date(endUtc.getTime() - hours * 60 * 60 * 1000);

    fetchData(startUtc.toISOString(), endUtc.toISOString());
  });
});

// Enhanced table sorting
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

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  switch(e.key) {
    case '1':
      document.querySelector('.quick-buttons button[data-hours="1"]').click();
      break;
    case '2':
      document.querySelector('.quick-buttons button[data-hours="2"]').click();
      break;
    case '4':
      document.querySelector('.quick-buttons button[data-hours="4"]').click();
      break;
    case '8':
      document.querySelector('.quick-buttons button[data-hours="24"]').click();
      break;
    case 'r':
    case 'R':
      if (lastFetchParams) {
        fetchData(lastFetchParams.startIso, lastFetchParams.endIso);
      }
      break;
  }
});

// Initialize with default data
window.addEventListener("load", () => {
  // Pre-fill dates with today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  document.getElementById("startDate").value = `${yyyy}-${mm}-${dd}`;
  document.getElementById("endDate").value = `${yyyy}-${mm}-${dd}`;

  // Set up auto-refresh
  setupAutoRefresh();
  
  // Load initial data
  const endUtc = new Date();
  const startUtc = new Date(endUtc.getTime() - 1 * 60 * 60 * 1000);
  fetchData(startUtc.toISOString(), endUtc.toISOString());
});
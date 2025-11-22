/* ============================
   TIME HELPER FUNCTIONS
============================ */
function getISTDateTimeString(date = new Date()) {
  return date.toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/(\d+)\/(\d+)\/(\d+),?/, '$3-$2-$1').replace(' ', 'T');
}

function getUTCDateTimeFromIST(istDateTimeString) {
  // Convert IST datetime string to UTC
  const [datePart, timePart] = istDateTimeString.split('T');
  const [year, month, day] = datePart.split('-');
  const [hours, minutes, seconds] = timePart.split(':');
  
  // Create date in IST timezone
  const istDate = new Date(`${month}/${day}/${year} ${hours}:${minutes}:${seconds} GMT+0530`);
  
  // Convert to UTC
  return istDate.toISOString();
}

function calculateTimeRange(preset) {
  const now = new Date();
  let startTime = new Date();
  
  switch(preset) {
    case '30m':
      startTime.setMinutes(now.getMinutes() - 30);
      break;
    case '1h':
      startTime.setHours(now.getHours() - 1);
      break;
    case '2h':
      startTime.setHours(now.getHours() - 2);
      break;
    case '8h':
      startTime.setHours(now.getHours() - 8);
      break;
    case '24h':
      startTime.setDate(now.getDate() - 1);
      break;
    case '7d':
      startTime.setDate(now.getDate() - 7);
      break;
    default:
      startTime.setHours(now.getHours() - 1); // Default to 1 hour
  }
  
  return {
    start: getUTCDateTimeFromIST(getISTDateTimeString(startTime)),
    end: getUTCDateTimeFromIST(getISTDateTimeString(now))
  };
}

/* ============================
   TAB SWITCHING FUNCTION
============================ */
function showTab(name) {
  document.getElementById("allTab").style.display =
    name === "all" ? "block" : "none";
  document.getElementById("archivedTab").style.display =
    name === "archived" ? "block" : "none";
  document.getElementById("plansTab").style.display =
    name === "plans" ? "block" : "none";
  document.getElementById("teamTab").style.display =
    name === "team" ? "block" : "none";

  document.querySelectorAll(".tab").forEach(btn =>
    btn.classList.remove("active")
  );

  document
    .querySelector(`.tab[onclick="showTab('${name}')"]`)
    .classList.add("active");

  // Refresh data when switching tabs
  if (name === 'all') {
    loadAllTickets();
  } else if (name === 'archived') {
    loadArchived();
  } else if (name === 'plans') {
    loadPlanSummary();
  } else if (name === 'team') {
    // Initialize team performance with default dates
    initializeTeamPerformanceDates();
  }
}

/* ============================
   INITIALIZE TEAM PERFORMANCE DATES
============================ */
function initializeTeamPerformanceDates() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Set default values for datetime-local inputs
  document.getElementById('startDate').value = getISTDateTimeString(oneHourAgo).slice(0, 16);
  document.getElementById('endDate').value = getISTDateTimeString(now).slice(0, 16);
}

/* ============================
   LOAD TEAM PERFORMANCE WITH PRESET
============================ */
async function loadTeamPerformanceWithPreset() {
  const preset = document.getElementById('teamTimeWindow').value;
  
  if (preset === 'custom') {
    // Show custom date inputs but don't load data
    return;
  }
  
  const timeRange = calculateTimeRange(preset);
  
  try {
    console.log(`Loading team performance for preset: ${preset}`, timeRange);

    const performanceDiv = document.getElementById("teamPerformance");
    performanceDiv.innerHTML = '<p>Loading team performance data...</p>';

    const res = await fetch(`/api/team-performance?startDate=${timeRange.start}&endDate=${timeRange.end}`);
    const data = await res.json();

    console.log("Team performance response:", data);

    if (data.error) {
      performanceDiv.innerHTML = `<p style="color: red;">Error loading team performance: ${data.details}</p>`;
      return;
    }

    displayTeamPerformance(data, `${preset} window`);

  } catch (err) {
    console.error("Error loading team performance:", err);
    document.getElementById("teamPerformance").innerHTML = 
      `<p style="color: red;">Error loading team performance: ${err.message}</p>`;
  }
}

/* ============================
   LOAD TEAM PERFORMANCE WITH CUSTOM DATES
============================ */
async function loadTeamPerformanceWithCustom() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  
  if (!startDate || !endDate) {
    alert('Please select both start and end dates');
    return;
  }

  // Convert IST datetime to UTC
  const startIST = startDate + ':00';
  const endIST = endDate + ':00';
  
  const startUTC = getUTCDateTimeFromIST(startIST);
  const endUTC = getUTCDateTimeFromIST(endIST);

  try {
    console.log(`Loading team performance for custom range: ${startUTC} to ${endUTC}`);

    const performanceDiv = document.getElementById("teamPerformance");
    performanceDiv.innerHTML = '<p>Loading team performance data...</p>';

    const res = await fetch(`/api/team-performance?startDate=${startUTC}&endDate=${endUTC}`);
    const data = await res.json();

    console.log("Team performance response:", data);

    if (data.error) {
      performanceDiv.innerHTML = `<p style="color: red;">Error loading team performance: ${data.details}</p>`;
      return;
    }

    const rangeLabel = `${startDate} to ${endDate}`;
    displayTeamPerformance(data, rangeLabel);

  } catch (err) {
    console.error("Error loading team performance:", err);
    document.getElementById("teamPerformance").innerHTML = 
      `<p style="color: red;">Error loading team performance: ${err.message}</p>`;
  }
}

/* ============================
   DISPLAY TEAM PERFORMANCE
============================ */
function displayTeamPerformance(data, rangeLabel) {
  const performanceDiv = document.getElementById("teamPerformance");
  
  if (data.agents.length === 0) {
    performanceDiv.innerHTML = `
      <div class="no-data">
        <h3>No performance data found</h3>
        <p>No team performance data available for the selected time range.</p>
      </div>
    `;
    return;
  }

  performanceDiv.innerHTML = `
    <div class="performance-header">
      <h3>📈 Team Performance (${rangeLabel})</h3>
      <div class="agent-count">Total Agents: <strong>${data.total_agents}</strong></div>
    </div>

    <div class="performance-table-container">
      <table class="performance-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Total Tickets</th>
            <th>Closed</th>
            <th>Comments</th>
            <th>Median Reply</th>
            <th>First Reply</th>
            <th>Rating</th>
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          ${data.agents.map(agent => `
            <tr>
              <td class="agent-cell">
                <div class="agent-info">
                  ${agent.profile_image ? `<img src="${agent.profile_image}" alt="${agent.agent_name}" class="agent-avatar">` : ''}
                  <div>
                    <div class="agent-name">${agent.agent_name}</div>
                    <div class="agent-email">${agent.agent_email}</div>
                  </div>
                </div>
              </td>
              <td class="metric-cell"><strong>${agent.total_tickets}</strong></td>
              <td class="metric-cell">${agent.closed_tickets}</td>
              <td class="metric-cell">${agent.comments_count}</td>
              <td class="time-cell">${agent.median_reply_time}</td>
              <td class="time-cell">${agent.median_first_reply}</td>
              <td class="rating-cell">${agent.average_rating}</td>
              <td class="metric-cell" title="Ticket activity count">${agent.ticket_activity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="performance-summary">
      <h4>Performance Summary:</h4>
      <div class="summary-stats">
        <div class="summary-stat">
          <span class="stat-label">Total Tickets Handled:</span>
          <span class="stat-value">${data.agents.reduce((sum, agent) => sum + agent.total_tickets, 0)}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Total Closed:</span>
          <span class="stat-value">${data.agents.reduce((sum, agent) => sum + agent.closed_tickets, 0)}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Active Agents:</span>
          <span class="stat-value">${data.agents.filter(agent => agent.total_tickets > 0).length}</span>
        </div>
      </div>
    </div>
  `;
}

/* ============================
   INITIAL LOAD
============================ */
loadAllTickets();
loadArchived();
loadStatistics();
initializeTeamPerformanceDates(); // Initialize team performance dates

// Auto-refresh every 30 seconds
setInterval(() => {
  const activeTab = document.querySelector('.tab.active').getAttribute('onclick');
  if (activeTab.includes("'all'")) {
    loadAllTickets();
  } else if (activeTab.includes("'archived'")) {
    loadArchived();
  } else if (activeTab.includes("'plans'")) {
    loadPlanSummary();
  }
  // Team performance doesn't auto-refresh (requires manual load)
  loadStatistics(); // Always refresh statistics
}, 30000);
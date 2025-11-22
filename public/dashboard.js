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
  }
  // Team performance requires manual load with dates
}

/* ============================
   LOAD TEAM PERFORMANCE
============================ */
async function loadTeamPerformance() {
  try {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    // Convert dates to UTC format (YYYY-MM-DDTHH:mm:ss.sssZ)
    const startUTC = new Date(startDate + 'T00:00:00.000Z').toISOString();
    const endUTC = new Date(endDate + 'T23:59:59.999Z').toISOString();

    console.log(`Loading team performance for: ${startUTC} to ${endUTC}`);

    const performanceDiv = document.getElementById("teamPerformance");
    performanceDiv.innerHTML = '<p>Loading team performance data...</p>';

    const res = await fetch(`/api/team-performance?startDate=${startUTC}&endDate=${endUTC}`);
    const data = await res.json();

    console.log("Team performance response:", data);

    if (data.error) {
      performanceDiv.innerHTML = `<p style="color: red;">Error loading team performance: ${data.details}</p>`;
      return;
    }

    if (data.agents.length === 0) {
      performanceDiv.innerHTML = `
        <div class="no-data">
          <h3>No performance data found</h3>
          <p>No team performance data available for the selected date range (${startDate} to ${endDate}).</p>
        </div>
      `;
      return;
    }

    performanceDiv.innerHTML = `
      <div class="performance-header">
        <h3>📈 Team Performance (${startDate} to ${endDate})</h3>
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
              <th>Assignment Reply</th>
              <th>Last Close</th>
              <th>Rating</th>
              <th>Activity</th>
              <th>Hours Active</th>
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
                <td class="time-cell">${agent.median_assignment_reply}</td>
                <td class="time-cell">${agent.time_to_last_close}</td>
                <td class="rating-cell">${agent.average_rating}</td>
                <td class="metric-cell">${agent.ticket_activity}</td>
                <td class="metric-cell">${agent.hours_active}</td>
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

  } catch (err) {
    console.error("Error loading team performance:", err);
    document.getElementById("teamPerformance").innerHTML = 
      `<p style="color: red;">Error loading team performance: ${err.message}</p>`;
  }
}

/* ============================
   INITIAL LOAD
============================ */
loadAllTickets();
loadArchived();
loadStatistics();

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
  // Team performance doesn't auto-refresh (requires date selection)
  loadStatistics(); // Always refresh statistics
}, 30000);
/* ============================
   TAB SWITCHING FUNCTION
============================ */
function showTab(name) {
  document.getElementById("allTab").style.display =
    name === "all" ? "none" : "none";
  document.getElementById("archivedTab").style.display =
    name === "archived" ? "block" : "none";
  document.getElementById("plansTab").style.display =
    name === "plans" ? "block" : "none";

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
}

/* ============================
   LOAD PLAN SUMMARY
============================ */
async function loadPlanSummary() {
  try {
    console.log("Loading plan summary...");
    const res = await fetch("/api/plan-summary");
    const data = await res.json();

    console.log("Plan summary response:", data);

    const summaryDiv = document.getElementById("planSummary");
    
    if (data.error) {
      summaryDiv.innerHTML = `<p style="color: red;">Error loading plan summary</p>`;
      return;
    }

    const timeIST = data.time_ist || new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

    summaryDiv.innerHTML = `
      <div class="plan-summary-header">
        <h3>📊 Plan Distribution (${timeIST} IST)</h3>
        <div class="total-tickets">Total Tickets: <strong>${data.total_tickets}</strong></div>
      </div>

      <div class="plan-cards">
        <div class="plan-card base-plan">
          <div class="plan-emoji">🟢</div>
          <div class="plan-info">
            <div class="plan-name">BASE PLAN</div>
            <div class="plan-count">${data.summary.base_plan}</div>
          </div>
        </div>

        <div class="plan-card pro-plan">
          <div class="plan-emoji">🚀</div>
          <div class="plan-info">
            <div class="plan-name">PRO PLAN</div>
            <div class="plan-count">${data.summary.pro_plan}</div>
          </div>
        </div>

        <div class="plan-card trial-plan">
          <div class="plan-emoji">📦</div>
          <div class="plan-info">
            <div class="plan-name">TRIAL PLAN</div>
            <div class="plan-count">${data.summary.trial_plan}</div>
          </div>
        </div>

        <div class="plan-card custom-plan">
          <div class="plan-emoji">💎</div>
          <div class="plan-info">
            <div class="plan-name">CUSTOM PLAN</div>
            <div class="plan-count">${data.summary.custom_plan}</div>
          </div>
        </div>
      </div>

      ${data.custom_details && data.custom_details.length > 0 ? `
        <div class="custom-details">
          <h4>Custom Plan Breakdown:</h4>
          <div class="custom-list">
            ${data.custom_details.map(detail => `<div class="custom-item">${detail}</div>`).join('')}
          </div>
        </div>
      ` : ''}

      <div class="full-breakdown">
        <h4>Full Plan Breakdown:</h4>
        <table class="breakdown-table">
          <thead>
            <tr>
              <th>Plan Type</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            ${data.breakdown.map(item => `
              <tr>
                <td>${item.emoji} ${item.plan}</td>
                <td><strong>${item.count}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    console.error("Error loading plan summary:", err);
    document.getElementById("planSummary").innerHTML = 
      `<p style="color: red;">Error loading plan summary: ${err.message}</p>`;
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
  loadStatistics(); // Always refresh statistics
}, 30000);
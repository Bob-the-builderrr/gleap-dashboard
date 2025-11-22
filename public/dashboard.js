/* ============================
   TAB SWITCHING FUNCTION
============================ */
function showTab(name) {
  document.getElementById("allTab").style.display =
    name === "all" ? "block" : "none";
  document.getElementById("archivedTab").style.display =
    name === "archived" ? "block" : "none";

  document.querySelectorAll(".tab").forEach(btn =>
    btn.classList.remove("active")
  );

  document
    .querySelector(`.tab[onclick="showTab('${name}')"]`)
    .classList.add("active");

  // Refresh data when switching tabs
  if (name === 'all') {
    loadAllTickets();
  } else {
    loadArchived();
  }
}

/* ============================
   LOAD ALL LIVE TICKETS
============================ */
async function loadAllTickets() {
  try {
    console.log("Loading open tickets...");
    const res = await fetch("/api/open-tickets");
    const data = await res.json();

    console.log("Open tickets response:", data);

    // Use all data, don't filter
    const valid = data;

    /* ---- Update TOTAL tickets ---- */
    let total = valid.length;
    document.getElementById("totalTickets").innerText = total;

    /* ---- Plan breakdown ---- */
    const plan = {};
    valid.forEach(r => {
      const key = r.plan_type || "UNKNOWN_PLAN";
      plan[key] = (plan[key] || 0) + 1;
    });

    const planDiv = document.getElementById("planBreakdown");
    planDiv.innerHTML = "";
    Object.entries(plan).forEach(([k, v]) => {
      planDiv.innerHTML += `<p><strong>${k}:</strong> ${v}</p>`;
    });

    /* ---- Fill Table ---- */
    const tbody = document.getElementById("ticketRows");
    tbody.innerHTML = "";

    if (valid.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No open tickets found</td></tr>`;
      return;
    }

    valid.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td>${r.agent_name || "UNASSIGNED"}</td>
          <td>${r.agent_open_ticket || "0"}</td>
          <td>${r.priority || "-"}</td>
          <td>${r.ticket_status || "-"}</td>
          <td>${r.time_open_duration || "-"}</td>
          <td>${r.user_email || "-"}</td>
          <td>${r.plan_type || "-"}</td>
          <td>${r.tags || "-"}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Error loading tickets:", err);
    document.getElementById("ticketRows").innerHTML = 
      `<tr><td colspan="8" style="text-align: center; color: red;">Error loading tickets: ${err.message}</td></tr>`;
  }
}

/* ============================
   LOAD ARCHIVED TICKETS
============================ */
async function loadArchived() {
  try {
    const timeWindow = document.getElementById("timeWindow").value;
    console.log(`Loading archived tickets for window: ${timeWindow}`);
    
    const res = await fetch(`/api/archived-tickets?window=${timeWindow}`);
    const data = await res.json();

    console.log("Archived tickets response:", data);

    const tbody = document.getElementById("archivedRows");
    tbody.innerHTML = "";

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No archived tickets found for the last ${timeWindow}</td></tr>`;
      return;
    }

    data.forEach(t => {
      tbody.innerHTML += `
        <tr>
          <td>${t.agent_name}</td>
          <td>${t.agent_email}</td>
          <td>${t.ticket_id}</td>
          <td><strong>${t.total_count}</strong></td>
          <td>${t.archived_date_ist}</td>
          <td>${t.archived_time_ist}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Error loading archived tickets:", err);
    document.getElementById("archivedRows").innerHTML = 
      `<tr><td colspan="6" style="text-align: center; color: red;">Error loading archived tickets: ${err.message}</td></tr>`;
  }
}

/* ============================
   INITIAL LOAD
============================ */
loadAllTickets();
loadArchived();

// Auto-refresh every 30 seconds
setInterval(() => {
  if (document.getElementById("allTab").style.display !== "none") {
    loadAllTickets();
  } else {
    loadArchived();
  }
}, 30000);
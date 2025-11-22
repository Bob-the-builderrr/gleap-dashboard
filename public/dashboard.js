/* ---------------------------
   TAB SWITCHING
---------------------------- */
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
}

/* ---------------------------
   LOAD ALL TICKETS
---------------------------- */
async function loadAll() {
  const res = await fetch("https://gleap-dashboard.vercel.app/api/agents");
  const data = await res.json();

  const valid = data.filter(r => r.ticket_id && r.ticket_id !== "-");

  const totalTickets = valid.reduce(
    (sum, r) => sum + Number(r.agent_open_ticket || 0),
    0
  );

  document.getElementById("totalTickets").innerText = totalTickets;

  const plan = {};
  valid.forEach(r => {
    const key = r.plan_type || "UNKNOWN_PLAN";
    const count = Number(r.agent_open_ticket || 0);
    plan[key] = (plan[key] || 0) + count;
  });

  const planDiv = document.getElementById("planBreakdown");
  planDiv.innerHTML = "";
  Object.entries(plan).forEach(([k, v]) => {
    planDiv.innerHTML += `<p>${k}: ${v}</p>`;
  });

  const tbody = document.getElementById("ticketRows");
  tbody.innerHTML = "";

  valid.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.agent_name}</td>
        <td>${r.agent_open_ticket}</td>
        <td>${r.priority}</td>
        <td>${r.ticket_status}</td>
        <td>${r.time_open_duration}</td>
        <td>${r.user_email}</td>
        <td>${r.plan_type}</td>
        <td>${r.tags}</td>
      </tr>
    `;
  });
}

/* ---------------------------
   LOAD ARCHIVED TICKETS
---------------------------- */
async function loadArchived() {
  const res = await fetch(
    "https://dashapi.gleap.io/v3/tickets?skip=0&limit=200&archived=true&type[]=INQUIRY&ignoreArchived=true&isSpam=false&sort=-lastNotification",
    {
      headers: {
        "Authorization": "Bearer YOUR_TOKEN_HERE",
        "Accept": "application/json",
        "project": "64d9fa1b014ae7130f2e58d1"
      }
    }
  );

  const data = await res.json();
  const tickets = data.tickets || [];

  const tbody = document.getElementById("archivedRows");
  tbody.innerHTML = "";

  tickets.forEach(t => {
    const agent = t.processingUser || {};
    const fullName =
      `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || agent.email;

    const d = new Date(t.archivedAt);
    const dateIST = d.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
    const timeIST = d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false
    });

    tbody.innerHTML += `
      <tr>
        <td>${fullName}</td>
        <td>${t.id}</td>
        <td>${t.totalCount || "-"}</td>
        <td>${dateIST}</td>
        <td>${timeIST}</td>
      </tr>
    `;
  });
}

/* ---------------------------
   INITIAL LOAD
---------------------------- */
loadAll();
loadArchived();

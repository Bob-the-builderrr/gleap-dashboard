async function load() {
  // Fetch from Vercel API
  const res = await fetch("https://gleap-dashboard.vercel.app/api/agents");
  const data = await res.json();

  // Rows that actually have a ticket
  const valid = data.filter(r => r.ticket_id && r.ticket_id !== "-");

  // ---------- TOTAL TICKETS (sum of open tickets) ----------
  const totalTickets = valid.reduce(
    (sum, r) => sum + Number(r.agent_open_ticket || 0),
    0
  );
  document.getElementById("totalTickets").innerText = totalTickets;

  // ---------- PLAN BREAKDOWN (weighted by open tickets) ----------
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

  // ---------- TABLE (valid rows first, then empty ones) ----------
  const empty = data.filter(r => !r.ticket_id || r.ticket_id === "-");
  const ordered = [...valid, ...empty];

  const tbody = document.getElementById("ticketRows");
  tbody.innerHTML = "";

  ordered.forEach(r => {
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

load();

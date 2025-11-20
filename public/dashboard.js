async function load() {
  const res = await fetch("https://gleap-dashboard.vercel.app/api/agents");
  const data = await res.json();

  // Filter only valid tickets
  const valid = data.filter(r => r.ticket_id && r.ticket_id !== "-");

  // ----------------------------------------------------------
  // TOTAL OPEN TICKETS
  // ----------------------------------------------------------
  document.getElementById("totalTickets").innerText = valid.length;

  // ----------------------------------------------------------
  // PLAN BREAKDOWN
  // ----------------------------------------------------------
  const plan = {};
  valid.forEach(r => {
    plan[r.plan_type] = (plan[r.plan_type] || 0) + 1;
  });

  const planDiv = document.getElementById("planBreakdown");
  planDiv.innerHTML = "";

  Object.entries(plan).forEach(([p, count]) => {
    planDiv.innerHTML += `<p><strong>${p}</strong>: ${count}</p>`;
  });

  // ----------------------------------------------------------
  // TABLE POPULATION
  // ----------------------------------------------------------
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

load();

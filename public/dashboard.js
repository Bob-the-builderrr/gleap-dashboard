async function loadDashboard() {
  const res = await fetch("/api/agents");
  const data = await res.json();

  // Count valid tickets (exclude placeholder "-")
  const valid = data.filter(r => r.ticket_id && r.ticket_id !== "-");

  // Total Tickets
  document.getElementById("totalTickets").innerText = valid.length;

  // Plan type counts
  const planCounts = {};
  valid.forEach(r => {
    planCounts[r.plan_type] = (planCounts[r.plan_type] || 0) + 1;
  });

  // Render plan counts
  const planDiv = document.getElementById("planBreakdown");
  planDiv.innerHTML = "";
  Object.entries(planCounts).forEach(([k, v]) => {
    planDiv.innerHTML += `<p>${k}: ${v}</p>`;
  });

  // Render table
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

loadDashboard();

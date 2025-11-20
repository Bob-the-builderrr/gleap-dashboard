async function load() {
  const res = await fetch("/api/agents");
  const data = await res.json();

  const valid = data.filter(r => r.ticket_id !== "-");

  document.getElementById("totalTickets").innerText = valid.length;

  const plan = {};
  valid.forEach(r => {
    plan[r.plan_type] = (plan[r.plan_type] || 0) + 1;
  });

  const planDiv = document.getElementById("planBreakdown");
  planDiv.innerHTML = "";
  Object.entries(plan).forEach(([k,v]) => {
    planDiv.innerHTML += `<p>${k}: ${v}</p>`;
  });

  const tbody = document.getElementById("ticketRows");
  tbody.innerHTML = "";

  data.forEach(r => {
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

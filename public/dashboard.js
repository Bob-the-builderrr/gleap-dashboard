async function load() {
  const res = await fetch("https://gleap-dashboard.vercel.app/api/agents");
  const data = await res.json();

  // Total open tickets
  document.getElementById("totalTickets").innerText = data.length;

  // Breakdown by plan
  const planCounts = {};
  data.forEach(t => {
    planCounts[t.Plan_Type] = (planCounts[t.Plan_Type] || 0) + 1;
  });

  const planDiv = document.getElementById("planBreakdown");
  planDiv.innerHTML = "";
  Object.entries(planCounts).forEach(([p, c]) => {
    planDiv.innerHTML += `<p>${p}: ${c}</p>`;
  });

  // Table
  const tbody = document.getElementById("ticketRows");
  tbody.innerHTML = "";

  data.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.Agent_Name}</td>
        <td>${r.Agent_Open_Ticket}</td>
        <td>${r.Priority}</td>
        <td>${r.Ticket_Status}</td>
        <td>${r.Time_Open_Duration}</td>
        <td>${r.User_Email}</td>
        <td>${r.Plan_Type}</td>
        <td>${r.Tags}</td>
      </tr>
    `;
  });
}

load();

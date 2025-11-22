const API_URL = "/api/team-performance"; // Vercel serverless function

document.getElementById("loadBtn").addEventListener("click", loadReport);

async function loadReport() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (!start || !end) {
    alert("Please select start and end date");
    return;
  }

  const loading = document.getElementById("loading");
  loading.classList.remove("hidden");

  const tbody = document.querySelector("#performanceTable tbody");
  tbody.innerHTML = "";

  try {
    const res = await fetch(`${API_URL}?startDate=${start}&endDate=${end}`);

    const data = await res.json();

    loading.classList.add("hidden");

    if (!data.agents || data.agents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11">No data found</td></tr>`;
      return;
    }

    data.agents.forEach(agent => {
      const row = `
        <tr>
          <td>
            <strong>${agent.agent_name}</strong><br/>
            <span style="font-size:12px;color:#666">${agent.agent_email}</span>
          </td>
          <td>${agent.total_tickets}</td>
          <td>${agent.comments_count}</td>
          <td>${agent.closed_tickets}</td>
          <td>${agent.median_reply_time}</td>
          <td>${agent.median_first_reply}</td>
          <td>${agent.median_assignment_reply}</td>
          <td>${agent.time_to_last_close}</td>
          <td>${agent.average_rating}</td>
          <td>${agent.ticket_activity}</td>
          <td>${agent.hours_active}</td>
        </tr>
      `;
      tbody.insertAdjacentHTML("beforeend", row);
    });

  } catch (error) {
    console.error("Error loading report:", error);
    loading.classList.add("hidden");
    alert("Failed to load data");
  }
}

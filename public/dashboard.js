let agentsData = [];
let currentSort = { key: "tickets", direction: "desc" };

async function fetchData(start, end) {
  const res = await fetch(`${window.location.origin}/api/team-performance?startDate=${start}&endDate=${end}`);
  const data = await res.json();

  if (!data || !data.agents) {
    alert("No data received.");
    return;
  }

  agentsData = data.agents;
  updateSummary(data.totals);
  renderTable();
}

function updateSummary(totals) {
  document.querySelector("#totalTickets span").textContent = totals.totalTickets;
  document.querySelector("#averageRating span").textContent = totals.avgRating.toFixed(1);
  document.querySelector("#totalAgents span").textContent = totals.totalAgents;
}

function renderTable() {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  const sorted = [...agentsData].sort((a, b) => {
    const key = currentSort.key;
    const dir = currentSort.direction === "asc" ? 1 : -1;
    return (a[key] > b[key] ? 1 : -1) * dir;
  });

  sorted.forEach(a => {
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${a.name}</td>
        <td>${a.tickets}</td>
        <td>${a.comments}</td>
        <td>${a.closed}</td>
        <td>${a.median_reply}</td>
        <td>${a.first_reply}</td>
        <td>${a.assign_reply}</td>
        <td>${a.last_close}</td>
        <td>${a.rating}</td>
        <td>${a.activity}</td>
        <td>${a.hours_active}</td>
      </tr>
    `);
  });
}

// Sorting by clicking table headers
document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-sort");
    currentSort.direction = currentSort.key === key && currentSort.direction === "asc" ? "desc" : "asc";
    currentSort.key = key;
    renderTable();
  });
});

function getISTtoUTC(istDate) {
  const date = new Date(istDate);
  return new Date(date.getTime() - (5.5 * 60 * 60 * 1000)).toISOString();
}

document.querySelectorAll(".quick button").forEach(btn => {
  btn.addEventListener("click", () => {
    const hours = parseInt(btn.dataset.hours);
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    fetchData(start.toISOString(), end.toISOString());
  });
});

document.getElementById("fetchBtn").addEventListener("click", () => {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  if (!start || !end) {
    alert("Please select both start and end datetime");
    return;
  }
  fetchData(getISTtoUTC(start), getISTtoUTC(end));
});

window.addEventListener("load", () => {
  const end = new Date();
  const start = new Date(end.getTime() - 4 * 60 * 60 * 1000);
  fetchData(start.toISOString(), end.toISOString());
});

async function fetchData(start, end) {
  const res = await fetch(`/api/team-performance?startDate=${start}&endDate=${end}`);
  const data = await res.json();
  renderTable(data.agents);
}

function renderTable(agents) {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  agents.forEach(a => {
    const row = `<tr>
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
    </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

function getISTtoUTC(istDate) {
  const date = new Date(istDate);
  return new Date(date.getTime() - (5.5 * 60 * 60 * 1000)).toISOString();
}

// Quick time buttons
document.querySelectorAll(".quick button").forEach(btn => {
  btn.addEventListener("click", () => {
    const hours = parseInt(btn.dataset.hours);
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    fetchData(start.toISOString(), end.toISOString());
  });
});

// Manual fetch
document.getElementById("fetchBtn").addEventListener("click", () => {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  if (!start || !end) {
    alert("Please select both start and end datetime");
    return;
  }
  fetchData(getISTtoUTC(start), getISTtoUTC(end));
});

// Auto load 4h by default
window.addEventListener("load", () => {
  const end = new Date();
  const start = new Date(end.getTime() - 4 * 60 * 60 * 1000);
  fetchData(start.toISOString(), end.toISOString());
});

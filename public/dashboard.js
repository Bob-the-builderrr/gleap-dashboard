<!DOCTYPE html>
<html>
<head>
  <title>Gleap Ticket Dashboard</title>
  <link rel="stylesheet" href="style.css">
</head>

<body>

<h1>Gleap Live Ticket Dashboard</h1>

<div class="summary">
  <div class="box">
    <h2>Total Open Tickets</h2>
    <p id="totalTickets">0</p>
  </div>

  <div class="box">
    <h2>Tickets by Plan</h2>
    <div id="planBreakdown"></div>
  </div>
</div>

<div class="tableBox">
  <table>
    <thead>
      <tr>
        <th>Agent</th>
        <th>Open Tickets</th>
        <th>Priority</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Email</th>
        <th>Plan</th>
        <th>Tags</th>
      </tr>
    </thead>
    <tbody id="ticketRows"></tbody>
  </table>
</div>

<script src="dashboard.js"></script>
</body>
</html>

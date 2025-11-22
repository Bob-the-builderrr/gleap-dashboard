import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { window = '30m' } = req.query;
    
    // Calculate time window in minutes
    let minutes = 30;
    if (window === '1h') minutes = 60;
    if (window === '2h') minutes = 120;

    const response = await fetch('https://dashapi.gleap.io/v3/tickets?skip=0&limit=1000&filter={}&sort=-lastNotification&ignoreArchived=true&isSpam=false&type[]=INQUIRY&archived=true', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE',
        'Accept': 'application/json',
        'project': '64d9fa1b014ae7130f2e58d1'
      }
    });

    if (!response.ok) {
      throw new Error(`Gleap API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const tickets = data.tickets || [];

    // Calculate cutoff time based on selected window
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    // First Pass: Calculate Total Counts per Agent within time window
    const agentCounts = {};
    tickets.forEach(ticket => {
      const agent = ticket.processingUser;
      if (!agent || !agent.email) return;
      if (!ticket.archivedAt) return;

      const archivedAt = new Date(ticket.archivedAt);
      if (archivedAt < cutoffTime) return;

      const email = agent.email;
      agentCounts[email] = (agentCounts[email] || 0) + 1;
    });

    // Second Pass: Generate Output Rows
    const result = [];
    tickets.forEach(ticket => {
      const agent = ticket.processingUser;
      if (!agent || !agent.email) return;
      if (!ticket.archivedAt) return;

      const archivedAt = new Date(ticket.archivedAt);
      if (archivedAt < cutoffTime) return;

      const ticketDateIST = archivedAt.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
      const ticketTimeIST = archivedAt.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      const email = agent.email;
      const firstName = agent.firstName || '';
      const lastName = agent.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();

      result.push({
        agent_name: fullName || email,
        agent_email: email,
        ticket_id: ticket.id,
        total_count: agentCounts[email],
        archived_date_ist: ticketDateIST,
        archived_time_ist: ticketTimeIST
      });
    });

    // Sort by total count (descending)
    result.sort((a, b) => b.total_count - a.total_count);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(result);

  } catch (error) {
    console.error('Error in archived-tickets API:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
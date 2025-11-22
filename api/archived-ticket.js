import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { window = '30m' } = req.query;
    
    // Calculate time window in minutes
    let minutes = 30;
    if (window === '1h') minutes = 60;
    if (window === '2h') minutes = 120;

    const response = await fetch(`https://dashapi.gleap.io/v3/tickets?skip=0&limit=1000&filter={}&sort=-lastNotification&ignoreArchived=true&isSpam=false&type[]=INQUIRY&archived=true`, {
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

    // Calculate cutoff time in IST
    const now = new Date();
    const nowIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const cutoffTime = new Date(nowIST.getTime() - minutes * 60 * 1000);

    console.log(`Filtering archived tickets - Current IST: ${nowIST}, Cutoff: ${cutoffTime}, Window: ${minutes} minutes`);

    // First Pass: Calculate Total Counts per Agent within time window
    const agentCounts = {};
    const filteredTickets = tickets.filter(ticket => {
      if (!ticket.processingUser || !ticket.processingUser.email) return false;
      if (!ticket.archivedAt) return false;

      const archivedAt = new Date(ticket.archivedAt);
      const archivedAtIST = new Date(archivedAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      
      return archivedAtIST >= cutoffTime;
    });

    filteredTickets.forEach(ticket => {
      const email = ticket.processingUser.email;
      agentCounts[email] = (agentCounts[email] || 0) + 1;
    });

    // Second Pass: Generate Output Rows
    const result = [];
    filteredTickets.forEach(ticket => {
      const agent = ticket.processingUser;
      const archivedAt = new Date(ticket.archivedAt);
      const archivedAtIST = new Date(archivedAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

      const ticketDateIST = archivedAtIST.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
      const ticketTimeIST = archivedAtIST.toLocaleTimeString("en-US", {
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

    console.log(`Found ${result.length} archived tickets in the last ${minutes} minutes`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(result);

  } catch (error) {
    console.error('Error in archived-tickets API:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
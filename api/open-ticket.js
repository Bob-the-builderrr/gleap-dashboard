import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const response = await fetch('https://dashapi.gleap.io/v3/tickets?type=INQUIRY&status=OPEN&skip=0&limit=200&filter={}&sort=-lastNotification', {
      headers: {
        'accept': 'application/json',
        'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE',
        'project': '64d9fa1b014ae7130f2e58d1'
      }
    });

    if (!response.ok) {
      throw new Error(`Gleap API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const tickets = data.tickets || [];

    // Helper functions from your n8n code
    function utcToISTDate(utcString) {
      if (!utcString) return null;
      return new Date(new Date(utcString).getTime() + (5.5 * 60 * 60 * 1000));
    }

    function formatIST(dateObj) {
      if (!dateObj) return "";
      return dateObj.toISOString().replace("Z", "+05:30");
    }

    function formatDuration(ms) {
      if (!ms || ms < 0) return "";
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days} days ${hours % 24} hours`;
      if (hours > 0) return `${hours} hours ${minutes % 60} minutes`;
      return `${minutes} minutes`;
    }

    // Build clean rows from tickets
    const rows = tickets.map(ticket => {
      const agentName = ticket.processingUser?.firstName
        ? `${ticket.processingUser.firstName} ${ticket.processingUser.lastName || ""}`.trim()
        : "UNASSIGNED";
      const agentEmail = ticket.processingUser?.email || "";

      const plan = ticket.session?.plan || "UNKNOWN_PLAN";
      const userEmail = ticket.session?.email || "";
      const userName = ticket.session?.name || "";
      const tags = ticket.tags?.join(", ") || "";

      const createdAtIST = utcToISTDate(ticket.createdAt);
      const updatedAtIST = utcToISTDate(ticket.updatedAt);
      const latestCommentIST = utcToISTDate(ticket.latestComment?.createdAt);

      const referenceDate = latestCommentIST || updatedAtIST || createdAtIST;
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const durationMs = nowIST - referenceDate;
      const timeOpen = formatDuration(durationMs);

      return {
        id: ticket.id,
        ticket_id: ticket.id,
        agent_name: agentName,
        agent_email: agentEmail,
        ticket_status: ticket.status || "",
        ticket_type: ticket.type || "",
        priority: ticket.priority || "",
        plan_type: plan,
        user_email: userEmail,
        user_name: userName,
        updated_at: formatIST(updatedAtIST),
        sla_breached: ticket.slaBreached || false,
        has_agent_reply: ticket.hasAgentReply || false,
        tags: tags,
        latest_comment_created_at: formatIST(latestCommentIST),
        time_open_duration: timeOpen
      };
    });

    // Count tickets per agent
    const agentCount = {};
    rows.forEach(r => {
      agentCount[r.agent_name] = (agentCount[r.agent_name] || 0) + 1;
    });

    // Add Agent_Open_Ticket count to each row
    let finalRows = rows.map(r => ({
      ...r,
      agent_open_ticket: agentCount[r.agent_name]
    }));

    // Sort by most overloaded → least overloaded agent
    finalRows.sort((a, b) => b.agent_open_ticket - a.agent_open_ticket);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(finalRows);

  } catch (error) {
    console.error('Error in open-tickets API:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
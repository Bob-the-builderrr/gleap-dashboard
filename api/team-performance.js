import fetch from "node-fetch";

// Convert seconds into hours/minutes
function formatTime(seconds) {
  if (!seconds || seconds === "--" || seconds === null || seconds === 0) return "--";
  const mins = Math.round(seconds / 60);
  const hours = Math.floor(mins / 60);
  const remainingMinutes = mins % 60;
  if (hours > 0 && remainingMinutes > 0) return `${hours}h ${remainingMinutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// Convert IST date/time to UTC ISO string
function toUTC(dateString) {
  const date = new Date(dateString);
  return date.toISOString();
}

export default async function handler(req, res) {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    const startUTC = toUTC(startDate);
    const endUTC = toUTC(endDate);

    const url = `https://dashapi.gleap.io/v3/statistics/lists?chartType=TEAM_PERFORMANCE_LIST&startDate=${startUTC}&endDate=${endUTC}&useWorkingHours=false&team=66595e93b58fb2a1e6b8a83f&aggsType=MEDIAN`;

    const response = await fetch(url, {
      headers: {
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE",
        "project": "64d9fa1b014ae7130f2e58d1"
      }
    });

    if (!response.ok) throw new Error(`Gleap API responded with ${response.status}`);

    const data = await response.json();
    const agents = (data.data || []).map((agent) => {
      const u = agent.processingUser || {};
      const m = agent;
      return {
        name: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email || "Unknown",
        email: u.email || "",
        tickets: m.totalCountForUser?.value || 0,
        comments: m.commentCount?.value || 0,
        closed: m.rawClosed?.value || 0,
        median_reply: formatTime(m.medianReplyTime?.rawValue),
        first_reply: formatTime(m.medianTimeToFirstReplyInSec?.rawValue),
        assign_reply: formatTime(m.medianFirstAssignmentReplyTime?.rawValue),
        last_close: formatTime(m.timeToLastCloseInSec?.rawValue),
        rating: m.averageRating?.value || "--",
        activity: m.ticketActivityCount?.value || 0,
        hours_active: m.hoursActive?.value || "--"
      };
    });

    const totals = {
      totalAgents: agents.length,
      totalTickets: agents.reduce((a, b) => a + b.tickets, 0),
      avgRating:
        agents.filter((a) => a.rating !== "--").reduce((a, b) => a + Number(b.rating || 0), 0) /
        (agents.filter((a) => a.rating !== "--").length || 1)
    };

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ startDate: startUTC, endDate: endUTC, totals, agents });
  } catch (err) {
    console.error("API Error:", err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ error: "Failed to fetch team performance", details: err.message });
  }
}

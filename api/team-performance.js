import fetch from "node-fetch";

// Convert seconds to "Xm" or "Y.Yh"
function formatDuration(rawSeconds) {
  if (rawSeconds === null || rawSeconds === undefined) return "--";
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";

  const minutes = seconds / 60;
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours.toFixed(1)}h`;
  }
  return `${Math.round(minutes)}m`;
}

// Map Gleap agent record into clean object for UI
function mapAgent(agent) {
  const u = agent.processingUser || {};
  const m = agent;

  const avgRatingStr = m.averageRating?.value || "--";
  let ratingScore = null;
  if (typeof avgRatingStr === "string") {
    const match = avgRatingStr.match(/(\d+(\.\d+)?)/);
    ratingScore = match ? parseFloat(match[1]) : null;
  }

  return {
    agent_name:
      u.firstName && u.lastName
        ? `${u.firstName} ${u.lastName}`
        : u.email || "Unknown",
    agent_email: u.email || "",
    profile_image: u.profileImageUrl || "",

    total_tickets: m.totalCountForUser?.value ?? 0,
    // comments_count: m.commentCount?.value ?? 0, // you said you do not need this
    closed_tickets: m.rawClosed?.value ?? 0,

    median_reply_time: formatDuration(m.medianReplyTime?.rawValue),
    median_first_reply: formatDuration(m.medianTimeToFirstReplyInSec?.rawValue),
    median_assignment_reply:
      m.medianFirstAssignmentReplyTime?.value === "--"
        ? "--"
        : formatDuration(m.medianFirstAssignmentReplyTime?.rawValue),
    time_to_last_close: formatDuration(m.timeToLastCloseInSec?.rawValue),

    average_rating: avgRatingStr,
    rating_score: ratingScore,
    ticket_activity: m.ticketActivityCount?.value ?? 0,
    hours_active: m.hoursActive?.value || "--"
  };
}

export default async function handler(req, res) {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate query params are required" });
    }

    // Backend trusts the UTC timestamps from frontend
    const url =
      "https://dashapi.gleap.io/v3/statistics/lists" +
      `?chartType=TEAM_PERFORMANCE_LIST` +
      `&startDate=${encodeURIComponent(startDate)}` +
      `&endDate=${encodeURIComponent(endDate)}` +
      `&useWorkingHours=false` +
      `&team=66595e93b58fb2a1e6b8a83f` +
      `&aggsType=MEDIAN`;

    const response = await fetch(url, {
      headers: {
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE",
        project: "64d9fa1b014ae7130f2e58d1"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Gleap error:", response.status, text);
      return res.status(500).json({
        error: "Gleap API error",
        status: response.status,
        body: text
      });
    }

    const raw = await response.json();
    const arr = raw?.data || raw?.list || [];

    const agents = Array.isArray(arr) ? arr.map(mapAgent) : [];

    // Totals for summary cards
    const totalAgents = agents.length;
    const totalTickets = agents.reduce(
      (sum, a) => sum + (Number(a.total_tickets) || 0),
      0
    );
    const ratings = agents
      .map(a => a.rating_score)
      .filter(v => typeof v === "number" && !Number.isNaN(v));
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((sum, v) => sum + v, 0) / ratings.length
        : 0;

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({
      startDate,
      endDate,
      totals: {
        total_agents: totalAgents,
        total_tickets: totalTickets,
        avg_rating: avgRating
      },
      agents
    });
  } catch (err) {
    console.error("team-performance API error:", err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: "Failed to fetch team performance",
      details: err.message
    });
  }
}

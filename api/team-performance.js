import fetch from "node-fetch";

// Enhanced duration formatting with better validation
function formatDuration(rawSeconds) {
  if (rawSeconds === null || rawSeconds === undefined || rawSeconds === "--") return "--";
  
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";

  const minutes = seconds / 60;
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours.toFixed(1)}h`;
  }
  return `${Math.round(minutes)}m`;
}

// Enhanced agent mapping with better data validation
function mapAgent(agent) {
  const u = agent.processingUser || {};
  const m = agent;

  // Validate agent data
  if (!u.email && (!u.firstName || !u.lastName)) {
    return null; // Skip invalid agents
  }

  const avgRatingStr = m.averageRating?.value || "--";
  let ratingScore = null;
  
  if (typeof avgRatingStr === "string" && avgRatingStr !== "--") {
    const match = avgRatingStr.match(/(\d+(\.\d+)?)/);
    ratingScore = match ? parseFloat(match[1]) : null;
  }

  const agentData = {
    agent_name:
      u.firstName && u.lastName
        ? `${u.firstName} ${u.lastName}`
        : u.email || "Unknown",
    agent_email: u.email || "",
    profile_image: u.profileImageUrl || "",

    total_tickets: m.totalCountForUser?.value ?? 0,
    closed_tickets: m.rawClosed?.value ?? 0,

    median_reply_time: formatDuration(m.medianReplyTime?.rawValue),
    median_reply_seconds: m.medianReplyTime?.rawValue || 0,
    
    median_first_reply: formatDuration(m.medianTimeToFirstReplyInSec?.rawValue),
    median_first_reply_seconds: m.medianTimeToFirstReplyInSec?.rawValue || 0,
    
    median_assignment_reply: 
      m.medianFirstAssignmentReplyTime?.value === "--"
        ? "--"
        : formatDuration(m.medianFirstAssignmentReplyTime?.rawValue),
    median_assignment_reply_seconds: m.medianFirstAssignmentReplyTime?.rawValue || 0,
    
    time_to_last_close: formatDuration(m.timeToLastCloseInSec?.rawValue),
    time_to_last_close_seconds: m.timeToLastCloseInSec?.rawValue || 0,

    average_rating: avgRatingStr,
    rating_score: ratingScore,
    ticket_activity: m.ticketActivityCount?.value ?? 0,
    hours_active: m.hoursActive?.value || "--"
  };

  // Additional validation - skip agents with no activity
  if (agentData.total_tickets === 0 && agentData.ticket_activity === 0) {
    return null;
  }

  return agentData;
}

// Calculate additional metrics for summary
function calculateEnhancedMetrics(agents) {
  const validAgents = agents.filter(agent => agent !== null);
  
  const totalTickets = validAgents.reduce((sum, a) => sum + (Number(a.total_tickets) || 0), 0);
  const totalAgents = validAgents.length;
  
  // Calculate average rating
  const ratings = validAgents
    .map(a => a.rating_score)
    .filter(v => typeof v === "number" && !Number.isNaN(v) && v > 0);
  const avgRating = ratings.length > 0 ? ratings.reduce((sum, v) => sum + v, 0) / ratings.length : 0;

  // Calculate average response time
  const replyTimes = validAgents
    .map(a => a.median_reply_seconds)
    .filter(v => v > 0);
  const avgResponseTime = replyTimes.length > 0 ? replyTimes.reduce((sum, v) => sum + v, 0) / replyTimes.length : 0;

  return {
    total_agents: totalAgents,
    total_tickets: totalTickets,
    avg_rating: avgRating,
    avg_response_time: formatDuration(avgResponseTime)
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

    // Validate date parameters
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    if (start >= end) {
      return res.status(400).json({ error: "Start date must be before end date" });
    }

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
      },
      timeout: 25000
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Gleap API error:", response.status, text);
      return res.status(500).json({
        error: "Gleap API error",
        status: response.status,
        body: text
      });
    }

    const raw = await response.json();
    const arr = raw?.data || raw?.list || [];

    // Map and filter agents
    const agents = (Array.isArray(arr) ? arr.map(mapAgent) : [])
      .filter(agent => agent !== null)
      .filter(agent => agent.agent_name !== "Unknown")
      .filter(agent => agent.total_tickets > 0);

    // Calculate enhanced metrics
    const totals = calculateEnhancedMetrics(agents);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    return res.status(200).json({
      startDate,
      endDate,
      totals,
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
import fetch from "node-fetch";

// Convert raw time + unit from Gleap into readable string
// Rules:
// - If less than 60 minutes: "Xm"
// - If 60+ minutes: show hours with 1 decimal, like "2.5h"
function formatTime(raw, unit) {
  if (!raw || raw === "--" || raw === null) return "--";

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return "--";

  let minutes;

  const u = (unit || "").toLowerCase();
  if (u === "s" || u === "sec" || u === "seconds") {
    minutes = value / 60;
  } else if (u === "m" || u === "min" || u === "minutes") {
    minutes = value;
  } else if (u === "h" || u === "hr" || u === "hours") {
    minutes = value * 60;
  } else {
    // Fallback: assume seconds
    minutes = value / 60;
  }

  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }

  const hoursDecimal = minutes / 60;
  const rounded = Math.round(hoursDecimal * 10) / 10; // 1 decimal
  return `${rounded}h`;
}

export default async function handler(req, res) {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate query params are required (UTC ISO strings)" });
    }

    // We expect startDate/endDate to already be UTC ISO strings from the frontend.
    const gleapUrl =
      `https://dashapi.gleap.io/v3/statistics/lists` +
      `?chartType=TEAM_PERFORMANCE_LIST` +
      `&startDate=${encodeURIComponent(startDate)}` +
      `&endDate=${encodeURIComponent(endDate)}` +
      `&useWorkingHours=false` +
      `&team=66595e93b58fb2a1e6b8a83f` +
      `&aggsType=MEDIAN`;

    const response = await fetch(gleapUrl, {
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
    const teamData = raw?.data || [];

    // Transform into clean agent list
    const agents = teamData.map((agent) => {
      const user = agent.processingUser || {};
      const metrics = agent;

      const avgVal = metrics.averageRating?.value ?? null;
      const avgDisplay = metrics.averageRating?.displayValue ?? null;

      return {
        agent_name:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.email || "Unknown Agent",
        agent_email: user.email || "",
        profile_image: user.profileImageUrl || "",

        total_tickets: metrics.totalCountForUser?.value || 0,
        comments_count: metrics.commentCount?.value || 0,
        closed_tickets: metrics.rawClosed?.value || 0,

        median_reply_time: formatTime(
          metrics.medianReplyTime?.rawValue,
          metrics.medianReplyTime?.valueUnit
        ),
        median_first_reply: formatTime(
          metrics.medianTimeToFirstReplyInSec?.rawValue,
          metrics.medianTimeToFirstReplyInSec?.valueUnit
        ),
        median_assignment_reply: formatTime(
          metrics.medianFirstAssignmentReplyTime?.rawValue,
          metrics.medianFirstAssignmentReplyTime?.valueUnit
        ),
        time_to_last_close: formatTime(
          metrics.timeToLastCloseInSec?.rawValue,
          metrics.timeToLastCloseInSec?.valueUnit
        ),

        average_rating: avgDisplay || (avgVal !== null ? String(avgVal) : "--"),
        average_rating_value: typeof avgVal === "number" ? avgVal : null,

        ticket_activity: metrics.ticketActivityCount?.value || 0,
        hours_active: metrics.hoursActive?.value || "--"
      };
    });

    // Totals
    const total_tickets = agents.reduce((sum, a) => sum + (a.total_tickets || 0), 0);
    const ratingValues = agents
      .map((a) => a.average_rating_value)
      .filter((v) => typeof v === "number");
    const average_rating =
      ratingValues.length > 0
        ? ratingValues.reduce((sum, v) => sum + v, 0) / ratingValues.length
        : null;

    const result = {
      date_range: { start: startDate, end: endDate },
      totals: {
        total_tickets,
        total_agents: agents.length,
        average_rating
      },
      agents,
      fetched_at: new Date().toISOString()
    };

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(result);
  } catch (err) {
    console.error("team-performance error:", err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: "Failed to fetch team performance",
      details: err.message
    });
  }
}

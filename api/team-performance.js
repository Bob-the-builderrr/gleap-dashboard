// api/team-performance.js
import fetch from "node-fetch";

// Convert raw seconds to "Xm" or "Y.h" format
function formatDuration(rawSeconds) {
  if (!rawSeconds && rawSeconds !== 0) return "--";
  const seconds = Number(rawSeconds);
  if (Number.isNaN(seconds) || seconds <= 0) return "--";

  const minutes = seconds / 60;
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours.toFixed(1)}h`;
  }
  return `${minutes.toFixed(1)}m`;
}

// Extract numeric rating from "😊 86" => 86
function parseRating(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1]);
}

export default async function handler(req, res) {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "startDate and endDate are required in UTC ISO format",
      });
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
        project: "64d9fa1b014ae7130f2e58d1",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Gleap error:", response.status, text);
      return res.status(response.status).json({
        error: "Gleap API error",
        status: response.status,
        body: text,
      });
    }

    const raw = await response.json();
    const list = Array.isArray(raw?.data) ? raw.data : [];

    // Map and filter out "Unknown" / no-user rows
    const agents = list
      .map((item) => {
        const user = item.processingUser || {};
        const hasIdentity =
          !!user.email || !!user.firstName || !!user.lastName;

        if (!hasIdentity) return null; // skip "Unknown" rows

        const agentName =
          (user.firstName || "") + " " + (user.lastName || "");
        const trimmedName = agentName.trim() || user.email || "Unknown";

        const totalTickets = item.totalCountForUser?.value || 0;

        const medianReplyTime = formatDuration(
          item.medianReplyTime?.rawValue ?? null
        );
        const medianFirstReply = formatDuration(
          item.medianTimeToFirstReplyInSec?.rawValue ?? null
        );
        const medianAssignmentReply = formatDuration(
          item.medianFirstAssignmentReplyTime?.rawValue ?? null
        );
        const timeToLastClose = formatDuration(
          item.timeToLastCloseInSec?.rawValue ?? null
        );

        const averageRatingStr = item.averageRating?.value || "--";
        const ratingNumeric = parseRating(averageRatingStr);

        return {
          agent_name: trimmedName,
          agent_email: user.email || "",
          profile_image: user.profileImageUrl || "",
          total_tickets: totalTickets,
          closed_tickets: item.rawClosed?.value || 0,
          median_reply_time: medianReplyTime,
          median_first_reply: medianFirstReply,
          median_assignment_reply: medianAssignmentReply,
          time_to_last_close: timeToLastClose,
          average_rating: averageRatingStr,
          rating_numeric: ratingNumeric,
          ticket_activity: item.ticketActivityCount?.value || 0,
          hours_active: item.hoursActive?.value || "--",
        };
      })
      .filter((a) => a !== null);

    // Totals
    const totalAgents = agents.length;
    const totalTickets = agents.reduce(
      (sum, a) => sum + (a.total_tickets || 0),
      0
    );

    const ratingValues = agents
      .map((a) => a.rating_numeric)
      .filter((n) => typeof n === "number");
    const avgRating =
      ratingValues.length > 0
        ? ratingValues.reduce((s, n) => s + n, 0) / ratingValues.length
        : 0;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      startDate,
      endDate,
      totals: {
        total_agents: totalAgents,
        total_tickets: totalTickets,
        avg_rating: avgRating,
      },
      agents,
    });
  } catch (err) {
    console.error("team-performance API error:", err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      error: "Failed to fetch team performance",
      details: err.message,
    });
  }
}

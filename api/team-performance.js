import fetch from "node-fetch";

const IST_OFFSET_MINUTES = 330; // +05:30
const TEAM_ID = "66595e93b58fb2a1e6b8a83f";
const PROJECT_ID = process.env.GLEAP_PROJECT_ID || "64d9fa1b014ae7130f2e58d1";
const ISO_WITH_TZ = /([zZ]|[+-]\d{2}:?\d{2})$/;
const DEFAULT_GLEAP_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE";

function hasTimezone(value) {
  return ISO_WITH_TZ.test(value);
}

function istToUtcIso(datePart, timePart, isEndOfDay) {
  const [year, month, day] = (datePart || "").split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid date");

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let ms = 0;

  if (timePart) {
    const [h, m = "0", sRaw = "0"] = timePart.split(":");
    hours = Number(h);
    minutes = Number(m);

    if (String(sRaw).includes(".")) {
      const [s, msRaw] = String(sRaw).split(".");
      seconds = Number(s);
      ms = Number(msRaw.padEnd(3, "0").slice(0, 3));
    } else {
      seconds = Number(sRaw);
    }
  } else if (isEndOfDay) {
    hours = 23;
    minutes = 59;
    seconds = 59;
    ms = 999;
  }

  if (
    [hours, minutes, seconds, ms].some((v) => Number.isNaN(v)) ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    throw new Error("Invalid time");
  }

  const utcMs =
    Date.UTC(year, month - 1, day, hours, minutes, seconds, ms) -
    IST_OFFSET_MINUTES * 60 * 1000;
  const asDate = new Date(utcMs);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error("Invalid datetime");
  }
  return asDate.toISOString();
}

function normalizeToUtcIso(rawValue, isEndOfDay) {
  const value = (rawValue || "").trim();
  if (!value) throw new Error("startDate and endDate are required");

  if (hasTimezone(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date format");
    return parsed.toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return istToUtcIso(value, null, isEndOfDay);
  }

  const [datePart, timePart] = value.split(/[T\s]/).filter(Boolean);
  return istToUtcIso(datePart, timePart || null, isEndOfDay);
}

function parseRating(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const match = String(value).match(/(-?\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function formatDuration(rawValue, valueUnit) {
  if (rawValue === null || rawValue === undefined) return "--";
  const unit = (valueUnit || "").toLowerCase();
  const seconds = Number(rawValue);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";

  // Gleap delivers rawValue in seconds even when valueUnit is "min" or "h"
  const hours = unit === "min" ? seconds / 3600 : seconds / 3600;
  return `${hours.toFixed(1)}h`;
}

function formatHoursActive(rawValue, displayValue) {
  const numeric = Number(rawValue);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${(numeric / 3600).toFixed(1)}h`;
  }
  if (displayValue) return displayValue;
  return "--";
}

function transformAgent(item) {
  const user = item?.processingUser || {};
  const hasName = Boolean(user.firstName || user.lastName);
  const hasEmail = Boolean(user.email);
  if (!hasName && !hasEmail) return null;

  const nameFromUser = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const agentName = nameFromUser || item.processingUserREF || "";
  if (!agentName || agentName.toLowerCase() === "unknown") return null;

  return {
    agent_name: agentName,
    agent_email: user.email || "",
    profile_image: user.profileImageUrl || "",

    total_tickets: item.totalCountForUser?.value ?? 0,
    closed_tickets: item.rawClosed?.value ?? 0,

    median_reply_time: formatDuration(
      item.medianReplyTime?.rawValue,
      item.medianReplyTime?.valueUnit
    ),
    median_reply_seconds: item.medianReplyTime?.rawValue ?? 0,

    median_first_reply: formatDuration(
      item.medianTimeToFirstReplyInSec?.rawValue,
      item.medianTimeToFirstReplyInSec?.valueUnit
    ),
    median_first_reply_seconds: item.medianTimeToFirstReplyInSec?.rawValue ?? 0,

    median_assignment_reply: formatDuration(
      item.medianFirstAssignmentReplyTime?.rawValue,
      item.medianFirstAssignmentReplyTime?.valueUnit
    ),
    median_assignment_reply_seconds:
      item.medianFirstAssignmentReplyTime?.rawValue ?? 0,

    time_to_last_close: formatDuration(
      item.timeToLastCloseInSec?.rawValue,
      item.timeToLastCloseInSec?.valueUnit
    ),
    time_to_last_close_seconds: item.timeToLastCloseInSec?.rawValue ?? 0,

    average_rating: item.averageRating?.value ?? "--",
    rating_score: parseRating(item.averageRating?.value),
    ticket_activity: item.ticketActivityCount?.value ?? 0,
    hours_active: formatHoursActive(
      item.hoursActive?.rawValue,
      item.hoursActive?.value
    ),
  };
}

function computeTotals(agents) {
  const total_tickets = agents.reduce(
    (sum, a) => sum + (Number(a.total_tickets) || 0),
    0
  );
  const ratingValues = agents
    .map((a) => a.rating_score)
    .filter((v) => Number.isFinite(v));
  const avg_rating = ratingValues.length
    ? Number(
        (
          ratingValues.reduce((sum, v) => sum + v, 0) / ratingValues.length
        ).toFixed(1)
      )
    : null;

  return {
    total_tickets,
    avg_rating,
    total_agents: agents.length,
  };
}

function buildError(res, status, message) {
  return res.status(status).json({ error: message });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return buildError(res, 405, "Method not allowed");
  }

  try {
    const { startDate, endDate } = req.query;

    const startIso = normalizeToUtcIso(startDate, false);
    const endIso = normalizeToUtcIso(endDate, true);

    if (new Date(startIso) >= new Date(endIso)) {
      return buildError(res, 400, "startDate must be before endDate");
    }

    const token =
      process.env.GLEAP_TOKEN ||
      process.env.GLEAP_API_TOKEN ||
      process.env.GLEAP_DASH_TOKEN ||
      DEFAULT_GLEAP_TOKEN;
    const cleanedToken = token.startsWith("Bearer ")
      ? token.replace(/^Bearer\\s+/i, "")
      : token;
    if (!token) {
      return buildError(
        res,
        500,
        "GLEAP_TOKEN environment variable is missing on the server"
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const gleapUrl = new URL("https://dashapi.gleap.io/v3/statistics/lists");
    gleapUrl.searchParams.set("chartType", "TEAM_PERFORMANCE_LIST");
    gleapUrl.searchParams.set("startDate", startIso);
    gleapUrl.searchParams.set("endDate", endIso);
    gleapUrl.searchParams.set("useWorkingHours", "false");
    gleapUrl.searchParams.set("team", TEAM_ID);
    gleapUrl.searchParams.set("aggsType", "MEDIAN");

    const gleapRes = await fetch(gleapUrl.toString(), {
      headers: {
        Authorization: `Bearer ${cleanedToken}`,
        project: PROJECT_ID,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!gleapRes.ok) {
      const body = await gleapRes.text();
      console.error("Gleap API error", gleapRes.status, body);
      return buildError(res, 502, `Gleap API error (${gleapRes.status})`);
    }

    const payload = await gleapRes.json();
    const rawList = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.list)
      ? payload.list
      : [];

    const agents = rawList
      .map(transformAgent)
      .filter(Boolean)
      .sort(
        (a, b) =>
          (Number(b.total_tickets) || 0) - (Number(a.total_tickets) || 0)
      );

    const totals = computeTotals(agents);

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).json({
      date_range: { start: startIso, end: endIso },
      total_agents: totals.total_agents,
      totals: {
        total_tickets: totals.total_tickets,
        avg_rating: totals.avg_rating,
      },
      agents,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err?.message || "Unexpected error";
    const status = /invalid|required/i.test(message) ? 400 : 500;
    if (err.name === "AbortError") {
      return buildError(res, 504, "Request to Gleap timed out");
    }
    console.error("team-performance error", err);
    return buildError(res, status, message);
  }
}

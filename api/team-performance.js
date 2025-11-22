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
    last_seen_iso: user.lastSeen || null,

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

    const fetchGleapStats = async (startIso, endIso) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
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

        if (!gleapRes.ok) {
          const body = await gleapRes.text();
          console.error("Gleap API error", gleapRes.status, body);
          return { agents: [], totals: { total_tickets: 0, avg_rating: 0, total_agents: 0 } };
        }

        const payload = await gleapRes.json();
        const rawList = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.list)
            ? payload.list
            : [];

        const agents = rawList
          .map(transformAgent)
          .filter(Boolean);

        const totals = computeTotals(agents);
        return { agents, totals };
      } catch (err) {
        console.error("Fetch error", err);
        return { agents: [], totals: { total_tickets: 0, avg_rating: 0, total_agents: 0 } };
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const mergeResults = (resultsList) => {
      const agentMap = new Map();

      resultsList.forEach(res => {
        res.agents.forEach(agent => {
          const key = agent.agent_email || agent.agent_name;
          if (!agentMap.has(key)) {
            agentMap.set(key, { ...agent });
          } else {
            const existing = agentMap.get(key);
            existing.total_tickets = (Number(existing.total_tickets) || 0) + (Number(agent.total_tickets) || 0);
            existing.closed_tickets = (Number(existing.closed_tickets) || 0) + (Number(agent.closed_tickets) || 0);
            existing.ticket_activity = (Number(existing.ticket_activity) || 0) + (Number(agent.ticket_activity) || 0);

            if (agent.rating_score) {
              const oldRating = existing.rating_score || 0;
              const newRating = agent.rating_score;
              existing.rating_score = (oldRating + newRating) / 2;
              existing.average_rating = existing.rating_score.toFixed(1);
            }

            if (new Date(agent.last_seen_iso) > new Date(existing.last_seen_iso)) {
              existing.last_seen_iso = agent.last_seen_iso;
            }
          }
        });
      });

      const mergedAgents = Array.from(agentMap.values()).sort(
        (a, b) => (Number(b.total_tickets) || 0) - (Number(a.total_tickets) || 0)
      );

      return {
        agents: mergedAgents,
        totals: computeTotals(mergedAgents)
      };
    };

    // --- MAIN LOGIC: Calculate All Metrics in One Go ---

    const startIso = normalizeToUtcIso(startDate, false);
    const endIso = normalizeToUtcIso(endDate, true);

    if (new Date(startIso) >= new Date(endIso)) {
      return buildError(res, 400, "startDate must be before endDate");
    }

    // 1. Overview Data (Always fetch)
    const overviewPromise = fetchGleapStats(startIso, endIso);

    // 2. Shift Data (Always fetch)
    const shiftPromise = (async () => {
      const ranges = { morning: [], noon: [], night: [] };
      const addDays = (d, n) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);

      let ptr = new Date(startIso);
      const end = new Date(endIso);
      const MAX_DAYS = 60;
      let count = 0;

      while (ptr <= end && count < MAX_DAYS) {
        const istOffset = 330 * 60 * 1000;
        const istDate = new Date(ptr.getTime() + istOffset);
        const iy = istDate.getUTCFullYear();
        const im = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const id = String(istDate.getUTCDate()).padStart(2, '0');
        const iDateStr = `${iy}-${im}-${id}`;

        ranges.morning.push({
          start: istToUtcIso(iDateStr, "05:00", false),
          end: istToUtcIso(iDateStr, "14:00", false)
        });

        ranges.noon.push({
          start: istToUtcIso(iDateStr, "12:00", false),
          end: istToUtcIso(iDateStr, "21:00", false)
        });

        const nextDay = new Date(istDate.getTime() + 24 * 60 * 60 * 1000);
        const ny = nextDay.getUTCFullYear();
        const nm = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
        const nd = String(nextDay.getUTCDate()).padStart(2, '0');
        const nDateStr = `${ny}-${nm}-${nd}`;

        ranges.night.push({
          start: istToUtcIso(iDateStr, "20:00", false),
          end: istToUtcIso(nDateStr, "05:00", false)
        });

        ptr = addDays(ptr, 1);
        count++;
      }

      const results = {};
      await Promise.all(
        Object.entries(ranges).map(async ([key, list]) => {
          const chunkResults = [];
          const BATCH_SIZE = 10;
          for (let i = 0; i < list.length; i += BATCH_SIZE) {
            const batch = list.slice(i, i + BATCH_SIZE);
            const batchRes = await Promise.all(batch.map(r => fetchGleapStats(r.start, r.end)));
            chunkResults.push(...batchRes);
          }
          results[key] = mergeResults(chunkResults);
        })
      );
      return results;
    })();

    // 3. Hourly Data (Only if <= 7 days)
    const hourlyPromise = (async () => {
      const diffDays = (new Date(endIso) - new Date(startIso)) / (1000 * 3600 * 24);
      if (diffDays > 7) return null;

      const ranges = {};
      for (let h = 0; h < 24; h++) ranges[`h${h}`] = [];

      let ptr = new Date(startIso);
      const istOffset = 330 * 60 * 1000;

      while (ptr <= new Date(endIso)) {
        const istDate = new Date(ptr.getTime() + istOffset);
        const iy = istDate.getUTCFullYear();
        const im = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const id = String(istDate.getUTCDate()).padStart(2, '0');
        const iDateStr = `${iy}-${im}-${id}`;

        for (let h = 0; h < 24; h++) {
          const hStr = String(h).padStart(2, '0');
          ranges[`h${h}`].push({
            start: istToUtcIso(iDateStr, `${hStr}:00:00`, false),
            end: istToUtcIso(iDateStr, `${hStr}:59:59`, false)
          });
        }
        ptr = new Date(ptr.getTime() + 24 * 60 * 60 * 1000);
      }

      const results = {};
      await Promise.all(
        Object.entries(ranges).map(async ([key, list]) => {
          const chunkResults = [];
          for (let i = 0; i < list.length; i += 10) {
            const batch = list.slice(i, i + 10);
            const batchRes = await Promise.all(batch.map(r => fetchGleapStats(r.start, r.end)));
            chunkResults.push(...batchRes);
          }
          results[key] = mergeResults(chunkResults);
        })
      );
      return results;
    })();

    // Execute all in parallel
    const [overviewData, shiftsData, hourlyData] = await Promise.all([
      overviewPromise,
      shiftPromise,
      hourlyPromise
    ]);

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).json({
      overview: {
        date_range: { start: startIso, end: endIso },
        total_agents: overviewData.totals.total_agents,
        totals: {
          total_tickets: overviewData.totals.total_tickets,
          avg_rating: overviewData.totals.avg_rating,
        },
        agents: overviewData.agents,
      },
      shifts: shiftsData,
      hourly: hourlyData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err?.message || "Unexpected error";
    const status = /invalid|required/i.test(message) ? 400 : 500;
    console.error("team-performance error", err);
    return buildError(res, status, message);
  }
}

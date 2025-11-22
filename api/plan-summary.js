import fetch from 'node-fetch';

// Helper functions from your n8n code
function normalizePlan(p) {
  if (!p) return 'UNKNOWN_PLAN';
  return String(p).trim().replace(/\s+/g, '_').toUpperCase() || 'UNKNOWN_PLAN';
}

function planEmoji(plan) {
  if (/^CUSTOM_/i.test(plan)) return '💎';              // high paying
  if (plan === 'PRO_PLAN') return '🚀';               // decent
  if (plan === 'BASE_PLAN') return '🟢';  // low paying
  if (plan === 'TRIAL_PLAN') return '📦';            // trial
  if (plan === 'UNKNOWN_PLAN') return '❓';
  return '📦'; // fallback
}

function extractPlan(t) {
  const direct =
    (t?.session?.plan) ||
    (t?.latestComment?.session?.plan) ||
    t?.plan;

  if (direct) return normalizePlan(direct);

  // Fallback: tags like ["PRO PLAN", "BASE PLAN", ...]
  if (Array.isArray(t?.tags)) {
    const tag = t.tags.find(x => /PLAN/i.test(x));
    if (tag) return normalizePlan(tag);
  }
  return 'UNKNOWN_PLAN';
}

export default async function handler(req, res) {
  try {
    const response = await fetch('https://dashapi.gleap.io/v3/tickets?type=INQUIRY&status=OPEN&skip=0&limit=300&filter={}&sort=-lastNotification', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE',
        'project': '64d9fa1b014ae7130f2e58d1',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Gleap API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const tickets = data.tickets || [];

    // Count by Plan
    const countsMap = new Map();
    for (const ticket of tickets) {
      const plan = extractPlan(ticket);
      countsMap.set(plan, (countsMap.get(plan) || 0) + 1);
    }
    const total = tickets.length;

    const countsArray = [...countsMap.entries()]
      .map(([plan, count]) => ({ plan, count, emoji: planEmoji(plan) }))
      .sort((a, b) => b.count - a.count);

    // Grouped summary counters
    let baseCount = 0;
    let proCount = 0;
    let trialCount = 0;
    let customCount = 0;

    const customDetails = [];

    for (const entry of countsArray) {
      const plan = entry.plan;
      const count = entry.count;

      if (plan.startsWith("CUSTOM_")) {
        customCount += count;
        customDetails.push(`${planEmoji(plan)} ${plan} - ${count}`);
      } else if (plan === "BASE_PLAN") {
        baseCount += count;
      } else if (plan === "PRO_PLAN") {
        proCount += count;
      } else if (plan === "TRIAL_PLAN") {
        trialCount += count;
      }
    }

    // IST Time
    const timeStr = new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    }).format(new Date());

    const result = {
      total_tickets: total,
      time_ist: timeStr,
      summary: {
        base_plan: baseCount,
        pro_plan: proCount,
        trial_plan: trialCount,
        custom_plan: customCount
      },
      custom_details: customDetails,
      breakdown: countsArray,
      timestamp: new Date().toISOString()
    };

    console.log('Plan summary result:', result);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(result);

  } catch (error) {
    console.error('Error in plan-summary API:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Failed to fetch plan summary',
      details: error.message
    });
  }
}
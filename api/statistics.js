import fetch from 'node-fetch';

// Helper function to convert time units to minutes
function toMinutes(value, unit) {
  if (!value || !unit) return 0;
  unit = unit.toLowerCase();
  if (unit === 'min') return value;
  if (unit === 'h') return value * 60;
  if (unit === 's') return value / 60;
  return value;
}

export default async function handler(req, res) {
  try {
    // Calculate date range for the last hour in UTC
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const startDate = oneHourAgo.toISOString();
    const endDate = now.toISOString();

    console.log(`Fetching statistics for range: ${startDate} to ${endDate}`);

    const headers = {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE',
      'project': '64d9fa1b014ae7130f2e58d1'
    };

    // Fetch all three statistics in parallel
    const [replyTimeRes, firstResponseRes, timeToCloseRes] = await Promise.all([
      fetch(`https://dashapi.gleap.io/v3/statistics/facts?chartType=TICKET_MEDIAN_REPLY_TIME&startDate=${startDate}&endDate=${endDate}&aggsType=MEDIAN`, { headers }),
      fetch(`https://dashapi.gleap.io/v3/statistics/facts?chartType=MEDIAN_FIRST_RESPONSE_TIME&startDate=${startDate}&endDate=${endDate}&aggsType=MEDIAN`, { headers }),
      fetch(`https://dashapi.gleap.io/v3/statistics/facts?chartType=MEDIAN_TIME_TO_CLOSE&startDate=${startDate}&endDate=${endDate}&aggsType=MEDIAN`, { headers })
    ]);

    // Check if all responses are OK
    if (!replyTimeRes.ok || !firstResponseRes.ok || !timeToCloseRes.ok) {
      throw new Error('One or more statistics API calls failed');
    }

    const [replyTime, firstResponse, timeToClose] = await Promise.all([
      replyTimeRes.json(),
      firstResponseRes.json(),
      timeToCloseRes.json()
    ]);

    // Convert to minutes
    const replyMinutes = Math.round(toMinutes(replyTime.value, replyTime.valueUnit));
    const firstResponseMinutes = Math.round(toMinutes(firstResponse.value, firstResponse.valueUnit));
    const closeMinutes = Math.round(toMinutes(timeToClose.value, timeToClose.valueUnit));

    const result = {
      median_first_response: firstResponseMinutes,
      median_reply_time: replyMinutes,
      median_time_to_close: closeMinutes,
      time_range: {
        start: startDate,
        end: endDate
      }
    };

    console.log('Statistics result:', result);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(result);

  } catch (error) {
    console.error('Error in statistics API:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      details: error.message,
      median_first_response: 0,
      median_reply_time: 0,
      median_time_to_close: 0
    });
  }
}
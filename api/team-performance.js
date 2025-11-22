import fetch from 'node-fetch';

// Helper function to convert seconds to readable time
function formatTime(seconds, unit) {
  if (!seconds || seconds === '--' || seconds === null) return '--';
  
  if (unit === 's') {
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
  
  return seconds;
}

export default async function handler(req, res) {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    console.log(`Fetching team performance for: ${startDate} to ${endDate}`);

    const response = await fetch(
      `https://dashapi.gleap.io/v3/statistics/lists?chartType=TEAM_PERFORMANCE_LIST&startDate=${startDate}&endDate=${endDate}&useWorkingHours=false&aggsType=MEDIAN`,
      {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE',
          'project': '64d9fa1b014ae7130f2e58d1'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Team performance API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const teamData = data.data || [];

    // Process the team data
    const processedData = teamData.map(agent => {
      const user = agent.processingUser || {};
      const metrics = agent;
      
      return {
        agent_name: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`.trim()
          : user.email || 'Unknown Agent',
        agent_email: user.email || '',
        profile_image: user.profileImageUrl || '',
        
        // Metrics
        total_tickets: metrics.totalCountForUser?.value || 0,
        comments_count: metrics.commentCount?.value || 0,
        closed_tickets: metrics.rawClosed?.value || 0,
        
        // Time metrics (convert to readable format)
        median_reply_time: formatTime(metrics.medianReplyTime?.rawValue, metrics.medianReplyTime?.valueUnit),
        median_first_reply: formatTime(metrics.medianTimeToFirstReplyInSec?.rawValue, metrics.medianTimeToFirstReplyInSec?.valueUnit),
        median_assignment_reply: formatTime(metrics.medianFirstAssignmentReplyTime?.rawValue, metrics.medianFirstAssignmentReplyTime?.valueUnit),
        time_to_last_close: formatTime(metrics.timeToLastCloseInSec?.rawValue, metrics.timeToLastCloseInSec?.valueUnit),
        
        average_rating: metrics.averageRating?.value || '--',
        ticket_activity: metrics.ticketActivityCount?.value || 0,
        hours_active: metrics.hoursActive?.value || '--'
      };
    });

    // Sort by total tickets (descending)
    processedData.sort((a, b) => b.total_tickets - a.total_tickets);

    const result = {
      date_range: { start: startDate, end: endDate },
      total_agents: processedData.length,
      agents: processedData,
      timestamp: new Date().toISOString()
    };

    console.log(`Found ${processedData.length} agents in team performance`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(result);

  } catch (error) {
    console.error('Error in team-performance API:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Failed to fetch team performance',
      details: error.message
    });
  }
}
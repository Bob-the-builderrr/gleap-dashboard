import fetch from 'node-fetch';

// Convert seconds to hours and minutes
function formatTime(seconds) {
    if (!seconds || seconds === '--' || seconds === null || seconds === 0) return '--';
    
    const secs = Number(seconds);
    if (isNaN(secs)) return '--';
    
    const minutes = Math.round(secs / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
        const decimalHours = (minutes / 60).toFixed(1);
        return `${decimalHours}h`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${secs}s`;
}

// Extract numeric rating from string like "😊 86" or number
function extractRating(ratingStr) {
    if (!ratingStr || ratingStr === '--') return '--';
    
    // If it's already a number, just return it
    if (typeof ratingStr === 'number') {
        return `${ratingStr}%`;
    }
    
    // If it's a string, try to extract numbers
    if (typeof ratingStr === 'string') {
        const match = ratingStr.match(/\d+/);
        return match ? `${match[0]}%` : '--';
    }
    
    return '--';
}

// Convert time to minutes for sorting
function timeToMinutes(timeStr) {
    if (!timeStr || timeStr === '--') return null;
    
    if (typeof timeStr === 'number') {
        return Math.round(timeStr / 60); // Convert seconds to minutes
    }
    
    if (typeof timeStr === 'string') {
        if (timeStr.includes('h')) {
            const hours = parseFloat(timeStr);
            return Math.round(hours * 60);
        }
        if (timeStr.includes('m')) {
            return parseInt(timeStr);
        }
        if (timeStr.includes('s')) {
            return Math.round(parseInt(timeStr) / 60);
        }
    }
    return null;
}

export default async function handler(req, res) {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        console.log(`Fetching team performance for: ${startDate} to ${endDate}`);

        // Convert to UTC timestamps - FULL DAY for the selected dates
        const startUTC = new Date(`${startDate}T00:00:00.000Z`).toISOString();
        const endUTC = new Date(`${endDate}T23:59:59.999Z`).toISOString();

        console.log('UTC Timestamps - Start:', startUTC, 'End:', endUTC);

        const teamId = '66595e93b58fb2a1e6b8a83f';
        const apiUrl = `https://dashapi.gleap.io/v3/statistics/lists?chartType=TEAM_PERFORMANCE_LIST&startDate=${startUTC}&endDate=${endUTC}&useWorkingHours=false&team=${teamId}&aggsType=MEDIAN`;

        console.log('Calling Gleap API:', apiUrl);

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE',
                'project': '64d9fa1b014ae7130f2e58d1'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gleap API error:', response.status, errorText);
            throw new Error(`Gleap API responded with status: ${response.status}`);
        }

        const data = await response.json();
        const teamData = data.data || [];

        console.log(`Received ${teamData.length} agents from Gleap API`);

        // Process the team data
        const processedData = teamData.map(agent => {
            const user = agent.processingUser || {};
            const metrics = agent;
            
            // Handle response time - use rawValue which is in seconds
            const medianReplyTimeDisplay = formatTime(metrics.medianReplyTime?.rawValue);
            const responseMinutes = timeToMinutes(metrics.medianReplyTime?.rawValue); // Pass raw seconds
            
            return {
                agent_name: user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}`.trim()
                    : user.email || 'Unknown Agent',
                agent_email: user.email || '',
                profile_image: user.profileImageUrl || '',
                
                // Core metrics
                total_tickets: metrics.totalCountForUser?.value || 0,
                closed_tickets: metrics.rawClosed?.value || 0,
                
                // Response times
                median_reply_time_display: medianReplyTimeDisplay,
                response_minutes: responseMinutes,
                median_first_reply: formatTime(metrics.medianTimeToFirstReplyInSec?.rawValue),
                time_to_last_close: formatTime(metrics.timeToLastCloseInSec?.rawValue),
                
                // Rating and activity
                average_rating: metrics.averageRating?.value || '--',
                rating_display: extractRating(metrics.averageRating?.value),
                ticket_activity: metrics.ticketActivityCount?.value || 0,
                hours_active: metrics.hoursActive?.value || '--'
            };
        });

        // Sort by total tickets (descending) by default
        processedData.sort((a, b) => b.total_tickets - a.total_tickets);

        const result = {
            date_range: { 
                start: startDate, 
                end: endDate,
                start_utc: startUTC,
                end_utc: endUTC
            },
            total_agents: processedData.length,
            agents: processedData,
            timestamp: new Date().toISOString()
        };

        console.log(`Processed ${processedData.length} agents`);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
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
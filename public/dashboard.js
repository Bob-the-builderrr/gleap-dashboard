// Global variables
let currentData = [];
let currentSort = { column: null, direction: 'asc' };
let currentFilter = 'all';

// Function to format time for display
function formatTime(seconds) {
  if (!seconds || seconds === '--' || seconds === null) return '--';

  // Convert string to number if needed
  const secs = Number(seconds);
  if (isNaN(secs)) return '--';

  // If less than 1 minute: show seconds
  if (secs < 60) return `${secs}s`;

  // If less than 1 hour: show minutes with decimals
  if (secs < 3600) {
    const mins = secs / 60;
    return `${mins.toFixed(1)}m`;
  }

  // If 1 hour or more: convert to hours with decimals
  const hours = secs / 3600;
  return `${hours.toFixed(1)}h`;
}


// Function to determine performance level based on actual metrics
function getPerformanceLevel(agent) {
  const replyTime = agent.median_reply_time;
  const firstReply = agent.median_first_reply;
  const averageRating = agent.average_rating;
  
  // Simple performance calculation based on available metrics
  let score = 0;
  
  // Score based on reply time (shorter is better)
  if (replyTime && replyTime !== '--') {
    if (replyTime.includes('m') && !replyTime.includes('h')) {
      const minutes = parseInt(replyTime);
      if (minutes <= 5) score += 3;
      else if (minutes <= 15) score += 2;
      else score += 1;
    }
  }
  
  // Score based on first reply time
  if (firstReply && firstReply !== '--') {
    if (firstReply.includes('m') && !firstReply.includes('h')) {
      const minutes = parseInt(firstReply);
      if (minutes <= 2) score += 3;
      else if (minutes <= 10) score += 2;
      else score += 1;
    }
  }
  
  // Score based on rating
  if (averageRating && averageRating !== '--') {
    const rating = parseFloat(averageRating);
    if (rating >= 4.5) score += 3;
    else if (rating >= 4.0) score += 2;
    else if (rating >= 3.0) score += 1;
  }
  
  // Score based on closed tickets
  if (agent.closed_tickets >= 15) score += 3;
  else if (agent.closed_tickets >= 8) score += 2;
  else if (agent.closed_tickets >= 3) score += 1;
  
  if (score >= 8) return "excellent";
  if (score >= 5) return "good";
  return "needs-improvement";
}

// Function to determine satisfaction class
function getSatisfactionClass(rating) {
  if (!rating || rating === '--') return "medium";
  const numRating = parseFloat(rating);
  if (numRating >= 4.5) return "high";
  if (numRating >= 3.5) return "medium";
  return "low";
}

// Function to determine response time class
function getResponseTimeClass(time) {
  if (!time || time === '--') return "average";
  if (time.includes('h')) return "slow";
  if (time.includes('m')) {
    const minutes = parseInt(time);
    if (minutes <= 5) return "fast";
    if (minutes <= 15) return "average";
  }
  return "slow";
}

// Function to render performance rows
function renderPerformanceRows(data) {
  const tbody = document.getElementById("performanceRows");
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          No agents match your current filters
        </td>
      </tr>
    `;
    return;
  }

  data.forEach(agent => {
    const performanceLevel = getPerformanceLevel(agent);
    const satisfactionClass = getSatisfactionClass(agent.average_rating);
    const responseTimeClass = getResponseTimeClass(agent.median_reply_time);

    tbody.innerHTML += `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${agent.profile_image ? 
              `<img src="${agent.profile_image}" alt="${agent.agent_name}" style="width: 32px; height: 32px; border-radius: 50%;">` : 
              '<div style="width: 32px; height: 32px; border-radius: 50%; background: #4361ee; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.8rem;">' + 
              (agent.agent_name ? agent.agent_name.charAt(0).toUpperCase() : '?') + '</div>'
            }
            <div>
              <strong>${agent.agent_name}</strong>
              ${agent.agent_email ? `<div style="font-size: 0.8rem; color: #6c757d;">${agent.agent_email}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${agent.total_tickets || 0}</td>
        <td>${agent.closed_tickets || 0}</td>
        <td><span class="response-time ${responseTimeClass}">${formatTimeForDisplay(agent.median_reply_time)}</span></td>
        <td><span class="satisfaction ${satisfactionClass}">${agent.average_rating || '--'}</span></td>
        <td>${agent.comments_count || 0}</td>
        <td><span class="performance ${performanceLevel}">${performanceLevel.replace('-', ' ')}</span></td>
      </tr>
    `;
  });
}

// Function to update statistics
function updateStatistics(data) {
  const totalAgents = data.length;
  const totalTickets = data.reduce((sum, agent) => sum + (agent.total_tickets || 0), 0);
  const totalClosed = data.reduce((sum, agent) => sum + (agent.closed_tickets || 0), 0);
  
  // Calculate average rating
  const ratings = data.filter(agent => agent.average_rating && agent.average_rating !== '--').map(agent => parseFloat(agent.average_rating));
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '--';

  document.getElementById("totalAgents").innerText = totalAgents;
  document.getElementById("totalTickets").innerText = totalTickets;
  document.getElementById("avgResponseTime").innerText = totalClosed;
  document.getElementById("satisfactionScore").innerText = avgRating !== '--' ? `${avgRating}/5` : '--';
}

// Function to render charts
function renderCharts(data) {
  // Tickets distribution chart
  const ticketsChart = document.querySelector('#ticketsChart .chart-bars');
  ticketsChart.innerHTML = "";

  const maxTickets = Math.max(...data.map(a => a.total_tickets || 0), 1);

  data.forEach(agent => {
    const height = ((agent.total_tickets || 0) / maxTickets) * 100;
    const displayName = agent.agent_name ? agent.agent_name.split(' ')[0] : 'Unknown';
    
    ticketsChart.innerHTML += `
      <div class="chart-bar" style="height: ${height}%">
        <div class="chart-bar-label">${displayName}</div>
      </div>
    `;
  });

  // Satisfaction chart
  const satisfactionChart = document.querySelector('#satisfactionChart .satisfaction-bars');
  satisfactionChart.innerHTML = "";

  data.forEach(agent => {
    const rating = agent.average_rating && agent.average_rating !== '--' ? parseFloat(agent.average_rating) : 0;
    const height = (rating / 5) * 100; // Convert 5-star rating to percentage
    const displayName = agent.agent_name ? agent.agent_name.split(' ')[0] : 'Unknown';
    
    satisfactionChart.innerHTML += `
      <div class="satisfaction-bar" style="height: ${height}%">
        <div class="satisfaction-bar-label">${displayName}</div>
      </div>
    `;
  });
}

// Sorting functionality
function setupSorting() {
  const sortableHeaders = document.querySelectorAll('th.sortable');
  
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      
      // Reset other headers
      sortableHeaders.forEach(h => {
        if (h !== header) {
          h.classList.remove('asc', 'desc');
        }
      });
      
      // Toggle direction if same column
      if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
      }
      
      // Update UI
      header.classList.remove('asc', 'desc');
      header.classList.add(currentSort.direction);
      
      // Sort data
      sortData();
    });
  });
}

// Function to sort data based on current sort settings
function sortData() {
  const sortedData = [...currentData].sort((a, b) => {
    let aValue, bValue;
    
    switch(currentSort.column) {
      case 'agent':
        aValue = a.agent_name || '';
        bValue = b.agent_name || '';
        break;
      case 'open':
        aValue = a.total_tickets || 0;
        bValue = b.total_tickets || 0;
        break;
      case 'closed':
        aValue = a.closed_tickets || 0;
        bValue = b.closed_tickets || 0;
        break;
      case 'response':
        // Sort by reply time (convert to comparable value)
        aValue = getTimeSortValue(a.median_reply_time);
        bValue = getTimeSortValue(b.median_reply_time);
        break;
      case 'satisfaction':
        aValue = a.average_rating === '--' ? 0 : parseFloat(a.average_rating) || 0;
        bValue = b.average_rating === '--' ? 0 : parseFloat(b.average_rating) || 0;
        break;
      case 'comments':
        aValue = a.comments_count || 0;
        bValue = b.comments_count || 0;
        break;
      default:
        return 0;
    }
    
    if (currentSort.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
  
  renderPerformanceRows(sortedData);
  renderCharts(sortedData);
}

// Helper function to convert time strings to sortable values
function getTimeSortValue(timeStr) {
  if (!timeStr || timeStr === '--') return 999999; // Large number for missing values
  
  if (timeStr.includes('h')) {
    const parts = timeStr.split(' ');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parts[1] ? parseInt(parts[1]) : 0;
    return hours * 60 + minutes;
  }
  
  if (timeStr.includes('m')) {
    return parseInt(timeStr) || 0;
  }
  
  if (timeStr.includes('s')) {
    return (parseInt(timeStr) / 60) || 0;
  }
  
  return 0;
}

// Filter functionality
function setupFiltering() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Set current filter
      currentFilter = button.getAttribute('data-filter');
      
      // Apply filter
      applyFilter();
    });
  });
}

// Function to apply current filter
function applyFilter() {
  let filteredData = [...currentData];
  
  switch(currentFilter) {
    case 'high':
      filteredData = filteredData.filter(agent => getPerformanceLevel(agent) === 'excellent');
      break;
    case 'needs':
      filteredData = filteredData.filter(agent => getPerformanceLevel(agent) === 'needs-improvement');
      break;
    default:
      // 'all' filter - no additional filtering needed
      break;
  }
  
  currentData = filteredData;
  updateStatistics(currentData);
  
  // Re-apply current sort if exists
  if (currentSort.column) {
    sortData();
  } else {
    renderPerformanceRows(currentData);
    renderCharts(currentData);
  }
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    
    if (searchTerm.length === 0) {
      // If search is empty, revert to current filter
      applyFilter();
      return;
    }
    
    const filteredData = currentData.filter(agent => 
      (agent.agent_name && agent.agent_name.toLowerCase().includes(searchTerm)) ||
      (agent.agent_email && agent.agent_email.toLowerCase().includes(searchTerm))
    );
    
    renderPerformanceRows(filteredData);
    renderCharts(filteredData);
  });
}

// Function to fetch data from your API
async function fetchTeamPerformance() {
  try {
    // Set date range (last 30 days as default)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response = await fetch(`/api/team-performance?startDate=${startDate}&endDate=${endDate}`);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.agents || [];
    
  } catch (error) {
    console.error('Error fetching team performance:', error);
    // Fallback to empty array
    return [];
  }
}

// Initialize dashboard
async function initDashboard() {
  try {
    // Show loading state
    document.getElementById("performanceRows").innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          Loading team performance data...
        </td>
      </tr>
    `;

    // Fetch real data from your API
    const teamData = await fetchTeamPerformance();
    currentData = teamData;
    
    updateStatistics(currentData);
    renderPerformanceRows(currentData);
    renderCharts(currentData);
    setupSorting();
    setupFiltering();
    setupSearch();
    
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
    document.getElementById("performanceRows").innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #e63946;">
          Error loading team performance data. Please try again later.
        </td>
      </tr>
    `;
  }
}

// Load dashboard when page is ready
document.addEventListener('DOMContentLoaded', initDashboard);
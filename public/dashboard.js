// Mock data for team performance
const mockData = [
  {
    Agent_Name: "Alex Johnson",
    Agent_Open_Ticket: 5,
    Tickets_Closed_Today: 12,
    Avg_Response_Time: "8 minutes",
    Satisfaction_Score: "94%",
    Plan_Type: "Enterprise"
  },
  {
    Agent_Name: "Maria Garcia",
    Agent_Open_Ticket: 3,
    Tickets_Closed_Today: 15,
    Avg_Response_Time: "6 minutes",
    Satisfaction_Score: "98%",
    Plan_Type: "Professional"
  },
  {
    Agent_Name: "David Smith",
    Agent_Open_Ticket: 7,
    Tickets_Closed_Today: 8,
    Avg_Response_Time: "15 minutes",
    Satisfaction_Score: "82%",
    Plan_Type: "Starter"
  },
  {
    Agent_Name: "Sarah Williams",
    Agent_Open_Ticket: 2,
    Tickets_Closed_Today: 18,
    Avg_Response_Time: "4 minutes",
    Satisfaction_Score: "96%",
    Plan_Type: "Enterprise"
  },
  {
    Agent_Name: "James Brown",
    Agent_Open_Ticket: 4,
    Tickets_Closed_Today: 10,
    Avg_Response_Time: "12 minutes",
    Satisfaction_Score: "85%",
    Plan_Type: "Professional"
  },
  {
    Agent_Name: "Lisa Chen",
    Agent_Open_Ticket: 6,
    Tickets_Closed_Today: 14,
    Avg_Response_Time: "7 minutes",
    Satisfaction_Score: "92%",
    Plan_Type: "Enterprise"
  }
];

// Global variables
let currentData = [...mockData];
let currentSort = { column: null, direction: 'asc' };
let currentFilter = 'all';

// Function to parse response time
function parseResponseTime(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+)\s*minutes?/);
  return match ? parseInt(match[1]) : 0;
}

// Function to parse satisfaction score
function parseSatisfaction(scoreStr) {
  if (!scoreStr) return 0;
  const match = scoreStr.match(/(\d+)%/);
  return match ? parseInt(match[1]) : 0;
}

// Function to calculate team statistics
function calculateTeamStats(data) {
  const totalAgents = data.length;
  const totalTickets = data.reduce((sum, agent) => sum + agent.Agent_Open_Ticket, 0);
  const avgResponseTime = Math.round(
    data.reduce((sum, agent) => sum + parseResponseTime(agent.Avg_Response_Time), 0) / totalAgents
  );
  const avgSatisfaction = Math.round(
    data.reduce((sum, agent) => sum + parseSatisfaction(agent.Satisfaction_Score), 0) / totalAgents
  );

  return { totalAgents, totalTickets, avgResponseTime, avgSatisfaction };
}

// Function to determine performance level
function getPerformanceLevel(agent) {
  const satisfaction = parseSatisfaction(agent.Satisfaction_Score);
  const responseTime = parseResponseTime(agent.Avg_Response_Time);
  const ticketsClosed = agent.Tickets_Closed_Today;

  if (satisfaction >= 90 && responseTime <= 8 && ticketsClosed >= 12) {
    return "excellent";
  } else if (satisfaction >= 85 && responseTime <= 12 && ticketsClosed >= 8) {
    return "good";
  } else {
    return "needs-improvement";
  }
}

// Function to determine satisfaction class
function getSatisfactionClass(score) {
  const satisfaction = parseSatisfaction(score);
  if (satisfaction >= 90) return "high";
  if (satisfaction >= 80) return "medium";
  return "low";
}

// Function to determine response time class
function getResponseTimeClass(time) {
  const responseTime = parseResponseTime(time);
  if (responseTime <= 8) return "fast";
  if (responseTime <= 12) return "average";
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
    const satisfactionClass = getSatisfactionClass(agent.Satisfaction_Score);
    const responseTimeClass = getResponseTimeClass(agent.Avg_Response_Time);

    tbody.innerHTML += `
      <tr>
        <td><strong>${agent.Agent_Name}</strong></td>
        <td>${agent.Agent_Open_Ticket}</td>
        <td>${agent.Tickets_Closed_Today}</td>
        <td><span class="response-time ${responseTimeClass}">${agent.Avg_Response_Time}</span></td>
        <td><span class="satisfaction ${satisfactionClass}">${agent.Satisfaction_Score}</span></td>
        <td>${agent.Plan_Type}</td>
        <td><span class="performance ${performanceLevel}">${performanceLevel.replace('-', ' ')}</span></td>
      </tr>
    `;
  });
}

// Function to update statistics
function updateStatistics(data) {
  const stats = calculateTeamStats(data);
  document.getElementById("totalAgents").innerText = stats.totalAgents;
  document.getElementById("totalTickets").innerText = stats.totalTickets;
  document.getElementById("avgResponseTime").innerText = `${stats.avgResponseTime}m`;
  document.getElementById("satisfactionScore").innerText = `${stats.avgSatisfaction}%`;
}

// Function to render charts
function renderCharts(data) {
  // Tickets distribution chart
  const ticketsChart = document.querySelector('#ticketsChart .chart-bars');
  ticketsChart.innerHTML = "";

  data.forEach(agent => {
    const maxTickets = Math.max(...data.map(a => a.Agent_Open_Ticket));
    const height = (agent.Agent_Open_Ticket / maxTickets) * 100;
    
    ticketsChart.innerHTML += `
      <div class="chart-bar" style="height: ${height}%">
        <div class="chart-bar-label">${agent.Agent_Name.split(' ')[0]}</div>
      </div>
    `;
  });

  // Satisfaction chart
  const satisfactionChart = document.querySelector('#satisfactionChart .satisfaction-bars');
  satisfactionChart.innerHTML = "";

  data.forEach(agent => {
    const satisfaction = parseSatisfaction(agent.Satisfaction_Score);
    const height = satisfaction;
    
    satisfactionChart.innerHTML += `
      <div class="satisfaction-bar" style="height: ${height}%">
        <div class="satisfaction-bar-label">${agent.Agent_Name.split(' ')[0]}</div>
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
        aValue = a.Agent_Name;
        bValue = b.Agent_Name;
        break;
      case 'open':
        aValue = a.Agent_Open_Ticket;
        bValue = b.Agent_Open_Ticket;
        break;
      case 'closed':
        aValue = a.Tickets_Closed_Today;
        bValue = b.Tickets_Closed_Today;
        break;
      case 'response':
        aValue = parseResponseTime(a.Avg_Response_Time);
        bValue = parseResponseTime(b.Avg_Response_Time);
        break;
      case 'satisfaction':
        aValue = parseSatisfaction(a.Satisfaction_Score);
        bValue = parseSatisfaction(b.Satisfaction_Score);
        break;
      case 'plan':
        aValue = a.Plan_Type;
        bValue = b.Plan_Type;
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
  let filteredData = [...mockData];
  
  switch(currentFilter) {
    case 'enterprise':
      filteredData = filteredData.filter(agent => agent.Plan_Type === 'Enterprise');
      break;
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
      agent.Agent_Name.toLowerCase().includes(searchTerm)
    );
    
    renderPerformanceRows(filteredData);
    renderCharts(filteredData);
  });
}

// Initialize dashboard
function initDashboard() {
  updateStatistics(mockData);
  renderPerformanceRows(mockData);
  renderCharts(mockData);
  setupSorting();
  setupFiltering();
  setupSearch();
}

// Load dashboard when page is ready
document.addEventListener('DOMContentLoaded', initDashboard);
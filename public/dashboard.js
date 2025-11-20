// Mock data for demonstration
const mockData = [
  {
    Agent_Name: "Alex Johnson",
    Agent_Open_Ticket: 5,
    Priority: "High",
    Ticket_Status: "In Progress",
    Time_Open_Duration: "52 minutes",
    User_Email: "customer1@example.com",
    Plan_Type: "Enterprise",
    Tags: "billing,urgent"
  },
  {
    Agent_Name: "Maria Garcia",
    Agent_Open_Ticket: 3,
    Priority: "Medium",
    Ticket_Status: "Open",
    Time_Open_Duration: "28 minutes",
    User_Email: "customer2@example.com",
    Plan_Type: "Professional",
    Tags: "technical"
  },
  {
    Agent_Name: "David Smith",
    Agent_Open_Ticket: 7,
    Priority: "Low",
    Ticket_Status: "Open",
    Time_Open_Duration: "15 minutes",
    User_Email: "customer3@example.com",
    Plan_Type: "Starter",
    Tags: "feature-request"
  },
  {
    Agent_Name: "Sarah Williams",
    Agent_Open_Ticket: 2,
    Priority: "High",
    Ticket_Status: "In Progress",
    Time_Open_Duration: "67 minutes",
    User_Email: "customer4@example.com",
    Plan_Type: "Enterprise",
    Tags: "bug,urgent"
  },
  {
    Agent_Name: "James Brown",
    Agent_Open_Ticket: 4,
    Priority: "Medium",
    Ticket_Status: "Open",
    Time_Open_Duration: "42 minutes",
    User_Email: "customer5@example.com",
    Plan_Type: "Professional",
    Tags: "question"
  },
  {
    Agent_Name: "Lisa Chen",
    Agent_Open_Ticket: 6,
    Priority: "High",
    Ticket_Status: "In Progress",
    Time_Open_Duration: "38 minutes",
    User_Email: "customer6@example.com",
    Plan_Type: "Enterprise",
    Tags: "billing"
  },
  {
    Agent_Name: "Michael Taylor",
    Agent_Open_Ticket: 1,
    Priority: "Low",
    Ticket_Status: "Open",
    Time_Open_Duration: "23 minutes",
    User_Email: "customer7@example.com",
    Plan_Type: "Free",
    Tags: "feedback"
  },
  {
    Agent_Name: "Emily Wilson",
    Agent_Open_Ticket: 8,
    Priority: "Medium",
    Ticket_Status: "In Progress",
    Time_Open_Duration: "51 minutes",
    User_Email: "customer8@example.com",
    Plan_Type: "Professional",
    Tags: "integration,api"
  }
];

// Color mapping for plans
const planColors = {
  "Enterprise": "#4361ee",
  "Professional": "#4cc9f0",
  "Starter": "#3a0ca3",
  "Free": "#7209b7"
};

// Global variables
let currentData = [...mockData];
let currentSort = { column: null, direction: 'asc' };
let currentFilter = 'all';

// Function to parse duration string and return minutes
function parseDuration(durationStr) {
  if (!durationStr) return 0;
  
  const hoursMatch = durationStr.match(/(\d+)\s*hours?/);
  const minutesMatch = durationStr.match(/(\d+)\s*minutes?/);
  
  let totalMinutes = 0;
  
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1]) * 60;
  }
  
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1]);
  }
  
  // If no hours or minutes found, try to parse as just a number
  if (totalMinutes === 0) {
    const numberMatch = durationStr.match(/\d+/);
    if (numberMatch) {
      totalMinutes = parseInt(numberMatch[0]);
    }
  }
  
  return totalMinutes;
}

// Function to calculate average resolution time
function calculateAvgResolutionTime(data) {
  if (data.length === 0) return 0;
  
  const totalMinutes = data.reduce((sum, ticket) => {
    return sum + parseDuration(ticket.Time_Open_Duration);
  }, 0);
  
  return Math.round(totalMinutes / data.length);
}

// Function to count tickets exceeding SLA
function countExceededSLA(data) {
  return data.filter(ticket => parseDuration(ticket.Time_Open_Duration) > 45).length;
}

// Function to render table rows
function renderTableRows(data) {
  const tbody = document.getElementById("ticketRows");
  tbody.innerHTML = "";
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px;">
          No tickets match your current filters
        </td>
      </tr>
    `;
    return;
  }
  
  data.forEach(row => {
    const durationMinutes = parseDuration(row.Time_Open_Duration);
    const exceededDuration = durationMinutes > 45;
    
    const priorityClass = row.Priority ? row.Priority.toLowerCase() : "medium";
    
    tbody.innerHTML += `
      <tr class="${exceededDuration ? 'exceeded-duration' : ''}">
        <td>${row.Agent_Name}</td>
        <td>${row.Agent_Open_Ticket}</td>
        <td><span class="priority ${priorityClass}">${row.Priority}</span></td>
        <td><span class="status">${row.Ticket_Status}</span></td>
        <td><span class="duration ${exceededDuration ? 'exceeded' : ''}">${row.Time_Open_Duration}</span></td>
        <td>${row.User_Email}</td>
        <td>${row.Plan_Type}</td>
        <td class="tags">
          ${row.Tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
        </td>
      </tr>
    `;
  });
}

// Function to update plan breakdown
function updatePlanBreakdown(data) {
  const planCounts = {};
  data.forEach(t => {
    planCounts[t.Plan_Type] = (planCounts[t.Plan_Type] || 0) + 1;
  });

  const planDiv = document.getElementById("planBreakdown");
  planDiv.innerHTML = "";
  
  Object.entries(planCounts).forEach(([plan, count]) => {
    planDiv.innerHTML += `
      <div class="plan-item">
        <div class="plan-name">
          <div class="plan-color" style="background-color: ${planColors[plan] || '#6c757d'}"></div>
          <span>${plan}</span>
        </div>
        <div class="plan-count">${count}</div>
      </div>
    `;
  });
}

// Function to update statistics
function updateStatistics(data) {
  document.getElementById("totalTickets").innerText = data.length;
  document.getElementById("avgResolutionTime").innerText = `${calculateAvgResolutionTime(data)}m`;
  document.getElementById("exceededSLA").innerText = countExceededSLA(data);
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
      case 'priority':
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        aValue = priorityOrder[a.Priority] || 0;
        bValue = priorityOrder[b.Priority] || 0;
        break;
      case 'status':
        aValue = a.Ticket_Status;
        bValue = b.Ticket_Status;
        break;
      case 'duration':
        aValue = parseDuration(a.Time_Open_Duration);
        bValue = parseDuration(b.Time_Open_Duration);
        break;
      case 'email':
        aValue = a.User_Email;
        bValue = b.User_Email;
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
  
  renderTableRows(sortedData);
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
    case 'high':
      filteredData = filteredData.filter(ticket => ticket.Priority === 'High');
      break;
    case 'exceeded':
      filteredData = filteredData.filter(ticket => parseDuration(ticket.Time_Open_Duration) > 45);
      break;
    case 'enterprise':
      filteredData = filteredData.filter(ticket => ticket.Plan_Type === 'Enterprise');
      break;
    default:
      // 'all' filter - no additional filtering needed
      break;
  }
  
  currentData = filteredData;
  updateStatistics(currentData);
  updatePlanBreakdown(currentData);
  
  // Re-apply current sort if exists
  if (currentSort.column) {
    sortData();
  } else {
    renderTableRows(currentData);
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
    
    const filteredData = currentData.filter(ticket => {
      return (
        ticket.Agent_Name.toLowerCase().includes(searchTerm) ||
        ticket.User_Email.toLowerCase().includes(searchTerm) ||
        ticket.Tags.toLowerCase().includes(searchTerm) ||
        ticket.Plan_Type.toLowerCase().includes(searchTerm)
      );
    });
    
    renderTableRows(filteredData);
  });
}

// Initialize dashboard
function initDashboard() {
  updateStatistics(mockData);
  updatePlanBreakdown(mockData);
  renderTableRows(mockData);
  setupSorting();
  setupFiltering();
  setupSearch();
}

// Load dashboard when page is ready
document.addEventListener('DOMContentLoaded', initDashboard);
let agents = [];
let filteredAgents = [];
let currentSort = { column: 'total', direction: 'desc' };

// Initialize with last hour data
function initDatePickers() {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (60 * 60 * 1000)); // 1 hour ago
    
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    document.getElementById('startTime').value = startDate.toTimeString().slice(0, 5);
    document.getElementById('endTime').value = endDate.toTimeString().slice(0, 5);
    
    updateDateInfo();
}

// Update date info display
function updateDateInfo() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.getElementById('timezoneInfo').textContent = `Timezone: ${timezone} | Dates auto-converted to UTC for API`;
}

// Convert to UTC for API
function getUTCDateTime(dateStr, timeStr) {
    const localDate = new Date(`${dateStr}T${timeStr}`);
    return localDate.toISOString();
}

// Load data from API
async function loadData() {
    const startDate = document.getElementById('startDate').value;
    const startTime = document.getElementById('startTime').value;
    const endDate = document.getElementById('endDate').value;
    const endTime = document.getElementById('endTime').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    try {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="6" class="loading">Loading team performance data...</td></tr>';
        
        updateDateInfo();
        
        const apiUrl = `/api/team-performance?startDate=${startDate}&startTime=${startTime}&endDate=${endDate}&endTime=${endTime}`;
        console.log('Calling API:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('API response not ok');
        
        const data = await response.json();
        
        agents = data.agents || [];
        filteredAgents = [...agents];
        applySorting();
        updateStats();
        renderTable();
        
    } catch (error) {
        console.error('Failed to load data:', error);
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="6" class="error">Error loading team performance data</td></tr>';
    }
}

// Update statistics
function updateStats() {
    const totalAgents = agents.length;
    const totalTickets = agents.reduce((sum, a) => sum + (a.total_tickets || 0), 0);
    const closedTickets = agents.reduce((sum, a) => sum + (a.closed_tickets || 0), 0);
    
    // Calculate average response time
    const responseTimes = agents.map(a => a.response_minutes || 0).filter(t => t > 0);
    const avgResponse = responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b) / responseTimes.length) : 0;
    
    document.getElementById('totalAgents').textContent = totalAgents;
    document.getElementById('totalTickets').textContent = totalTickets;
    document.getElementById('closedTickets').textContent = closedTickets;
    document.getElementById('avgResponseTime').textContent = `${avgResponse}m`;
}

// Render table
function renderTable() {
    const tbody = document.getElementById('tableBody');
    
    if (filteredAgents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No agents found matching your criteria</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    filteredAgents.forEach(agent => {
        const responseClass = getResponseTimeClass(agent.response_minutes);
        const ratingClass = getRatingClass(agent.average_rating);
        
        const row = `
            <tr>
                <td>
                    <div class="agent-info">
                        <div class="agent-avatar">
                            ${agent.profile_image ? 
                                `<img src="${agent.profile_image}" alt="${agent.agent_name}" onerror="this.style.display='none'">` : 
                                agent.agent_name ? agent.agent_name.charAt(0).toUpperCase() : '?'
                            }
                        </div>
                        <div class="agent-details">
                            <div class="agent-name">${agent.agent_name || 'Unknown Agent'}</div>
                            <div class="agent-email">${agent.agent_email || ''}</div>
                        </div>
                    </div>
                </td>
                <td><strong>${agent.total_tickets || 0}</strong></td>
                <td>${agent.closed_tickets || 0}</td>
                <td><span class="response-time ${responseClass}">${agent.median_reply_time_display || '--'}</span></td>
                <td><span class="rating ${ratingClass}">${agent.rating_display || '--'}</span></td>
                <td>${agent.ticket_activity || 0}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Get response time class
function getResponseTimeClass(minutes) {
    if (!minutes) return 'average';
    if (minutes <= 5) return 'fast';
    if (minutes <= 15) return 'average';
    return 'slow';
}

// Get rating class
function getRatingClass(rating) {
    if (!rating || typeof rating !== 'string') return 'medium';
    const numMatch = rating.match(/\d+/);
    if (!numMatch) return 'medium';
    
    const num = parseInt(numMatch[0]);
    if (num >= 90) return 'high';
    if (num >= 70) return 'medium';
    return 'low';
}

// Setup sorting
function setupSorting() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            
            // Update sort direction
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'desc';
            }
            
            // Update UI
            document.querySelectorAll('.sortable').forEach(h => {
                h.classList.remove('asc', 'desc');
            });
            header.classList.add(currentSort.direction);
            
            applySorting();
            renderTable();
        });
    });
}

// Apply current sorting
function applySorting() {
    filteredAgents.sort((a, b) => {
        let aValue, bValue;
        
        switch(currentSort.column) {
            case 'agent':
                aValue = a.agent_name || '';
                bValue = b.agent_name || '';
                break;
            case 'total':
                aValue = a.total_tickets || 0;
                bValue = b.total_tickets || 0;
                break;
            case 'closed':
                aValue = a.closed_tickets || 0;
                bValue = b.closed_tickets || 0;
                break;
            case 'response':
                aValue = a.response_minutes || 9999;
                bValue = b.response_minutes || 9999;
                break;
            case 'rating':
                aValue = getRatingValue(a.average_rating);
                bValue = getRatingValue(b.average_rating);
                break;
            case 'activity':
                aValue = a.ticket_activity || 0;
                bValue = b.ticket_activity || 0;
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
}

// Get numeric value from rating string
function getRatingValue(rating) {
    if (!rating || typeof rating !== 'string') return 0;
    const match = rating.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
}

// Search and filter
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        filterAgents(search);
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterAgents(document.getElementById('searchInput').value.toLowerCase());
        });
    });

    document.getElementById('applyDates').addEventListener('click', loadData);
    
    document.getElementById('lastHour').addEventListener('click', () => {
        const end = new Date();
        const start = new Date(end.getTime() - (60 * 60 * 1000));
        
        document.getElementById('startDate').value = start.toISOString().split('T')[0];
        document.getElementById('endDate').value = end.toISOString().split('T')[0];
        document.getElementById('startTime').value = start.toTimeString().slice(0, 5);
        document.getElementById('endTime').value = end.toTimeString().slice(0, 5);
        
        loadData();
    });
    
    document.getElementById('today').addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').value = today;
        document.getElementById('endDate').value = today;
        document.getElementById('startTime').value = '00:00';
        document.getElementById('endTime').value = '23:59';
        loadData();
    });
}

function filterAgents(search) {
    const filter = document.querySelector('.filter-btn.active').dataset.filter;
    
    filteredAgents = agents.filter(agent => {
        const matchesSearch = 
            (agent.agent_name && agent.agent_name.toLowerCase().includes(search)) ||
            (agent.agent_email && agent.agent_email.toLowerCase().includes(search));
        
        if (!matchesSearch) return false;
        
        if (filter === 'high') {
            // Top performers: high ticket count and good response time
            return (agent.total_tickets || 0) >= 10 && (agent.response_minutes || 999) <= 15;
        }
        if (filter === 'active') {
            // Most active: high ticket activity
            return (agent.ticket_activity || 0) >= 20;
        }
        return true; // 'all' filter
    });
    
    applySorting();
    renderTable();
}

// Initialize the dashboard
function initDashboard() {
    initDatePickers();
    setupEventListeners();
    setupSorting();
    loadData();
}

// Start when page loads
document.addEventListener('DOMContentLoaded', initDashboard);
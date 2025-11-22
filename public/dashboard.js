let agents = [];
let filteredAgents = [];

// Initialize date pickers with default values (last 7 days)
function initDatePickers() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    
    // Update timezone info
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.getElementById('timezoneInfo').textContent = `Timezone: ${timezone} (Auto-adjusted for API)`;
}

// Load data from API
async function loadData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    try {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="6" class="loading">Loading team performance data...</td></tr>';
        
        const apiUrl = `/api/team-performance?startDate=${startDate}&endDate=${endDate}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        agents = data.agents || [];
        filteredAgents = [...agents];
        updateStats();
        renderTable();
        
    } catch (error) {
        console.error('Failed to load data:', error);
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="6" class="error">Error loading team performance data</td></tr>';
    }
}

// Update statistics
function updateStats() {
    document.getElementById('totalAgents').textContent = agents.length;
    document.getElementById('totalTickets').textContent = agents.reduce((sum, a) => sum + (a.total_tickets || 0), 0);
    document.getElementById('closedTickets').textContent = agents.reduce((sum, a) => sum + (a.closed_tickets || 0), 0);
    
    const ratings = agents.filter(a => a.average_rating && a.average_rating !== '--').map(a => parseFloat(a.average_rating));
    const avg = ratings.length ? (ratings.reduce((a, b) => a + b) / ratings.length).toFixed(1) : '0';
    document.getElementById('avgRating').textContent = avg;
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
        const perf = getPerformance(agent);
        const row = `
            <tr>
                <td>
                    <div class="agent-info">
                        <div class="agent-avatar">
                            ${agent.profile_image ? 
                                `<img src="${agent.profile_image}" alt="${agent.agent_name}">` : 
                                agent.agent_name ? agent.agent_name.charAt(0).toUpperCase() : '?'
                            }
                        </div>
                        <div class="agent-details">
                            <div class="agent-name">${agent.agent_name || 'Unknown Agent'}</div>
                            <div class="agent-email">${agent.agent_email || ''}</div>
                        </div>
                    </div>
                </td>
                <td>${agent.total_tickets || 0}</td>
                <td>${agent.closed_tickets || 0}</td>
                <td>${agent.median_reply_time || '--'}</td>
                <td>${agent.average_rating || '--'}</td>
                <td><span class="priority ${perf.class}">${perf.text}</span></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Simple performance calculation
function getPerformance(agent) {
    const closed = agent.closed_tickets || 0;
    const rating = parseFloat(agent.average_rating) || 0;
    const replyTime = agent.median_reply_time;
    
    let score = 0;
    
    // Score based on closed tickets
    if (closed >= 15) score += 3;
    else if (closed >= 8) score += 2;
    else if (closed >= 3) score += 1;
    
    // Score based on rating
    if (rating >= 4.5) score += 3;
    else if (rating >= 4.0) score += 2;
    else if (rating >= 3.0) score += 1;
    
    // Score based on reply time
    if (replyTime && replyTime !== '--') {
        if (replyTime.includes('m') && !replyTime.includes('h')) {
            const minutes = parseInt(replyTime);
            if (minutes <= 5) score += 3;
            else if (minutes <= 10) score += 2;
            else if (minutes <= 15) score += 1;
        }
    }
    
    if (score >= 8) return { class: 'high', text: 'Excellent' };
    if (score >= 5) return { class: 'medium', text: 'Good' };
    return { class: 'low', text: 'Needs Help' };
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
    
    document.getElementById('resetDates').addEventListener('click', () => {
        initDatePickers();
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
        
        const perf = getPerformance(agent);
        
        if (filter === 'high') return perf.class === 'high';
        if (filter === 'medium') return perf.class === 'medium';
        if (filter === 'low') return perf.class === 'low';
        return true; // 'all' filter
    });
    
    renderTable();
}

// Initialize the dashboard
function initDashboard() {
    initDatePickers();
    setupEventListeners();
    loadData();
}

// Start when page loads
document.addEventListener('DOMContentLoaded', initDashboard);
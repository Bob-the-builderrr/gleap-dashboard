let allTickets = [];

async function loadDashboard() {
    showLoading(true);
    
    try {
        const res = await fetch("/api/agents");
        const data = await res.json();

        allTickets = data;
        
        // Update last updated time
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
        
        updateDashboard(data);
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading dashboard data. Please try again.');
    } finally {
        showLoading(false);
    }
}

function updateDashboard(data) {
    // Filter valid tickets (with actual ticket IDs)
    const valid = data.filter(r => r.ticket_id && r.ticket_id !== "-");

    // Update total tickets
    const totalTickets = valid.reduce((sum, r) => sum + Number(r.agent_open_ticket || 0), 0);
    document.getElementById("totalTickets").innerText = totalTickets.toLocaleString();

    // Update active agents
    const activeAgents = new Set(valid.map(r => r.agent_name)).size;
    document.getElementById("activeAgents").innerText = activeAgents.toLocaleString();

    // Update high priority tickets
    const highPriorityTickets = valid.filter(r => 
        r.priority && r.priority.toLowerCase().includes('high')
    ).length;
    document.getElementById("highPriorityTickets").innerText = highPriorityTickets.toLocaleString();

    // Update plan breakdown
    updatePlanBreakdown(valid);

    // Update table
    updateTable(data);

    // Update counts
    document.getElementById("showingCount").innerText = valid.length.toLocaleString();
}

function updatePlanBreakdown(validTickets) {
    const plan = {};
    validTickets.forEach(r => {
        const key = r.plan_type || "UNKNOWN_PLAN";
        const count = Number(r.agent_open_ticket || 0);
        plan[key] = (plan[key] || 0) + count;
    });

    const planDiv = document.getElementById("planBreakdown");
    planDiv.innerHTML = "";
    
    Object.entries(plan)
        .sort(([,a], [,b]) => b - a)
        .forEach(([planName, count]) => {
            const planItem = document.createElement("div");
            planItem.className = "plan-item";
            planItem.innerHTML = `
                <span class="plan-name">${planName}</span>
                <span class="plan-count">${count}</span>
            `;
            planDiv.appendChild(planItem);
        });
}

function updateTable(data) {
    const valid = data.filter(r => r.ticket_id && r.ticket_id !== "-");
    const empty = data.filter(r => !r.ticket_id || r.ticket_id === "-");
    const ordered = [...valid, ...empty];

    const tbody = document.getElementById("ticketRows");
    tbody.innerHTML = "";

    ordered.forEach(r => {
        const row = document.createElement("tr");
        
        // Determine priority class
        let priorityClass = 'priority-medium';
        if (r.priority) {
            if (r.priority.toLowerCase().includes('high')) priorityClass = 'priority-high';
            else if (r.priority.toLowerCase().includes('low')) priorityClass = 'priority-low';
        }

        // Determine status class
        let statusClass = 'status-open';
        if (r.ticket_status) {
            if (r.ticket_status.toLowerCase().includes('pending')) statusClass = 'status-pending';
            else if (r.ticket_status.toLowerCase().includes('closed')) statusClass = 'status-closed';
        }

        row.innerHTML = `
            <td>${r.agent_name || '-'}</td>
            <td><strong>${r.agent_open_ticket || '0'}</strong></td>
            <td><span class="${priorityClass}">${r.priority || 'Medium'}</span></td>
            <td><span class="${statusClass}">${r.ticket_status || 'Open'}</span></td>
            <td>${r.time_open_duration || '-'}</td>
            <td>${r.user_email || '-'}</td>
            <td>${r.plan_type || '-'}</td>
            <td>${r.tags || '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

function filterTickets() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredTickets = allTickets.filter(ticket => 
        Object.values(ticket).some(value => 
            value && value.toString().toLowerCase().includes(searchTerm)
        )
    );
    updateTable(filteredTickets);
    document.getElementById("showingCount").innerText = filteredTickets.filter(r => r.ticket_id && r.ticket_id !== "-").length.toLocaleString();
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
}

// Auto-refresh every 30 seconds
setInterval(loadDashboard, 30000);

// Initial load
document.addEventListener('DOMContentLoaded', loadDashboard);
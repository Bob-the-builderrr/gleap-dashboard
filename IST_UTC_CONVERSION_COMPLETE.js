// ═══════════════════════════════════════════════════════════════════
// IST TO UTC CONVERSION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Converts IST datetime string to UTC ISO string
 * IST = UTC + 5:30, so UTC = IST - 5:30
 */
function istToUtcIso(istDatetimeString) {
    const istDate = new Date(istDatetimeString);
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const utcMs = istDate.getTime() - IST_OFFSET_MS;
    return new Date(utcMs).toISOString();
}

/**
 * Gets the last 24-hour window in IST, returns UTC ISO strings for API
 * Example: If now is 24 Nov 08:30 IST
 * - START_IST: 23 Nov 08:30:00.000 → START_UTC: 23 Nov 03:00:00.000
 * - END_IST:   24 Nov 08:29:59.999 → END_UTC:   24 Nov 02:59:59.999
 */
function getLast24HoursUtc() {
    const nowIST = new Date(); // Current IST time (browser assumes IST)

    // End: Current moment (one millisecond ago to avoid overlap)
    const endIST = new Date(nowIST.getTime() - 1);

    // Start: 24 hours ago
    const startIST = new Date(nowIST.getTime() - 24 * 60 * 60 * 1000);

    // Convert both to UTC
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const startUtcMs = startIST.getTime() - IST_OFFSET_MS;
    const endUtcMs = endIST.getTime() - IST_OFFSET_MS;

    return {
        startUtc: new Date(startUtcMs).toISOString(),
        endUtc: new Date(endUtcMs).toISOString()
    };
}


// ═══════════════════════════════════════════════════════════════════
// UPDATED fetchAndRenderArchived FUNCTION
// ═══════════════════════════════════════════════════════════════════

async function fetchAndRenderArchived() {
    // PART 1: TABLE - Uses custom datetime inputs
    const customStartIST = dom.archivedStart.value; // e.g. "2025-11-24T04:30"
    const customEndIST = dom.archivedEnd.value;     // e.g. "2025-11-24T08:30"

    if (!customStartIST || !customEndIST) {
        showError("Please select start and end times");
        return;
    }

    // Convert IST inputs to UTC for API
    const tableStartUtc = istToUtcIso(customStartIST);
    const tableEndUtc = istToUtcIso(customEndIST);

    setLoading(true);

    try {
        // Fetch tickets for TABLE (custom range)
        const [archivedTickets, doneTickets] = await Promise.all([
            fetchArchivedTicketsUtc(tableStartUtc, tableEndUtc),
            fetchDoneTicketsUtc(tableStartUtc, tableEndUtc)
        ]);

        // Process and render TABLE
        const allTickets = [...archivedTickets, ...doneTickets];
        const { agentMap } = processArchivedTicketsUtc(allTickets, tableStartUtc, tableEndUtc);
        renderArchivedTable(agentMap);

        // PART 2: MATRIX - ALWAYS last 24 hours (independent!)
        const { startUtc, endUtc } = getLast24HoursUtc();

        const [matrix24Archived, matrix24Done] = await Promise.all([
            fetchArchivedTicketsUtc(startUtc, endUtc),
            fetchDoneTicketsUtc(startUtc, endUtc)
        ]);

        const matrixTickets = [...matrix24Archived, ...matrix24Done];
        const { hourlyMap } = processArchivedTicketsUtc(matrixTickets, startUtc, endUtc);
        renderHourlyBreakdown(hourlyMap);

    } catch (err) {
        showError(err.message || "Failed to load archived tickets");
        console.error(err);
    } finally {
        setLoading(false);
    }
}


// ═══════════════════════════════════════════════════════════════════
// UPDATED API FUNCTIONS (using UTC directly)
// ═══════════════════════════════════════════════════════════════════

async function fetchArchivedTicketsUtc(startUtc, endUtc) {
    const limit = 1000;
    const url = `https://dashapi.gleap.io/v3/tickets?skip=0&limit=${limit}&filter={}&sort=-archivedAt&ignoreArchived=true&isSpam=false&type[]=INQUIRY&archived=true`;

    const res = await fetch(url, { headers: GLEAP_HEADERS });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const tickets = data.tickets || [];

    // Filter by UTC time range
    const startMs = new Date(startUtc).getTime();
    const endMs = new Date(endUtc).getTime();

    return tickets.filter(t => {
        if (!t.archivedAt) return false;
        const ticketMs = new Date(t.archivedAt).getTime();
        return ticketMs >= startMs && ticketMs <= endMs;
    });
}

async function fetchDoneTicketsUtc(startUtc, endUtc) {
    const limit = 1000;
    const url = `https://dashapi.gleap.io/v3/tickets?type=INQUIRY&status=DONE&skip=0&limit=${limit}&filter={}&sort=-lastNotification`;

    const res = await fetch(url, { headers: GLEAP_HEADERS });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const tickets = data.tickets || [];

    // Filter by UTC time range
    const startMs = new Date(startUtc).getTime();
    const endMs = new Date(endUtc).getTime();

    return tickets.filter(t => {
        if (!t.updatedAt) return false;
        const ticketMs = new Date(t.updatedAt).getTime();
        return ticketMs >= startMs && ticketMs <= endMs;
    });
}


// ═══════════════════════════════════════════════════════════════════
// UPDATED processArchivedTicketsUtc FUNCTION
// ═══════════════════════════════════════════════════════════════════

function processArchivedTicketsUtc(tickets, startUtc, endUtc) {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    const windowStartMs = new Date(startUtc).getTime();
    const windowEndMs = new Date(endUtc).getTime();

    const agentMap = new Map();
    const hourlyMap = new Map();

    tickets.forEach(ticket => {
        let type = "Archived";
        let timestampUtc = null;

        if (ticket.archived && ticket.archivedAt) {
            type = "Archived";
            timestampUtc = new Date(ticket.archivedAt);
        } else if (ticket.status === "DONE" && ticket.updatedAt) {
            type = "Done";
            timestampUtc = new Date(ticket.updatedAt);
        } else {
            return;
        }

        if (!timestampUtc || isNaN(timestampUtc.getTime())) return;

        const ticketMs = timestampUtc.getTime();
        if (ticketMs < windowStartMs || ticketMs > windowEndMs) return;

        // Convert UTC to IST for display
        const timestampIST = new Date(ticketMs + IST_OFFSET_MS);

        const user = ticket.processingUser || {};
        const agentId = user.id || "unknown";
        const agentName = user.firstName || user.email?.split("@")[0] || "Unknown";
        const agentEmail = user.email || "";
        const profileImage = user.profileImageUrl || "";
        const lastSeen = user.lastSeen || null;

        const ticketDetails = {
            id: ticket.id,
            bugId: ticket.bugId,
            timestamp: timestampIST,
            type: type
        };

        if (!agentMap.has(agentId)) {
            agentMap.set(agentId, {
                id: agentId,
                name: agentName,
                email: agentEmail,
                profileImage,
                lastSeen,
                tickets: [],
                ticketDetails: [],
                latestTimestamp: timestampIST
            });
        }

        const agentData = agentMap.get(agentId);
        agentData.tickets.push(timestampIST);
        agentData.ticketDetails.push(ticketDetails);

        if (timestampIST > agentData.latestTimestamp) {
            agentData.latestTimestamp = timestampIST;
        }

        // For hourly matrix, use IST hour
        const hour = timestampIST.getUTCHours();
        const hourKey = `h${hour}`;

        if (!hourlyMap.has(hourKey)) {
            hourlyMap.set(hourKey, new Map());
        }

        const hourAgents = hourlyMap.get(hourKey);
        if (!hourAgents.has(agentId)) {
            hourAgents.set(agentId, {
                name: agentName,
                email: agentEmail,
                profileImage: profileImage,
                count: 0
            });
        }

        hourAgents.get(agentId).count++;
    });

    return { agentMap, hourlyMap };
}


// ═══════════════════════════════════════════════════════════════════
// LOGIC EXPLANATION
// ═══════════════════════════════════════════════════════════════════

/**
 * HOW IT WORKS:
 * 
 * 1. TABLE (Top section):
 *    - User selects custom datetime range in IST (e.g., "Last 4 hours")
 *    - We convert those IST times to UTC
 *    - Fetch tickets within that UTC range
 *    - Display results in table
 * 
 * 2. MATRIX (Bottom section - INDEPENDENT):
 *    - ALWAYS fetches last 24 hours from current time
 *    - Calculates: NOW - 24 hours (both in IST)
 *    - Converts to UTC for API call
 *    - Builds 24-hour matrix (00-23 IST hours)
 *    - Updates on EVERY fetch (not affected by table filter)
 * 
 * 3. IST → UTC Conversion:
 *    - IST is UTC+5:30
 *    - To convert: UTC = IST - 5 hours 30 minutes
 *    - Example: 24 Nov 08:30 IST → 24 Nov 03:00 UTC
 * 
 * 4. API Filtering:
 *    - We fetch all tickets from Gleap (up to limit)
 *    - Then filter client-side by UTC timestamp range
 *    - This ensures accurate time-based filtering
 * 
 * 5. Display:
 *    - All times shown to user are in IST
 *    - All API calls use UTC
 *    - Conversion happens at boundary points
 */

// COPY THIS ENTIRE FUNCTION AND REPLACE lines 734-777 in dashboard.js

async function fetchAndRenderArchived() {
    const selection = dom.archivedWindow.value;
    let minutes = 0;
    let customStart = null;
    let customEnd = null;

    // Handle Custom Range
    if (selection === "custom") {
        dom.archivedCustomRange.classList.remove("hidden");

        // Check if custom inputs have values (triggered by Go button)
        if (dom.archivedStart.value && dom.archivedEnd.value) {
            customStart = dom.archivedStart.value;
            customEnd = dom.archivedEnd.value;
        } else {
            // Don't fetch yet, wait for user to enter dates and click Go
            return;
        }
    } else {
        dom.archivedCustomRange.classList.add("hidden");
        minutes = Number(selection);
    }

    setLoading(true);

    try {
        const [archivedTickets, doneTickets] = await Promise.all([
            fetchArchivedTickets(minutes, customStart, customEnd),
            fetchDoneTickets(minutes, customStart, customEnd)
        ]);

        // Merge tickets
        const allTickets = [...archivedTickets, ...doneTickets];

        const { agentMap, hourlyMap } = processArchivedTickets(allTickets, minutes, customStart, customEnd);

        renderArchivedTable(agentMap);
        renderHourlyBreakdown(hourlyMap);
    } catch (err) {
        showError(err.message || "Failed to load archived tickets");
        console.error(err);
    } finally {
        setLoading(false);
    }
}

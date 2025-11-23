import fetch from "node-fetch";

const PROJECT_ID = process.env.GLEAP_PROJECT_ID || "64d9fa1b014ae7130f2e58d1";
const DEFAULT_GLEAP_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MmQ0ZTcwOTY5OGViOGI5NjkwOTY5OSIsImlhdCI6MTc2MjUxNDY4MSwiZXhwIjoxNzY1MTA2NjgxfQ.Q_qrK1At7-Yrt_-gPmjP-U8Xj3GAEpsiX_VzZxYwKYE";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const token =
            process.env.GLEAP_TOKEN ||
            process.env.GLEAP_API_TOKEN ||
            process.env.GLEAP_DASH_TOKEN ||
            DEFAULT_GLEAP_TOKEN;
        const cleanedToken = token.startsWith("Bearer ")
            ? token.replace(/^Bearer\s+/i, "")
            : token;

        // URL from user's request for "All Tickets" (Open)
        // https://dashapi.gleap.io/v3/tickets?skip=0&limit=1&filter={}&sort=-lastNotification&ignoreArchived=true&isSpam=false&type[]=INQUIRY&archived=true
        // WAIT: The user provided TWO cURLs.
        // 1. The "Archived" one (which we fixed).
        // 2. The "All Tickets" one (which returns status: OPEN).
        // The user said: "Also we need to add one more before overview which has to say all tickets ,, The curl for it will be..."
        // And the response showed "status": "OPEN", "archived": false.
        // So I need to construct the URL for OPEN tickets.

        // Looking at the user's second cURL example (implied from the response data):
        // It seems to be fetching non-archived tickets.
        // Let's use a standard "Open Tickets" query.

        const limit = req.query.limit || 50;

        const url = `https://dashapi.gleap.io/v3/tickets?skip=0&limit=${limit}&filter={}&sort=-lastNotification&ignoreArchived=true&isSpam=false&type[]=INQUIRY&archived=false`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${cleanedToken}`,
                project: PROJECT_ID,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gleap API Error: ${err}`);
        }

        const data = await response.json();

        res.setHeader("Cache-Control", "no-store");
        res.status(200).json(data);
    } catch (err) {
        console.error("Open tickets error:", err);
        res.status(500).json({ error: err.message });
    }
}

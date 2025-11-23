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

        const limit = req.query.limit || 200;

        // URL matching the user's "working" curl for archived tickets
        // removed status=DONE, added ignoreArchived=true, archived=true
        const url = `https://dashapi.gleap.io/v3/tickets?skip=0&limit=${limit}&filter={}&sort=-archivedAt&ignoreArchived=true&isSpam=false&type[]=INQUIRY&archived=true`;

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
        console.error("Archived tickets error:", err);
        res.status(500).json({ error: err.message });
    }
}

import { createClient } from "@libsql/client";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } }
};

const turso = createClient({
  url: "https://gleaplive-bob-the-builderrr.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjM2MTE3MDEsImlkIjoiY2Y3ZDVlZTEtZDg4ZC00OWFmLWFiZWItNDEwNmI1Zjk4NWE4IiwicmlkIjoiMGVjMzNmNGYtMTU5ZC00NWQ5LWFmNzctNTgzODlkNmUwMjg1In0.3Gi7P4w6J1_Us0Q-vLMmcYeawbEsB_DfBxOsINX5DExQJa7Cc4cJFNhwz-ftf0hiRaxJUy_Jdsm9wy9qXNEMDQ"
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const rows = req.body?.rows;

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Rows missing or invalid" });
    }

    for (const r of rows) {
      await turso.execute({
        sql: `
          INSERT INTO open_tickets (
            Ticket_ID, Agent_Name, Ticket_Status, Ticket_Type, Priority,
            Plan_Type, User_Email, User_Name, Updated_At, SLA_Breached,
            Has_Agent_Reply, Tags, Latest_Comment_Created_At,
            Time_Open_Duration, Agent_Open_Ticket, refreshed_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT (Ticket_ID) DO UPDATE SET
            Agent_Name = excluded.Agent_Name,
            Ticket_Status = excluded.Ticket_Status,
            Ticket_Type = excluded.Ticket_Type,
            Priority = excluded.Priority,
            Plan_Type = excluded.Plan_Type,
            User_Email = excluded.User_Email,
            User_Name = excluded.User_Name,
            Updated_At = excluded.Updated_At,
            SLA_Breached = excluded.SLA_Breached,
            Has_Agent_Reply = excluded.Has_Agent_Reply,
            Tags = excluded.Tags,
            Latest_Comment_Created_At = excluded.Latest_Comment_Created_At,
            Time_Open_Duration = excluded.Time_Open_Duration,
            Agent_Open_Ticket = excluded.Agent_Open_Ticket,
            refreshed_at = datetime('now');
        `,
        args: [
          r.Ticket_ID,
          r.Agent_Name,
          r.Ticket_Status,
          r.Ticket_Type,
          r.Priority,
          r.Plan_Type,
          r.User_Email,
          r.User_Name,
          r.Updated_At,
          r.SLA_Breached,
          r.Has_Agent_Reply,
          r.Tags,
          r.Latest_Comment_Created_At,
          r.Time_Open_Duration,
          r.Agent_Open_Ticket
        ]
      });
    }

    return res.status(200).json({ ok: true, updated: rows.length });

  } catch (err) {
    console.error("UPSERT ERROR:", err);
    return res.status(500).json({ error: "Upsert failed", details: String(err) });
  }
}

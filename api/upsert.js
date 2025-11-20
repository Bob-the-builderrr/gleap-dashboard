import { createClient } from "@libsql/client";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
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
      return res.status(400).json({ error: "Invalid or missing rows" });
    }

    for (const r of rows) {
      await turso.execute({
        sql: `
          INSERT INTO open_tickets (
            ticket_id, agent_name, ticket_status, ticket_type,
            priority, plan_type, user_email, user_name, updated_at,
            sla_breached, has_agent_reply, tags, latest_comment_created_at,
            time_open_duration, agent_open_ticket, refreshed_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
          )
        `,
        args: [
          r.Ticket_ID, r.Agent_Name, r.Ticket_Status, r.Ticket_Type,
          r.Priority, r.Plan_Type, r.User_Email, r.User_Name,
          r.Updated_At, r.SLA_Breached, r.Has_Agent_Reply,
          r.Tags, r.Latest_Comment_Created_At,
          r.Time_Open_Duration, r.Agent_Open_Ticket
        ]
      });
    }

    return res.status(200).json({ ok: true, updated: rows.length });

  } catch (err) {
    console.error("INSERT ERROR:", err);
    return res.status(500).json({ error: "Upsert failed", details: String(err) });
  }
}
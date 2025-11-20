import { createClient } from "@libsql/client";

const turso = createClient({
  url: "https://gleaplive-bob-the-builderrr.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjM2MTE3MDEsImlkIjoiY2Y3ZDVlZTEtZDg4ZC00OWFmLWFiZWItNDEwNmI1Zjk4NWE4IiwicmlkIjoiMGVjMzNmNGYtMTU5ZC00NWQ5LWFmNzctNTgzODlkNmUwMjg1In0.3Gi7P4w6J1_Us0Q-vLMmcYeawbEsB_DfBxOsINX5DExQJa7Cc4cJFNhwz-ftf0hiRaxJUy_Jdsm9wy9qXNEMDQ"
});

// POST /api/upsert
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const rows = req.body;

  if (!Array.isArray(rows)) {
    return res.status(400).send("Invalid payload");
  }

  try {
    for (const r of rows) {
      await turso.execute({
        sql: `
        INSERT INTO open_tickets (
          id, ticket_id, agent_name, agent_open_ticket, ticket_status,
          ticket_type, priority, sla_breached, has_agent_reply,
          time_open_duration, tags, updated_at, latest_comment_created_at,
          plan_type, user_name, user_email, refreshed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          ticket_id = excluded.ticket_id,
          agent_name = excluded.agent_name,
          agent_open_ticket = excluded.agent_open_ticket,
          ticket_status = excluded.ticket_status,
          ticket_type = excluded.ticket_type,
          priority = excluded.priority,
          sla_breached = excluded.sla_breached,
          has_agent_reply = excluded.has_agent_reply,
          time_open_duration = excluded.time_open_duration,
          tags = excluded.tags,
          updated_at = excluded.updated_at,
          latest_comment_created_at = excluded.latest_comment_created_at,
          plan_type = excluded.plan_type,
          user_name = excluded.user_name,
          user_email = excluded.user_email,
          refreshed_at = excluded.refreshed_at;
        `,
        args: [
          r.id, r.ticket_id, r.agent_name, r.agent_open_ticket,
          r.ticket_status, r.ticket_type, r.priority, r.sla_breached,
          r.has_agent_reply, r.time_open_duration, r.tags,
          r.updated_at, r.latest_comment_created_at, r.plan_type,
          r.user_name, r.user_email, r.refreshed_at
        ]
      });
    }

    res.status(200).send("OK");

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upsert failed" });
  }
}

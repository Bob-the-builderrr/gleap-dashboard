import { createClient } from "@libsql/client";

const turso = createClient({
  url: "https://gleaplive-bob-the-builderrr.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjM2MTE3MDEsImlkIjoiY2Y3ZDVlZTEtZDg4ZC00OWFmLWFiZWItNDEwNmI1Zjk4NWE4IiwicmlkIjoiMGVjMzNmNGYtMTU5ZC00NWQ5LWFmNzctNTgzODlkNmUwMjg1In0.3Gi7P4w6J1_Us0Q-vLMmcYeawbEsB_DfBxOsINX5DExQJa7Cc4cJFNhwz-ftf0hiRaxJUy_Jdsm9wy9qXNEMDQ"
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const rows = req.body.rows;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid input" });
    }

    for (const r of rows) {
      await turso.execute({
        sql: `
          INSERT INTO open_tickets (
            id, ticket_id, agent_name, agent_id, ticket_status, ticket_type,
            priority, plan_type, user_email, user_name, updated_at,
            sla_breached, has_agent_reply, tags, latest_comment_created_at,
            time_open_duration, agent_open_ticket, refreshed_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
          )
          ON CONFLICT (id) DO UPDATE SET
            ticket_id = excluded.ticket_id,
            agent_name = excluded.agent_name,
            agent_id = excluded.agent_id,
            ticket_status = excluded.ticket_status,
            ticket_type = excluded.ticket_type,
            priority = excluded.priority,
            plan_type = excluded.plan_type,
            user_email = excluded.user_email,
            user_name = excluded.user_name,
            updated_at = excluded.updated_at,
            sla_breached = excluded.sla_breached,
            has_agent_reply = excluded.has_agent_reply,
            tags = excluded.tags,
            latest_comment_created_at = excluded.latest_comment_created_at,
            time_open_duration = excluded.time_open_duration,
            agent_open_ticket = excluded.agent_open_ticket,
            refreshed_at = datetime('now');
        `,
        args: [
          r.id, r.ticket_id, r.agent_name, r.agent_id, r.ticket_status,
          r.ticket_type, r.priority, r.plan_type, r.user_email, r.user_name,
          r.updated_at, r.sla_breached, r.has_agent_reply, r.tags,
          r.latest_comment_created_at, r.time_open_duration,
          r.agent_open_ticket
        ]
      });
    }

    res.status(200).json({ message: "Success" });

  } catch (err) {
    console.error("Upsert ERROR:", err);
    res.status(500).json({ error: "Database upsert failed" });
  }
}

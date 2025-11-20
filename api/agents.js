import { createClient } from "@libsql/client";

const turso = createClient({
  url: "https://gleaplive-bob-the-builderrr.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjM2MTE3MDEsImlkIjoiY2Y3ZDVlZTEtZDg4ZC00OWFmLWFiZWItNDEwNmI1Zjk4NWE4IiwicmlkIjoiMGVjMzNmNGYtMTU5ZC00NWQ5LWFmNzctNTgzODlkNmUwMjg1In0.3Gi7P4w6J1_Us0Q-vLMmcYeawbEsB_DfBxOsINX5DExQJa7Cc4cJFNhwz-ftf0hiRaxJUy_Jdsm9wy9qXNEMDQ"
});

export default async function handler(req, res) {
  try {
    const result = await turso.execute("SELECT * FROM open_tickets");

    const rows = result.rows || [];

    const sorted = rows.sort(
      (a, b) => Number(b.Agent_Open_Ticket || 0) - Number(a.Agent_Open_Ticket || 0)
    );

    res.status(200).json(sorted);

  } catch (err) {
    console.error("AGENTS ERROR:", err);
    res.status(500).json({ error: "Database fetch error" });
  }
}

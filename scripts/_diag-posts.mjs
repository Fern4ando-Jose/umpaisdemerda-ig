import { sql } from "@vercel/postgres";

const posts = await sql`
  SELECT topic, slot, title, lang, instagram_post_id, published_at
  FROM posts
  ORDER BY published_at DESC
  LIMIT 12
`;
console.log("=== posts (carrosséis) — mais recentes ===");
for (const r of posts.rows) {
  console.log(
    `${r.published_at?.toISOString?.() ?? r.published_at} | ${r.lang} | ${r.slot} | ig=${r.instagram_post_id ?? "—"} | title="${r.title ?? ""}" | topic="${r.topic}"`
  );
}

const runs = await sql`
  SELECT day, run, lang, kind, topic, instagram_post_id, ts
  FROM published_runs
  ORDER BY ts DESC
  LIMIT 14
`;
console.log("\n=== published_runs (reels) — mais recentes ===");
for (const r of runs.rows) {
  console.log(
    `${r.ts?.toISOString?.() ?? r.ts} | day=${r.day} run=${r.run} | ${r.lang} | kind=${r.kind ?? "—"} | ig=${r.instagram_post_id ?? "—"} | topic="${r.topic ?? "—"}"`
  );
}
process.exit(0);

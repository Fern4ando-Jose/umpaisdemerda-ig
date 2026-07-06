import { sql } from "@vercel/postgres";
const r = await sql`
  SELECT title, lang, instagram_post_id, published_at, topic
  FROM posts
  WHERE topic = 'Nadie te debe nada'
  ORDER BY published_at DESC
  LIMIT 4`;
console.log("=== Carrossel 'Nadie te debe nada' (teste da trava) ===");
for (const x of r.rows) {
  console.log(`${x.published_at?.toISOString?.() ?? x.published_at} | ${x.lang} | ig=${x.instagram_post_id ?? "—"} | TÍTULO="${x.title}"`);
}
process.exit(0);

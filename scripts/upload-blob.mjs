// ─── Upload do reel para o Vercel Blob ────────────────────────────────────────
// Sobe out/reel.mp4 para o Vercel Blob Store (acesso público) e imprime a URL
// pública em stdout (apenas a URL na última linha — fácil de capturar no CI).
//
// Requer:  process.env.BLOB_READ_WRITE_TOKEN  (token do Blob store da Vercel)
//
// Uso:
//   node scripts/upload-blob.mjs                 → sobe out/reel.mp4
//   node scripts/upload-blob.mjs caminho/x.mp4   → sobe arquivo informado

import { put } from "@vercel/blob";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, ".."); // raiz do projeto

async function main() {
  // .trim() remove quebras de linha/espaços que entram ao colar o token no
  // secret — sem isso o fetch lança "invalid header value".
  // Aceita tanto o token puro quanto um bloco .env colado do painel da Vercel
  // (ex.: BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."): extrai o token de dentro.
  const raw = process.env.BLOB_READ_WRITE_TOKEN || "";
  const match = raw.match(/vercel_blob_rw_[A-Za-z0-9_-]+/);
  const token = match ? match[0] : raw.trim();
  if (!token) {
    console.error("[upload] faltando BLOB_READ_WRITE_TOKEN no ambiente");
    process.exit(1);
  }
  if (!token.startsWith("vercel_blob_rw_")) {
    console.error("[upload] BLOB_READ_WRITE_TOKEN não parece um token válido (esperado prefixo vercel_blob_rw_)");
    process.exit(1);
  }

  const fileArg = process.argv[2];
  const filePath = fileArg
    ? resolve(process.cwd(), fileArg)
    : resolve(ROOT, "out", "reel.mp4");

  const data = readFileSync(filePath);

  // Nome único por execução p/ evitar cache de versões antigas
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `reels/reel-${stamp}.mp4`;

  console.error(`[upload] enviando ${filePath} → ${key} …`);
  const blob = await put(key, data, {
    access: "public",
    contentType: "video/mp4",
    token,
  });

  // Logs de diagnóstico vão para stderr; a URL limpa vai para stdout.
  console.error(`[upload] concluído: ${blob.url}`);
  console.log(blob.url);
}

main().catch((err) => {
  console.error("[upload] erro:", err);
  process.exit(1);
});

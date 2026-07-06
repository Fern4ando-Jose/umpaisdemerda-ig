# @umpaisdemerda — automação de Instagram

Backend (Next.js) da automação de Instagram **@umpaisdemerda** — sátira política libertária
PT-BR, **anti-casta e apartidária**. Gera copy via Claude, renderiza carrossel (`next/og`,
estilo jornal) e Reel (footage de banco + Remotina), e publica via Instagram Graph API v25,
com rotação de temas, trava anti-duplicata e teto de gasto.

> Não é um site de marca — é só o **conjunto de rotas `/api`** que a automação usa. O
> agendamento roda em GitHub Actions (cron); o deploy é na Vercel; o banco é Neon Postgres.

## Rotas principais (`src/app/api`)
- `publish` — escolhe o tema, gera a copy (Claude) e publica o carrossel.
- `publish-reel` — publica o Reel (vídeo) a partir de uma URL pública (Vercel Blob).
- `og` — renderiza os slides do carrossel (estilo jornal).
- `insights` · `posts` · `runs-status` — métricas e leitura do que saiu.
- `migrate` · `refresh-token` · `spend` · `reel-share` · `catchup` — infra de apoio.

Voz, temas e régua: fonte única no **código** (`src/lib/accounts.ts` + `THEMES` em
`src/app/api/publish/route.ts`). Visão do pipeline: ver `ORGANOGRAMA.html`.

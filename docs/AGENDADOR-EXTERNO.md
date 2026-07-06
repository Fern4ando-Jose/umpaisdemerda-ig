# Agendador externo do catch-up (opção B)

**Problema:** o cron do GitHub Actions atrasa/derruba runs — e às vezes derruba até o
próprio `catchup.yml` (a rede de segurança roda no mesmo trilho que falha). Resultado:
posts saem atrasados ou exigem redisparo manual.

**Solução:** um cron **EXTERNO** (independente do GitHub) bate de hora em hora no
endpoint `/api/catchup`, que consulta o que falta publicar e redispara os workflows
certos via a API do GitHub. Idempotente (trava 7d / livro-razão dedup → não duplica).

> O endpoint `/api/catchup` já está no ar (código). Falta só **2 passos manuais** seus,
> porque dependem das suas contas (GitHub + serviço de cron). ~5 min.

## Passo 1 — PAT do GitHub na Vercel (`GH_DISPATCH_TOKEN`)

1. GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**.
   - **Repository access:** Only select repositories → `dr-libertad-site`.
   - **Permissions → Repository → Actions: Read and write**.
   - Expiração: 90 dias (ou o que preferir; anotar pra renovar).
2. Copie o token (`github_pat_...`).
3. Vercel → projeto `dr-libertad-site` → **Settings → Environment Variables** →
   - Name: `GH_DISPATCH_TOKEN` · Value: o token · Environments: **Production**.
4. **Redeploy** (ou aguardar o próximo deploy) pra a env valer.

## Passo 2 — Cron externo (cron-job.org, grátis)

1. Crie conta em **https://cron-job.org** (grátis).
2. **Create cronjob:**
   - **URL:** `https://www.drlibertad.com/api/catchup`
   - **Schedule:** a cada hora (ex.: minuto 35 → "35 * * * *"). Pode pôr 2×/h se quiser.
   - **Request method:** GET.
   - **Headers:** `Authorization: Bearer <CRON_SECRET>` (o mesmo CRON_SECRET do projeto).
3. Salvar e ativar.

> Segurança: o **PAT fica na Vercel** (não no cron-job.org). O cron externo só manda o
> `CRON_SECRET` (que já é usado nos outros endpoints).

## Testar

Com o PAT setado, dá pra disparar na mão (ou ver a resposta):
```
curl -H "Authorization: Bearer <CRON_SECRET>" https://www.drlibertad.com/api/catchup
```
Resposta esperada: `{"ok":true, ..., "dispatched":[...], "failed":[]}`. Se vier
`GH_DISPATCH_TOKEN ausente`, falta o Passo 1. Se `dispatched` listar runs, eles foram
redisparados (confira em Actions / no Instagram minutos depois).

## Observações

- O `catchup.yml` (cron do GitHub) **continua existindo** como backup — os dois são
  idempotentes, não há risco de duplicar.
- Com o **cache da copy** (PR #45) já no ar, redisparo **não repaga** a Anthropic →
  mesmo vários resgates/dia não estouram o orçamento. Este agendador melhora só o
  **horário** (posts mais pontuais).

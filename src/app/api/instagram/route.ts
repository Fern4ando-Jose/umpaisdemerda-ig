import { NextRequest, NextResponse } from 'next/server'
import { accountFor } from '@/lib/accounts'

// Lista crua da mídia publicada na conta via Graph API — endpoint de DEBUG.
// Atrás do CRON_SECRET (igual aos demais endpoints operacionais).
//
//   GET /api/instagram   → mídia da conta (debug)
//
// Exige: Authorization: Bearer <CRON_SECRET>.
// NUNCA logar o token (AGENTS.md §1.3) nem ecoar resposta crua da Graph API ao cliente.

function authorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Conta do produto (isolamento chave-por-produto) — envs Meta _UPM via accounts.ts.
  const acc = accountFor('pt')
  const TOKEN = process.env[acc.tokenEnv]
  const ACCOUNT_ID = process.env[acc.accountIdEnv]

  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${ACCOUNT_ID}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${TOKEN}`,
    )
    const data = await res.json()

    if (!res.ok) {
      console.error('Graph API erro:', res.status)
      return NextResponse.json({ error: 'Falha ao consultar a Graph API' }, { status: 502 })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('api/instagram erro:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

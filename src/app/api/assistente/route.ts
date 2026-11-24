// GET /api/assistente — conhecimento do tira-dúvidas (só dados públicos).
// O widget busca isto quando o visitante abre o chat e responde no próprio
// navegador (src/lib/assistant/engine.ts). Route Handlers não têm cache no
// Next 16; o s-maxage curto só segura picos na CDN sem deixar dado velho.
import { getAssistantKnowledge } from "@/lib/queries/assistant";

export async function GET() {
  const knowledge = await getAssistantKnowledge();
  return Response.json(knowledge, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}

// GET /backstage/inscricoes/[eventId]/qrcode?formato=png|svg — QR code do evento (FA-30).
// Aponta pra página de inscrição (?origem=qr, pra contar quem veio pelo QR) ou,
// se o evento não tem formulário do site, pra página do evento.
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { canSeeRegistrations, getPanelActorForRoute } from "@/lib/registrations";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const actor = await getPanelActorForRoute();
  if (!actor) return new Response("Sem acesso", { status: 401 });

  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, ministryId: true, registrationMode: true },
  });
  if (!event || !canSeeRegistrations(actor, event.ministryId)) return new Response("Não encontrado", { status: 404 });

  // Mesmo domínio em que a equipe está usando o painel (o domínio oficial em produção).
  const origin = new URL(request.url).origin;
  const target =
    event.registrationMode === "INTERNAL"
      ? `${origin}/agenda/${event.slug}/inscricao?origem=qr`
      : `${origin}/agenda/${event.slug}`;

  const format = new URL(request.url).searchParams.get("formato") === "svg" ? "svg" : "png";
  const filename = `qrcode-${event.slug}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };

  if (format === "svg") {
    const svg = await QRCode.toString(target, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  }
  const png = await QRCode.toBuffer(target, { type: "png", width: 1200, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}

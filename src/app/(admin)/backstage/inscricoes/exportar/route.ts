// GET /backstage/inscricoes/exportar?evento=<id>  → planilha de um evento
// GET /backstage/inscricoes/exportar?mes=2026-11  → uma aba por evento do mês (FA-32)
// É saída de dado pessoal: fica na auditoria (sem nome/WhatsApp de ninguém no log).
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/auth-and-audit";
import { formatPhone } from "@/lib/registration-rules";
import { SITE_NAME } from "@/lib/site-config";
import {
  canSeeRegistrations,
  getEventRegistrations,
  getPanelActorForRoute,
  isMonth,
  monthLabel,
  purgeExpiredRegistrations,
  visibleEventsWhere,
} from "@/lib/registrations";

const TIME_ZONE = "America/Sao_Paulo";
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });

type EventForSheet = { id: string; title: string; startsAt: Date };

/** Nome de aba do Excel: até 31 caracteres, sem []:*?/\ e sem repetir. */
function sheetName(event: EventForSheet, used: Set<string>): string {
  const suffix = ` ${dayMonth.format(event.startsAt).replace("/", "-")}`;
  const base = event.title.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
  let name = `${base.slice(0, 31 - suffix.length).trim()}${suffix}`;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${name.slice(0, 28)} ${n}`;
  used.add(name.toLowerCase());
  return name;
}

async function addEventSheet(workbook: ExcelJS.Workbook, event: EventForSheet, used: Set<string>) {
  const registrations = await getEventRegistrations(event.id);
  const sheet = workbook.addWorksheet(sheetName(event, used), { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Nome", key: "name", width: 32 },
    { header: "WhatsApp", key: "phone", width: 18 },
    { header: "Pessoas", key: "partySize", width: 10 },
    { header: "Primeira vez", key: "firstTime", width: 14 },
    { header: "Situação", key: "status", width: 13 },
    { header: "Presença", key: "present", width: 11 },
    { header: "Veio por", key: "source", width: 10 },
    { header: "Inscrito em", key: "createdAt", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const r of registrations) {
    sheet.addRow({
      name: r.name,
      phone: formatPhone(r.phone),
      partySize: r.partySize,
      firstTime: r.firstTime === null ? "" : r.firstTime ? "Sim" : "Não",
      status: r.status === "CONFIRMED" ? "Confirmada" : "Cancelada",
      present: r.checkedInAt ? "Sim" : "",
      source: r.source === "qr" ? "QR code" : "Site",
      createdAt: dateTime.format(r.createdAt),
    });
  }
  const confirmed = registrations.filter((r) => r.status === "CONFIRMED");
  sheet.addRow({});
  sheet.addRow({ name: "Total confirmado", partySize: confirmed.reduce((sum, r) => sum + r.partySize, 0) }).font = {
    bold: true,
  };
  return registrations.length;
}

function xlsxResponse(buffer: ArrayBuffer, filename: string) {
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const actor = await getPanelActorForRoute();
  if (!actor) return new Response("Sem acesso", { status: 401 });
  await purgeExpiredRegistrations();

  const params = new URL(request.url).searchParams;
  const eventId = params.get("evento");
  const month = params.get("mes") ?? undefined;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = SITE_NAME;
  const used = new Set<string>();

  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true, startsAt: true, ministryId: true },
    });
    if (!event || !canSeeRegistrations(actor, event.ministryId)) return new Response("Não encontrado", { status: 404 });

    const count = await addEventSheet(workbook, event, used);
    await prisma.$transaction((tx) =>
      audit(tx, actor, {
        action: "EXPORT",
        entityType: "REGISTRATION",
        entityId: event.id,
        entityLabel: `Planilha de inscritos · ${event.title}`,
        changes: { linhas: count },
      })
    );
    return xlsxResponse(await workbook.xlsx.writeBuffer(), `inscricoes-${event.slug}.xlsx`);
  }

  if (!isMonth(month)) return new Response("Informe ?evento= ou ?mes=AAAA-MM", { status: 400 });

  const start = new Date(`${month}-01T00:00:00-03:00`);
  const [y, m] = month.split("-").map(Number);
  const end = new Date(`${m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`}-01T00:00:00-03:00`);
  const events = await prisma.event.findMany({
    where: { ...visibleEventsWhere(actor), registrationMode: "INTERNAL", startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true },
  });

  let count = 0;
  for (const event of events) count += await addEventSheet(workbook, event, used);
  if (events.length === 0) workbook.addWorksheet("Sem inscrições").addRow(["Nenhum evento com inscrição neste mês."]);

  await prisma.$transaction((tx) =>
    audit(tx, actor, {
      action: "EXPORT",
      entityType: "REGISTRATION",
      entityId: `mes:${month}`,
      entityLabel: `Planilha de inscritos · ${monthLabel(month)}`,
      changes: { eventos: events.length, linhas: count },
    })
  );
  return xlsxResponse(await workbook.xlsx.writeBuffer(), `inscricoes-${month}.xlsx`);
}

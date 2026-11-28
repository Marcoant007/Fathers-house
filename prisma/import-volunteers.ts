// prisma/import-volunteers.ts — importa a planilha de voluntariado (Escala dos
// Ministérios, parte 1).
//
//   pnpm tsx prisma/import-volunteers.ts                 → só mostra o relatório (não grava)
//   pnpm tsx prisma/import-volunteers.ts --apply         → grava no banco do .env.local
//   pnpm tsx prisma/import-volunteers.ts --file outra.xlsx
//   pnpm tsx prisma/import-volunteers.ts --details --apply
//       → SÓ completa os "mais detalhes" de quem já está no cadastro (não cria
//         ninguém e não mexe nas equipes — seguro depois que os líderes já
//         arrumaram as equipes no painel).
//
// A planilha fica em escala/ (no .gitignore: tem nome e telefone). Este script
// não guarda nenhum dado pessoal no código; o relatório só mostra números.
// Pode rodar de novo: casa a pessoa pelo telefone e só completa o que falta.
//
// Importa nome, telefone, departamentos, disponibilidade, manhã/noite, termo
// assinado, a resposta de antecedentes (campo sensível, escondido por padrão) e
// os "mais detalhes" (aniversário, estado civil, cidade, batismo, ano de
// conversão — 2026-11-26, a pedido do usuário: os líderes tinham isso na
// planilha). Idade não: sai da data de nascimento.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import ExcelJS from "exceljs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, type MembershipStatus } from "../src/generated/prisma/client";
import {
  DEPARTMENTS,
  TEAM_TABS,
  mergeRecords,
  normalizeKey,
  normalizePhone,
  parseAvailability,
  parseSundayShift,
  parseYesNo,
  splitDepartmentChoices,
  type SourceRecord,
  type VolunteerDetails,
} from "../src/lib/volunteer-import";
import { birthFromDate, convertedYearFrom, parseMaritalStatus } from "../src/lib/volunteer-details";
import { slugify } from "../src/lib/slugify";

const SOURCE = "planilha-voluntariado";
const FORM_TAB = "INSCRIÇÕES";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const detailsOnly = args.includes("--details");
const fileArg = args.indexOf("--file");
const file = fileArg >= 0 ? args[fileArg + 1] : "escala/Voluntariado.xlsx";

type Sheet = ExcelJS.Worksheet;

/** Linha de cabeçalho (a primeira, entre as 6 de cima, com uma coluna "Nome…") e o mapa coluna → texto. */
function readHeader(sheet: Sheet): { row: number; cols: Map<number, string> } | null {
  for (let r = 1; r <= Math.min(6, sheet.rowCount); r++) {
    const cols = new Map<number, string>();
    sheet.getRow(r).eachCell((cell, col) => {
      const text = normalizeKey(cell.text ?? "");
      if (text) cols.set(col, text);
    });
    if ([...cols.values()].some((t) => t.startsWith("nome"))) return { row: r, cols };
  }
  return null;
}

function findCol(cols: Map<number, string>, test: (header: string) => boolean): number | null {
  for (const [col, header] of cols) if (test(header)) return col;
  return null;
}

function text(sheet: Sheet, row: number, col: number | null): string {
  if (col == null) return "";
  try {
    return (sheet.getRow(row).getCell(col).text ?? "").trim();
  } catch {
    return ""; // célula mesclada sem valor
  }
}

function dateValue(sheet: Sheet, row: number, col: number | null): Date | null {
  if (col == null) return null;
  const value = sheet.getRow(row).getCell(col).value;
  return value instanceof Date ? value : null;
}

const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);
/** "VILA VELHA" / "vila velha" → "Vila Velha" */
function cityName(raw: string): string | null {
  const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const name = words.map((w, i) => (i > 0 && LOWER_WORDS.has(w) ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
  return name.slice(0, 80);
}

const REF_YEAR = new Date().getFullYear();

type Report = {
  tabs: { tab: string; rows: number; invalidPhones: number }[];
  unknownChoices: Map<string, number>;
};

function readWorkbook(workbook: ExcelJS.Workbook, report: Report): SourceRecord[] {
  const records: SourceRecord[] = [];

  workbook.eachSheet((sheet) => {
    const tabKey = normalizeKey(sheet.name);
    const isForm = sheet.name === FORM_TAB;
    const teamKey = TEAM_TABS[tabKey];
    if (!isForm && !teamKey) return;

    const header = readHeader(sheet);
    if (!header) return;
    const { cols } = header;

    const nameCol = findCol(cols, (h) => h.startsWith("nome"));
    const phoneCol = findCol(cols, (h) => h.startsWith("telefone"));
    const availCol = findCol(cols, (h) => h.startsWith("disponibilidade") && !h.includes("domingo"));
    const sundayCol = findCol(cols, (h) => h.startsWith("disponibilidade") && h.includes("domingo"));
    const choicesCol = findCol(cols, (h) => h.startsWith("escolha de departamentos"));
    const termCol = findCol(cols, (h) => h.startsWith("voce assinou o termo"));
    const backgroundCol = findCol(cols, (h) => h.startsWith("antecedentes criminais"));
    const birthCol = findCol(cols, (h) => h.startsWith("data de nascimento"));
    const maritalCol = findCol(cols, (h) => h.startsWith("estado civil"));
    const cityCol = findCol(cols, (h) => h === "cidade" || h.startsWith("cidade "));
    const baptizedCol = findCol(cols, (h) => h.startsWith("batizado"));
    const convertedCol = findCol(cols, (h) => h.includes("anos de conversao"));

    let rows = 0;
    let invalidPhones = 0;
    for (let r = header.row + 1; r <= sheet.rowCount; r++) {
      const name = text(sheet, r, nameCol);
      if (!name) continue;
      rows += 1;
      const rawPhone = text(sheet, r, phoneCol);
      const phone = normalizePhone(rawPhone);
      if (rawPhone && !phone) invalidPhones += 1;

      const departments: SourceRecord["departments"] = [];
      if (teamKey) departments.push({ key: teamKey, status: "ACTIVE" });
      if (choicesCol) {
        const { known, unknown } = splitDepartmentChoices(text(sheet, r, choicesCol));
        for (const d of known) departments.push({ key: d.key, status: "INTERESTED" });
        for (const u of unknown) report.unknownChoices.set(u, (report.unknownChoices.get(u) ?? 0) + 1);
      }

      records.push({
        tab: isForm ? FORM_TAB : sheet.name,
        name,
        phone,
        availability: parseAvailability(text(sheet, r, availCol)),
        sundayShift: parseSundayShift(text(sheet, r, sundayCol)),
        termSigned: termCol ? parseYesNo(text(sheet, r, termCol)) : null,
        backgroundCheckAnswer: backgroundCol ? text(sheet, r, backgroundCol) || null : null,
        preferName: isForm,
        departments,
        details: {
          birth: birthFromDate(dateValue(sheet, r, birthCol)),
          maritalStatus: parseMaritalStatus(text(sheet, r, maritalCol)),
          city: cityCol ? cityName(text(sheet, r, cityCol)) : null,
          baptized: baptizedCol ? parseYesNo(text(sheet, r, baptizedCol)) : null,
          convertedYear: convertedCol ? convertedYearFrom(text(sheet, r, convertedCol), REF_YEAR) : null,
        },
      });
    }
    report.tabs.push({ tab: sheet.name, rows, invalidPhones });
  });

  return records;
}

type DetailColumns = {
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  maritalStatus: VolunteerDetails["maritalStatus"];
  city: string | null;
  baptized: boolean | null;
  convertedYear: number | null;
};

/** Só o que está em branco no cadastro (não desfaz o que alguém arrumou no painel). */
function blankDetails(existing: DetailColumns | null, d: VolunteerDetails): Partial<DetailColumns> {
  const out: Partial<DetailColumns> = {};
  if (d.birth) {
    if (existing?.birthDay == null) {
      out.birthDay = d.birth.day;
      out.birthMonth = d.birth.month;
      out.birthYear = d.birth.year;
    } else if (
      existing.birthYear == null &&
      d.birth.year &&
      existing.birthDay === d.birth.day &&
      existing.birthMonth === d.birth.month
    ) {
      out.birthYear = d.birth.year;
    }
  }
  if (d.maritalStatus && existing?.maritalStatus == null) out.maritalStatus = d.maritalStatus;
  if (d.city && existing?.city == null) out.city = d.city;
  if (d.baptized != null && existing?.baptized == null) out.baptized = d.baptized;
  if (d.convertedYear && existing?.convertedYear == null) out.convertedYear = d.convertedYear;
  return out;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const report: Report = { tabs: [], unknownChoices: new Map() };
  const records = readWorkbook(workbook, report);
  const people = mergeRecords(records);

  // ---- Relatório (só números) ----
  console.log(`\nPlanilha: ${file}`);
  console.log("Linhas lidas por aba:");
  for (const t of report.tabs) {
    console.log(`  ${t.tab.padEnd(18)} ${String(t.rows).padStart(4)} pessoas${t.invalidPhones ? `  (${t.invalidPhones} telefone(s) inválido(s))` : ""}`);
  }
  const withPhone = people.filter((p) => p.phone).length;
  console.log(`\nPessoas depois de juntar repetidas: ${people.length} (${records.length} linhas no total)`);
  console.log(`  com telefone: ${withPhone} · sem telefone: ${people.length - withPhone}`);
  const perCount = new Map<number, number>();
  for (const p of people) perCount.set(p.departments.size, (perCount.get(p.departments.size) ?? 0) + 1);
  console.log(
    "  em quantos departamentos:",
    [...perCount.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}: ${c}`).join(" · ")
  );
  console.log("\nPor departamento (na equipe · marcou na inscrição):");
  for (const d of DEPARTMENTS) {
    let active = 0;
    let interested = 0;
    for (const p of people) {
      const s = p.departments.get(d.key);
      if (s === "ACTIVE") active += 1;
      else if (s === "INTERESTED") interested += 1;
    }
    console.log(`  ${d.name.padEnd(18)} ${String(active).padStart(4)} · ${interested}`);
  }
  const byName = new Map<string, number>();
  for (const p of people) byName.set(normalizeKey(p.name), (byName.get(normalizeKey(p.name)) ?? 0) + 1);
  const sameName = [...byName.values()].filter((n) => n > 1).length;
  console.log(`\nMesmo nome com telefones diferentes (revisar no painel): ${sameName}`);
  const count = (test: (d: VolunteerDetails) => boolean) => people.filter((p) => test(p.details)).length;
  console.log(
    `\nMais detalhes: aniversário ${count((d) => !!d.birth)} (com ano ${count((d) => !!d.birth?.year)}) · ` +
      `estado civil ${count((d) => !!d.maritalStatus)} · cidade ${count((d) => !!d.city)} · ` +
      `batismo ${count((d) => d.baptized != null)} · conversão ${count((d) => !!d.convertedYear)}`
  );
  if (report.unknownChoices.size > 0) {
    console.log("\nOpções do formulário que não viraram departamento:");
    for (const [label, n] of report.unknownChoices) console.log(`  ${label} (${n})`);
  }

  if (!apply) {
    console.log("\nNada foi gravado. Rode com --apply pra importar.");
    return;
  }

  // ---- Gravar ----
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const actor = await prisma.staffMember.findFirst({
    where: { roles: { some: { role: "ADMIN" } } },
    orderBy: { createdAt: "asc" },
  });
  if (!actor) throw new Error("Nenhum admin cadastrado pra assinar a importação na Auditoria.");

  if (detailsOnly) {
    let filled = 0;
    let notFound = 0;
    for (const p of people) {
      const existing = p.phone
        ? await prisma.volunteer.findUnique({ where: { phone: p.phone } })
        : await prisma.volunteer.findFirst({ where: { phone: null, name: p.name } });
      if (!existing) {
        notFound += 1;
        continue;
      }
      const data = blankDetails(existing, p.details);
      if (Object.keys(data).length === 0) continue;
      await prisma.volunteer.update({ where: { id: existing.id }, data });
      filled += 1;
    }
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "VOLUNTEER",
        entityId: `import-detalhes-${new Date().toISOString().slice(0, 10)}`,
        entityLabel: "Importação dos detalhes da planilha de voluntariado",
        changes: { pessoasCompletadas: filled, naoEncontradas: notFound },
        actorId: actor.id,
        actorClerkId: actor.clerkUserId,
        actorName: actor.name,
        userAgent: "prisma/import-volunteers.ts --details",
      },
    });
    console.log(`\nGravado: detalhes completados em ${filled} pessoas (${notFound} da planilha não estão no cadastro).`);
    return;
  }

  // Departamentos: casa com ministério que já existe, senão cria escondido do site.
  const ministries = await prisma.ministry.findMany();
  const lastOrder = Math.max(0, ...ministries.map((m) => m.sortOrder));
  const ministryIdByKey = new Map<string, string>();
  let createdMinistries = 0;
  let createdFunctions = 0;
  for (const [index, d] of DEPARTMENTS.entries()) {
    let ministry = ministries.find((m) => d.matches.includes(normalizeKey(m.name)));
    if (ministry) {
      if (!ministry.hasRoster) {
        ministry = await prisma.ministry.update({ where: { id: ministry.id }, data: { hasRoster: true } });
      }
    } else {
      let slug = slugify(d.name) || d.key;
      let n = 1;
      while (await prisma.ministry.findUnique({ where: { slug } })) slug = `${slugify(d.name)}-${++n}`;
      ministry = await prisma.ministry.create({
        data: { name: d.name, slug, showOnSite: false, hasRoster: true, sortOrder: lastOrder + 1 + index },
      });
      createdMinistries += 1;
    }
    ministryIdByKey.set(d.key, ministry.id);
    for (const [order, fname] of d.functions.entries()) {
      const exists = await prisma.ministryFunction.findUnique({
        where: { ministryId_name: { ministryId: ministry.id, name: fname } },
      });
      if (!exists) {
        await prisma.ministryFunction.create({ data: { ministryId: ministry.id, name: fname, sortOrder: order } });
        createdFunctions += 1;
      }
    }
  }

  let created = 0;
  let updated = 0;
  let memberships = 0;
  for (const p of people) {
    const existing = p.phone
      ? await prisma.volunteer.findUnique({ where: { phone: p.phone } })
      : await prisma.volunteer.findFirst({ where: { phone: null, name: p.name } });

    let volunteerId: string;
    if (existing) {
      // Só completa o que está vazio: não desfaz o que alguém já arrumou no painel.
      await prisma.volunteer.update({
        where: { id: existing.id },
        data: {
          availability: existing.availability ?? p.availability,
          sundayShift: existing.sundayShift ?? p.sundayShift,
          termSigned: existing.termSigned ?? p.termSigned,
          ...(p.backgroundCheckAnswer ? { backgroundCheckAnswer: p.backgroundCheckAnswer } : {}),
          ...blankDetails(existing, p.details),
        },
      });
      volunteerId = existing.id;
      updated += 1;
    } else {
      const row = await prisma.volunteer.create({
        data: {
          name: p.name,
          phone: p.phone,
          availability: p.availability,
          sundayShift: p.sundayShift,
          termSigned: p.termSigned,
          backgroundCheckAnswer: p.backgroundCheckAnswer,
          ...blankDetails(null, p.details),
          source: SOURCE,
        },
      });
      volunteerId = row.id;
      created += 1;
    }

    for (const [key, status] of p.departments) {
      const ministryId = ministryIdByKey.get(key);
      if (!ministryId) continue;
      const current = await prisma.volunteerMembership.findUnique({
        where: { volunteerId_ministryId: { volunteerId, ministryId } },
      });
      if (!current) {
        await prisma.volunteerMembership.create({ data: { volunteerId, ministryId, status } });
        memberships += 1;
      } else if (current.status === "INTERESTED" && status === ("ACTIVE" satisfies MembershipStatus)) {
        await prisma.volunteerMembership.update({ where: { id: current.id }, data: { status } });
      }
    }
  }

  // Um registro só na Auditoria, com números (sem nomes nem telefones).
  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entityType: "VOLUNTEER",
      entityId: `import-${new Date().toISOString().slice(0, 10)}`,
      entityLabel: "Importação da planilha de voluntariado",
      changes: {
        pessoasNovas: created,
        pessoasAtualizadas: updated,
        participacoesNovas: memberships,
        departamentosCriados: createdMinistries,
        funcoesCriadas: createdFunctions,
      },
      actorId: actor.id,
      actorClerkId: actor.clerkUserId,
      actorName: actor.name,
      userAgent: "prisma/import-volunteers.ts",
    },
  });

  console.log(
    `\nGravado: ${created} pessoas novas, ${updated} atualizadas, ${memberships} participações em equipes, ` +
      `${createdMinistries} departamentos criados, ${createdFunctions} funções criadas.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

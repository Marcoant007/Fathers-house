/* eslint-disable */
// Dados FICTÍCIOS pra testar a prévia da escala. Rodar com --cleanup pra apagar.
// Não grava nada na Auditoria.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { buildSlots } from "./roster-period";
import { suggestRoster, type Answer } from "./roster-plan";

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const MONTH = "2099-01";
const NAMES = ["Teste Escala Ana", "Teste Escala Bruno", "Teste Escala Carla", "Teste Escala Davi", "Teste Escala Eva"];

async function cleanup() {
  const v = await prisma.volunteer.deleteMany({ where: { source: "teste", name: { startsWith: "Teste Escala" } } });
  const p = await prisma.rosterPeriod.deleteMany({ where: { month: MONTH } });
  console.log(`apagados: ${v.count} pessoas de teste, ${p.count} mês de teste`);
}

async function seed() {
  await cleanup();
  const kids = await prisma.ministry.findFirstOrThrow({
    where: { name: { contains: "Kids", mode: "insensitive" } },
    select: { id: true, functions: { select: { id: true, perService: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  const services = await prisma.service.findMany({ select: { id: true, name: true, weekday: true, startsAt: true } });
  const period = await prisma.rosterPeriod.create({
    data: { month: MONTH, closesAt: new Date("2098-12-26T02:59:59Z"), slots: { createMany: { data: buildSlots(MONTH, services) } } },
    select: { id: true, slots: { select: { id: true, startsAt: true, createdAt: true }, orderBy: { startsAt: "asc" } } },
  });

  const fns = kids.functions.slice(0, 2);
  const people = [];
  for (const [i, name] of NAMES.entries()) {
    const v = await prisma.volunteer.create({
      data: {
        name,
        phone: `552790000001${i}`,
        source: "teste",
        memberships: {
          create: {
            ministryId: kids.id,
            status: "ACTIVE",
            functions: fns.length ? { create: [{ functionId: fns[i % fns.length].id }] } : undefined,
          },
        },
      },
      select: { id: true },
    });
    // Ana, Bruno, Carla respondem (cada um marca uns cultos); Davi e Eva não respondem.
    const answers = new Map<string, Answer>();
    if (i < 3) {
      const marked = period.slots.filter((_, j) => (j + i) % 2 === 0).map((s) => s.id);
      await prisma.availabilityResponse.create({
        data: {
          periodId: period.id,
          volunteerId: v.id,
          note: i === 0 ? "Recado de teste" : null,
          slots: { create: marked.map((slotId) => ({ slotId })) },
        },
      });
      for (const s of period.slots) answers.set(s.id, marked.includes(s.id) ? "yes" : "no");
    }
    people.push({ volunteerId: v.id, functionIds: fns.length ? [fns[i % fns.length].id] : [], answers });
  }

  const plan = suggestRoster({
    slots: period.slots,
    people,
    needs: fns.length ? fns.map((f) => ({ functionId: f.id, count: 1 })) : [{ functionId: null, count: 2 }],
    existing: [],
    elsewhere: [],
    maxPerWeekday: 2,
  });
  await prisma.rosterAssignment.createMany({ data: plan.add.map((a) => ({ ...a, ministryId: kids.id })) });
  console.log(
    `ok: ${period.slots.length} cultos, ${people.length} pessoas, ${plan.add.length} escalações, faltou em ${new Set(plan.missing.map((m) => m.slotId)).size} cultos, funções usadas ${fns.length}`
  );
  console.log(`url: /backstage/escala?mes=${MONTH}&m=${kids.id}&v=montar`);
}

(process.argv.includes("--cleanup") ? cleanup() : seed()).finally(() => prisma.$disconnect());

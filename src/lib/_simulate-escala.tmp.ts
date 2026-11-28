/* eslint-disable */
// Simula que TODO MUNDO das equipes respondeu o mês de teste (2099-01), pra
// testar a montagem da escala. Só mexe no mês 2099-01: apagar o mês (seed
// --cleanup) apaga essas respostas junto. Não grava nada na Auditoria.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { describeSlot } from "./roster-period";

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const MONTH = "2099-01";

// Número "aleatório" fixo por pessoa+culto (rodar de novo dá o mesmo resultado).
function chance(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

(async () => {
  const period = await prisma.rosterPeriod.findUnique({
    where: { month: MONTH },
    select: { id: true, slots: { select: { id: true, startsAt: true } } },
  });
  if (!period) throw new Error("Mês 2099-01 não existe. Rode o _seed-escala.tmp.ts antes.");

  const cleared = await prisma.rosterAssignment.deleteMany({ where: { slot: { periodId: period.id } } });
  await prisma.availabilityResponse.deleteMany({ where: { periodId: period.id } });

  const people = await prisma.volunteer.findMany({
    where: { active: true, memberships: { some: { status: "ACTIVE" } } },
    select: { id: true, availability: true },
  });

  let marks = 0;
  for (const p of people) {
    const rate = 0.35 + chance(p.id) * 0.45; // cada pessoa pode entre 35% e 80% das datas
    const chosen = period.slots.filter((s) => {
      const sunday = describeSlot(s.startsAt).day.startsWith("Dom");
      if (p.availability === "WEEKEND_ONLY" && !sunday) return false;
      if (p.availability === "WEEKDAYS_ONLY" && sunday) return false;
      return chance(p.id + s.id) < rate;
    });
    if (chosen.length === 0 && period.slots.length > 0) chosen.push(period.slots[Math.floor(chance(p.id + "x") * period.slots.length)]);
    await prisma.availabilityResponse.create({
      data: { periodId: period.id, volunteerId: p.id, slots: { create: chosen.map((s) => ({ slotId: s.id })) } },
    });
    marks += chosen.length;
  }
  console.log(`ok: ${people.length} pessoas responderam, ${marks} marcações em ${period.slots.length} cultos; prévia limpa (${cleared.count} tiradas)`);
})().finally(() => prisma.$disconnect());

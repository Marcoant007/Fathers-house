import type { Service } from "@/generated/prisma/client";
import { WEEKDAY_FULL } from "@/lib/format";
import { groupServices } from "@/lib/service-groups";

export function ServiceStrip({ services }: { services: Service[] }) {
  // Mesmo culto no mesmo dia em dois horários vira um bloco só ("9h30 e 18h").
  const groups = groupServices(services);
  if (groups.length === 0) return null;
  return (
    <div className="mx-5 flex flex-col divide-y divide-ink-line rounded-[28px] bg-ink text-paper md:mx-20 md:flex-row md:divide-x md:divide-y-0">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-1 flex-col gap-1.5 px-10 py-9">
          <p className="text-xs font-extrabold tracking-[3px] text-accent uppercase">{WEEKDAY_FULL[group.weekday]}</p>
          <p className="text-2xl font-extrabold">{group.name}</p>
          <p className="text-base text-soft-dark">{group.timesLabel}</p>
        </div>
      ))}
    </div>
  );
}

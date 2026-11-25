import { Repeat } from "lucide-react";
import { WEEKDAY_FULL } from "@/lib/format";
import type { ServiceGroup } from "@/lib/service-groups";

/** Agenda: cultos fixos do menu Cultos, sem data — valem toda semana. */
export function WeeklyServices({ groups }: { groups: ServiceGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="container-site flex flex-col gap-5 pt-14" aria-labelledby="toda-semana">
      <div className="flex items-center gap-3">
        <Repeat size={22} strokeWidth={2} aria-hidden="true" />
        <h2 id="toda-semana" className="text-xl font-black tracking-tight uppercase">
          Toda semana
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <article key={group.key} className="flex flex-col gap-2.5 rounded-3xl border border-line bg-card p-7">
            <p className="label-caps text-soft">
              {WEEKDAY_FULL[group.weekday]} · {group.timesLabel}
            </p>
            <h3 className="text-[22px] font-extrabold">{group.name}</h3>
            {group.description ? (
              <p className="text-[15px] leading-[1.55] whitespace-pre-line text-soft">{group.description}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

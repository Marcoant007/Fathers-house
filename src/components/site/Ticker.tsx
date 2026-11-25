"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Megaphone, Pause, Play, Users, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import type { TickerItem, TickerKind } from "@/lib/ticker";

const ICONS: Record<TickerKind, { icon: LucideIcon; label: string }> = {
  culto: { icon: Users, label: "Culto" },
  evento: { icon: CalendarDays, label: "Evento" },
  aviso: { icon: Megaphone, label: "Aviso" },
};

/** Segundos por item na faixa — mais itens, faixa mais longa, mesma velocidade. */
const SECONDS_PER_ITEM = 6;
/** Com poucos itens a faixa fica vazia em tela larga: repete até ter pelo menos isso. */
const MIN_ITEMS = 10;

function Items({ items, copy }: { items: { item: TickerItem; repeat: boolean }[]; copy: boolean }) {
  return (
    <ul
      // A segunda cópia só existe pra emendar a animação: some pro leitor de tela e pro Tab.
      aria-hidden={copy || undefined}
      inert={copy || undefined}
      className={cn(
        "flex shrink-0 items-center gap-14 pr-14",
      )}
    >
      {items.map(({ item, repeat }, index) => {
        const { icon: Icon, label } = ICONS[item.kind];
        return (
          <li
            key={`${item.key}-${index}`}
            // Repetição só visual: o leitor de tela e o Tab passam por cada item uma vez.
            aria-hidden={repeat || undefined}
            inert={repeat || undefined}
            className="shrink-0"
          >
            <Link
              href={item.href}
              className="flex min-h-11 items-center gap-3 rounded-lg whitespace-nowrap hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" className="shrink-0 text-accent" />
              <span className="sr-only">{label}:</span>
              <span className="text-[15px] font-extrabold">{item.title}</span>
              <span className="text-sm text-soft-dark">{item.meta}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Ticker({ items, liveNow }: { items: TickerItem[]; liveNow: boolean }) {
  const [paused, setPaused] = useState(false);
  if (items.length === 0) return null;

  const rounds = Math.ceil(MIN_ITEMS / items.length);
  const filled = Array.from({ length: rounds }, (_, round) => items.map((item) => ({ item, repeat: round > 0 }))).flat();

  return (
    <section
      aria-label="Programação"
      className="group mx-5 flex items-center gap-4 overflow-hidden rounded-[28px] bg-ink py-3 pr-3 pl-5 text-paper md:mx-20 md:pl-7"
    >
      {liveNow ? (
        <Link
          href="/#ao-vivo"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-danger px-4 text-xs font-extrabold tracking-[2px] text-paper uppercase"
        >
          <span className="size-2 animate-pulse rounded-full bg-paper" aria-hidden="true" />
          Ao vivo
        </Link>
      ) : (
        <p className="shrink-0 text-xs font-extrabold tracking-[3px] text-accent uppercase">Programação</p>
      )}

      <div
        className={cn(
          "relative min-w-0 flex-1 overflow-hidden",
          // esmaece as pontas
          "[mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]"
        )}
      >
        <div
          className={cn(
            "flex w-max animate-ticker",
            "group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]",
            paused && "[animation-play-state:paused]"
          )}
          style={{ "--ticker-duration": `${filled.length * SECONDS_PER_ITEM}s` } as React.CSSProperties}
        >
          <Items items={filled} copy={false} />
          <Items items={filled} copy />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPaused(!paused)}
        aria-pressed={paused}
        aria-label={paused ? "Continuar a faixa" : "Pausar a faixa"}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-soft-dark hover:bg-ink-2 hover:text-paper"
      >
        {paused ? <Play size={18} strokeWidth={2} aria-hidden="true" /> : <Pause size={18} strokeWidth={2} aria-hidden="true" />}
      </button>
    </section>
  );
}

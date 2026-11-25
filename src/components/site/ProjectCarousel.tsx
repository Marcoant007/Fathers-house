"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

export type CarouselProject = { id: string; title: string; description: string | null; imagePath: string };

/**
 * Carrossel dos projetos da igreja (seção Contribua). Um projeto por vez:
 * no celular arrasta pro lado (scroll-snap nativo), no computador usa as setas
 * ou os tracinhos. Não passa sozinho — a pessoa lê no ritmo dela.
 */
export function ProjectCarousel({ projects }: { projects: CarouselProject[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const total = projects.length;

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const next = (index + total) % total; // do último volta pro primeiro
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== current) setCurrent(Math.min(Math.max(index, 0), total - 1));
  }

  if (total === 0) return null;

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Projetos da igreja"
      className="flex flex-col overflow-hidden rounded-[28px] bg-ink text-paper"
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {projects.map((project, index) => (
          <div
            key={project.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} de ${total}: ${project.title}`}
            // Só o slide da vez é lido pelo leitor de tela (não há nada clicável dentro).
            aria-hidden={index !== current || undefined}
            className="flex w-full shrink-0 snap-start flex-col"
          >
            <div className="relative aspect-[16/10] w-full bg-ink-2">
              <Image
                src={project.imagePath}
                alt={project.title}
                fill
                sizes="(max-width: 768px) calc(100vw - 40px), 640px"
                quality={90}
                className="object-cover"
                priority={index === 0}
              />
            </div>
            <div className="flex flex-col gap-2 px-6 pt-6 md:px-8">
              <h3 className="text-xl font-black uppercase md:text-2xl">{project.title}</h3>
              {project.description ? (
                <p className="text-[15px] leading-[1.6] text-soft-dark md:text-base">{project.description}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {total > 1 ? (
        <div className="mt-auto flex items-center justify-between gap-4 px-4 pt-4 pb-4 md:px-6">
          <div className="flex flex-wrap items-center">
            {projects.map((project, index) => (
              <button
                key={project.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Ver projeto ${index + 1}: ${project.title}`}
                aria-current={index === current || undefined}
                className="group flex size-11 items-center justify-center md:w-8"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all",
                    index === current ? "w-6 bg-accent" : "w-3 bg-ink-line group-hover:bg-soft-dark"
                  )}
                />
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <p className="mr-1 text-sm font-bold text-soft-dark tabular-nums" aria-live="polite">
              {current + 1} / {total}
            </p>
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              aria-label="Projeto anterior"
              className="flex size-11 items-center justify-center rounded-full border-2 border-ink-line hover:border-paper"
            >
              <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              aria-label="Próximo projeto"
              className="flex size-11 items-center justify-center rounded-full bg-accent text-on-accent-icon hover:opacity-90"
            >
              <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="pb-6" />
      )}
    </section>
  );
}

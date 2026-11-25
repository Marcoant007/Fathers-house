"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { moveGivingProject } from "@/lib/actions/giving-projects";

const buttonClass =
  "flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line px-3 text-sm font-extrabold hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line";

/** Subir/Descer no carrossel. */
export function ProjectMoveButtons({
  id,
  title,
  isFirst,
  isLast,
}: {
  id: string;
  title: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveGivingProject(id, direction);
      startTransition(() => router.refresh());
    });
  }

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <button type="button" onClick={() => move("up")} disabled={isFirst || pending} className={buttonClass}>
        <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />
        Subir<span className="sr-only"> {title}</span>
      </button>
      <button type="button" onClick={() => move("down")} disabled={isLast || pending} className={buttonClass}>
        <ArrowDown size={16} strokeWidth={2} aria-hidden="true" />
        Descer<span className="sr-only"> {title}</span>
      </button>
    </div>
  );
}

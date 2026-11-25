"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";
import { setRegistrationCancelled, setRegistrationCheckIn } from "@/lib/actions/registrations";

/** Presença (check-in na porta) e cancelar/reativar, numa linha da lista de inscritos. */
export function RegistrationRowActions({
  id,
  present,
  cancelled,
}: {
  id: string;
  present: boolean;
  cancelled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<void>, fail: string) {
    startTransition(async () => {
      try {
        await task();
        router.refresh();
      } catch {
        toast.error(fail);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!cancelled ? (
        <button
          type="button"
          disabled={pending}
          aria-pressed={present}
          onClick={() => run(() => setRegistrationCheckIn(id, !present), "Não deu pra marcar a presença.")}
          className={cn(
            "min-h-11 rounded-full border-2 px-4 text-sm font-extrabold disabled:opacity-50",
            present ? "border-success bg-success text-paper" : "border-ink"
          )}
        >
          {present ? "✓ Presente" : "Marcar presença"}
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() => setRegistrationCancelled(id, !cancelled), "Não deu pra atualizar a inscrição.")
        }
        className={cn(
          "min-h-11 rounded-full px-3 text-sm font-extrabold disabled:opacity-50",
          cancelled ? "text-ink underline" : "text-danger"
        )}
      >
        {cancelled ? "Reativar" : "Cancelar"}
      </button>
    </div>
  );
}

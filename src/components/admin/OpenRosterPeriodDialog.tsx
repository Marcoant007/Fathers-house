"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, LoaderCircle } from "lucide-react";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createRosterPeriod, type RosterPeriodActionState } from "@/lib/actions/roster-periods";
import { monthLabel, suggestedDeadline } from "@/lib/roster-period";
import { useFormSubmit } from "@/lib/use-form-submit";

/** Admin abre a escala de um mês: gera os cultos do mês e o link público. */
export function OpenRosterPeriodDialog({ months, triggerClassName }: { months: string[]; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName} disabled={months.length === 0}>
        <CalendarPlus size={18} strokeWidth={2} aria-hidden="true" /> Abrir escala de um mês
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir escala do mês</DialogTitle>
        </DialogHeader>
        <OpenForm months={months} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function OpenForm({ months, onDone }: { months: string[]; onDone: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [month, setMonth] = useState(months[0] ?? "");
  const [deadline, setDeadline] = useState(months[0] ? suggestedDeadline(months[0]) : "");

  const action = async (prev: RosterPeriodActionState, formData: FormData) => {
    const result = await createRosterPeriod(prev, formData);
    if (result?.ok && result.month) {
      toast.success(`Escala de ${monthLabel(result.month)} aberta!`);
      onDone();
      router.push(`${pathname}?mes=${result.month}`);
    }
    return result;
  };
  const [state, formAction, pending] = useActionState<RosterPeriodActionState, FormData>(action, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  return (
    <form {...formProps} className="flex flex-col gap-5">
      <p className="text-[15px] text-soft">
        O painel monta a lista de cultos do mês a partir de <b className="text-ink">Cultos</b> e cria um link pra você
        mandar nos grupos. Cada voluntário digita o WhatsApp e marca quando pode servir.
      </p>
      {state?.error ? (
        <p role="alert" className="text-sm font-bold text-danger">
          {state.error}
        </p>
      ) : null}

      <FormField label="Mês" htmlFor="month" error={fieldErrors?.month}>
        <select
          id="month"
          name="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setDeadline(suggestedDeadline(e.target.value));
          }}
          className={fieldInputClass(!!fieldErrors?.month)}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m).replace(/^./, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Prazo pra responder" htmlFor="deadline" error={fieldErrors?.deadline}>
        <input
          id="deadline"
          name="deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className={fieldInputClass(!!fieldErrors?.deadline)}
          required
        />
        <p className="text-sm text-soft">Até as 23h59 desse dia. Depois dá pra mudar o prazo.</p>
      </FormField>

      <button
        type="submit"
        disabled={pending || !month}
        aria-busy={pending}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[15px] font-extrabold text-paper disabled:opacity-70"
      >
        {pending ? <LoaderCircle size={18} strokeWidth={2} aria-hidden="true" className="animate-spin" /> : null}
        Abrir escala
      </button>
    </form>
  );
}

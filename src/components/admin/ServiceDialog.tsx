"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Service } from "@/generated/prisma/client";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createService, updateService, type ServiceActionState } from "@/lib/actions/services";
import { useFormSubmit } from "@/lib/use-form-submit";

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function toHHMM(date: Date | undefined) {
  if (!date) return "18:00";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function ServiceDialog({
  service,
  trigger,
  triggerClassName,
}: {
  service?: Service;
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const serverAction = service ? updateService.bind(null, service.id) : createService;
  // Fecha e mostra o "salvo" direto no fim do envio (sem useEffect).
  const action = async (prev: ServiceActionState, formData: FormData) => {
    const result = await serverAction(prev, formData);
    if (result && !result.error) {
      setOpen(false);
      router.push(`${pathname}?saved=${service ? "update" : "create"}`);
    }
    return result;
  };
  const [state, formAction, pending] = useActionState<ServiceActionState, FormData>(action, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Editar culto" : "Novo culto"}</DialogTitle>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-4">
          {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}
          <FormField label="Nome" htmlFor="name" error={fieldErrors?.name}>
            <input
              id="name"
              name="name"
              placeholder="ex.: Culto da Família"
              defaultValue={service?.name}
              className={fieldInputClass(!!fieldErrors?.name)}
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Dia da semana" htmlFor="weekday">
              <select
                id="weekday"
                name="weekday"
                defaultValue={service?.weekday ?? 0}
                className={fieldInputClass()}
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Horário" htmlFor="time" error={fieldErrors?.time}>
              <input
                id="time"
                name="time"
                type="time"
                defaultValue={toHHMM(service?.startsAt)}
                className={fieldInputClass(!!fieldErrors?.time)}
                required
              />
            </FormField>
          </div>
          <FormField label="Descrição (opcional)" htmlFor="description" error={fieldErrors?.description}>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={500}
              placeholder="ex.: No meio da semana, uma pausa pra recarregar…"
              defaultValue={service?.description ?? ""}
              className={fieldInputClass(!!fieldErrors?.description) + " h-auto py-3"}
            />
            <p className="text-sm text-soft">
              Aparece na Agenda do site, em “Toda semana”. Culto com mais de um horário no mesmo dia (ex.: domingo
              9h30 e 18h)? Cadastre um por horário com o mesmo nome: o site junta os dois.
            </p>
          </FormField>
          <FormField label="Ordem" htmlFor="sortOrder">
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={service?.sortOrder ?? 0}
              className={fieldInputClass()}
            />
          </FormField>
          <DialogFooter>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper disabled:opacity-50"
            >
              Salvar
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

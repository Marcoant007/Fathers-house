"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Ministry } from "@/generated/prisma/client";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inviteMember, type StaffActionState } from "@/lib/actions/staff";
import { useFormSubmit } from "@/lib/use-form-submit";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin", hint: "Tudo do painel. É o único que mexe em Equipe (convites e papéis)." },
  { value: "MIDIA", label: "Mídia (cuida do site)", hint: "Quase tudo do Admin: o site (conteúdo, imagens, aparência), aprovações, escala e voluntários de todos os ministérios e Auditoria. Só não mexe em Equipe." },
] as const;

export function InviteMemberDialog({
  ministries,
  trigger,
  triggerClassName,
}: {
  ministries: Ministry[];
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [leaderOf, setLeaderOf] = useState<string[]>([]);
  // Fecha e mostra o "enviado" direto no fim do envio (sem useEffect).
  const action = async (prev: StaffActionState, formData: FormData) => {
    const result = await inviteMember(prev, formData);
    if (result && !result.error) {
      setOpen(false);
      setRoles([]);
      setLeaderOf([]);
      router.push(`${pathname}?saved=invite`);
    }
    return result;
  };
  const [state, formAction, pending] = useActionState<StaffActionState, FormData>(action, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((r) => r !== value) : [...list, value];
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar para a equipe</DialogTitle>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-4">
          {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}
          <FormField label="E-mail" htmlFor="email" error={fieldErrors?.email}>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="pessoa@exemplo.com"
              className={fieldInputClass(!!fieldErrors?.email)}
              required
            />
          </FormField>

          <FormField label="Papéis" error={fieldErrors?.roles}>
            <div className="flex flex-col gap-2">
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-line px-4 py-3 has-[:checked]:border-ink"
                >
                  <input
                    type="checkbox"
                    name="roles"
                    value={option.value}
                    checked={roles.includes(option.value)}
                    onChange={() => setRoles((prev) => toggle(prev, option.value))}
                    className="mt-1 size-4 accent-ink"
                  />
                  <span className="flex flex-col">
                    <span className="text-[15px] font-extrabold">{option.label}</span>
                    <span className="text-sm text-soft">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </FormField>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-extrabold">Líder de ministério</legend>
            <p className="text-sm text-soft">
              Marque os ministérios que a pessoa lidera. Ela cuida de tudo deles (voluntários, antecedentes, escala,
              inscrições) e envia eventos e avisos para a Mídia aprovar. Não mexe na cara do site.
            </p>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {ministries.map((ministry) => (
                <label
                  key={ministry.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-line px-4 py-2 text-[15px] font-bold has-[:checked]:border-ink"
                >
                  <input
                    type="checkbox"
                    name="leaderOf"
                    value={ministry.id}
                    checked={leaderOf.includes(ministry.id)}
                    onChange={() => setLeaderOf((prev) => toggle(prev, ministry.id))}
                    className="size-4 accent-ink"
                  />
                  Líder · {ministry.name}
                </label>
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <button
              type="submit"
              disabled={pending || roles.length + leaderOf.length === 0}
              className="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper disabled:opacity-50"
            >
              Enviar convite
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

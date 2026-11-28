"use client";

import { useActionState, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { Ministry, StaffRole } from "@/generated/prisma/client";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { grantRole, revokeRole, type StaffActionState } from "@/lib/actions/staff";
import { useFormSubmit } from "@/lib/use-form-submit";

const ROLE_LABELS = { ADMIN: "Admin", MIDIA: "Mídia", LIDER: "Líder" } as const;

const GLOBAL_ROLES = [
  { value: "ADMIN", label: "Admin", hint: "Tudo do painel. É o único que mexe em Equipe (convites e papéis)." },
  { value: "MIDIA", label: "Mídia (cuida do site)", hint: "Quase tudo do Admin: o site (conteúdo, imagens, aparência), aprovações, escala e voluntários de todos os ministérios e Auditoria. Só não mexe em Equipe." },
] as const;

/** "ADMIN" | "MIDIA" | "LIDER:<id do ministério>" → campos que a action espera. */
function parseChoice(choice: string) {
  if (choice.startsWith("LIDER:")) return { role: "LIDER", ministryId: choice.slice("LIDER:".length) };
  return { role: choice, ministryId: "" };
}

type StaffMemberRole = StaffRole & { ministry: Ministry | null };

export function StaffRolesDialog({
  staffMemberId,
  staffName,
  roles,
  ministries,
  trigger,
  triggerClassName,
}: {
  staffMemberId: string;
  staffName: string;
  roles: StaffMemberRole[];
  ministries: Ministry[];
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string>("");
  const { role, ministryId } = parseChoice(choice);
  const held = new Set(roles.map((r) => (r.role === "LIDER" ? `LIDER:${r.ministryId}` : r.role)));
  const hint =
    role === "LIDER"
      ? "Tudo desse ministério: voluntários (inclusive antecedentes), escala e inscrições. Envia eventos e avisos para a Mídia aprovar. Não mexe na cara do site."
      : GLOBAL_ROLES.find((g) => g.value === role)?.hint;
  const [pendingRevoke, startRevoke] = useTransition();
  // Concedeu: limpa a escolha e mostra o "salvo" direto no fim do envio (sem useEffect).
  const action = async (prev: StaffActionState, formData: FormData) => {
    const result = await grantRole(staffMemberId, prev, formData);
    if (result && !result.error) {
      setChoice("");
      router.push(`${pathname}?saved=role`);
    }
    return result;
  };
  const [state, formAction, pending] = useActionState<StaffActionState, FormData>(action, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Papéis de {staffName}</DialogTitle>
        </DialogHeader>

        {roles.length === 0 ? (
          <p className="text-[15px] text-soft">Nenhum papel atribuído ainda.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-sm font-extrabold text-ink"
              >
                {ROLE_LABELS[r.role]}
                {r.ministry ? <span className="font-bold text-soft"> · {r.ministry.name}</span> : null}
                <button
                  type="button"
                  aria-label={`Remover papel ${ROLE_LABELS[r.role]}`}
                  disabled={pendingRevoke}
                  onClick={() =>
                    startRevoke(async () => {
                      try {
                        await revokeRole(r.id);
                        toast.success("Papel removido");
                        router.refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Não deu pra remover o papel.");
                      }
                    })
                  }
                  className="text-soft hover:text-danger disabled:opacity-50"
                >
                  <X size={14} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form {...formProps} className="flex flex-col gap-4 border-t border-line pt-4">
          {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}
          <FormField label="Novo papel" htmlFor="role-choice" error={fieldErrors?.role ?? fieldErrors?.ministryId}>
            <select
              id="role-choice"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className={fieldInputClass(!!(fieldErrors?.role ?? fieldErrors?.ministryId))}
            >
              <option value="">Escolha o papel</option>
              {GLOBAL_ROLES.filter((g) => !held.has(g.value)).map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
              <optgroup label="Líder de ministério">
                {ministries
                  .filter((m) => !held.has(`LIDER:${m.id}`))
                  .map((m) => (
                    <option key={m.id} value={`LIDER:${m.id}`}>
                      Líder · {m.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </FormField>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="ministryId" value={ministryId} />
          {hint ? <p className="text-sm text-soft">{hint}</p> : null}
          <DialogFooter>
            <button
              type="submit"
              disabled={pending || !choice}
              className="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper disabled:opacity-50"
            >
              Conceder papel
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

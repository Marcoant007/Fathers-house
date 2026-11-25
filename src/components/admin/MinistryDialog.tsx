"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Ministry } from "@/generated/prisma/client";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import { ImageDrop } from "@/components/admin/ImageDrop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createMinistry, updateMinistry, type MinistryActionState } from "@/lib/actions/ministries";
import { useFormSubmit } from "@/lib/use-form-submit";
import { MINISTRY_ICONS, iconFromName } from "@/lib/ministry-icons";
import { MinistryIcon } from "@/components/site/MinistryIcon";
import { cn } from "cn";

const OPTION_CLASS =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-line bg-card px-3 py-2 text-sm font-bold hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2";

export function MinistryDialog({
  ministry,
  trigger,
  triggerClassName,
}: {
  ministry?: Ministry;
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [coverPath, setCoverPath] = useState<string | null>(ministry?.coverPath ?? null);
  // Só pra mostrar qual ícone o "Automático" vai usar enquanto a pessoa digita o nome.
  const [nameDraft, setNameDraft] = useState(ministry?.name ?? "");
  const autoIcon = MINISTRY_ICONS.find((i) => i.key === iconFromName(nameDraft))!;
  const action = ministry ? updateMinistry.bind(null, ministry.id) : createMinistry;
  const [state, formAction, pending] = useActionState<MinistryActionState, FormData>(action, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  useEffect(() => {
    if (open && state && !state.error) {
      setOpen(false);
      router.push(`${pathname}?saved=${ministry ? "update" : "create"}`);
    }
  }, [state, open, router, pathname, ministry]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && !ministry) {
      // limpa depois da animação de fechar, pra não trocar o conteúdo à vista
      setTimeout(() => {
        setCoverPath(null);
        setNameDraft("");
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{ministry ? "Editar ministério" : "Novo ministério"}</DialogTitle>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-4">
          {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}
          <FormField label="Nome" htmlFor="name" error={fieldErrors?.name}>
            <input
              id="name"
              name="name"
              defaultValue={ministry?.name}
              onInput={(e) => setNameDraft(e.currentTarget.value)}
              className={fieldInputClass(!!fieldErrors?.name)}
              required
            />
          </FormField>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-extrabold">Ícone</legend>
            <p className="-mt-1 text-sm text-soft">
              Aparece junto do nome no site. Deixe em “Automático” pra escolher pelo nome, ou clique em outro.
            </p>
            {fieldErrors?.icon ? <p className="text-sm font-bold text-danger">{fieldErrors.icon}</p> : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className={cn(OPTION_CLASS, "col-span-2 sm:col-span-3")}>
                <input type="radio" name="icon" value="" defaultChecked={!ministry?.icon} className="sr-only" />
                <MinistryIcon iconKey={autoIcon.key} size={18} className="shrink-0" />
                <span>
                  Automático <span className="font-normal opacity-75">(agora: {autoIcon.label})</span>
                </span>
              </label>
              {MINISTRY_ICONS.map((icon) => (
                <label key={icon.key} className={OPTION_CLASS}>
                  <input
                    type="radio"
                    name="icon"
                    value={icon.key}
                    defaultChecked={ministry?.icon === icon.key}
                    className="sr-only"
                  />
                  <MinistryIcon iconKey={icon.key} size={18} className="shrink-0" />
                  <span className="leading-tight">{icon.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <FormField label="Horário" htmlFor="schedule">
            <input
              id="schedule"
              name="schedule"
              placeholder="ex.: Sábados, 19h"
              defaultValue={ministry?.schedule ?? ""}
              className={fieldInputClass()}
            />
          </FormField>
          <FormField label="Foto (opcional)">
            <ImageDrop value={coverPath} name="coverPath" pathPrefix="ministerios" onChange={setCoverPath} />
          </FormField>
          <FormField label="WhatsApp do líder (opcional)" htmlFor="whatsapp" error={fieldErrors?.whatsapp}>
            <input
              id="whatsapp"
              name="whatsapp"
              placeholder="5527999999999"
              defaultValue={ministry?.whatsapp ?? ""}
              className={fieldInputClass(!!fieldErrors?.whatsapp)}
            />
          </FormField>
          <FormField label="Descrição" htmlFor="description">
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={ministry?.description ?? ""}
              className={fieldInputClass() + " h-auto py-3"}
            />
          </FormField>
          <FormField label="Ordem" htmlFor="sortOrder">
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={ministry?.sortOrder ?? 0}
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

"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { GivingProject } from "@/generated/prisma/client";
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
import {
  createGivingProject,
  updateGivingProject,
  type GivingProjectActionState,
} from "@/lib/actions/giving-projects";
import { useFormSubmit } from "@/lib/use-form-submit";

export function ProjectDialog({
  project,
  trigger,
  triggerClassName,
}: {
  project?: GivingProject;
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(project?.imagePath ?? null);

  const serverAction = project ? updateGivingProject.bind(null, project.id) : createGivingProject;
  // Fecha e mostra o "salvo" direto no fim do envio (sem useEffect).
  const action = async (prev: GivingProjectActionState, formData: FormData) => {
    const result = await serverAction(prev, formData);
    if (result?.ok) {
      setOpen(false);
      router.push(`${pathname}?saved=${project ? "update" : "create"}`);
    }
    return result;
  };
  const [state, formAction, pending] = useActionState<GivingProjectActionState, FormData>(action, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  function onOpenChange(next: boolean) {
    // Reabriu: começa da foto salva (descarta troca de foto que foi cancelada).
    if (next) setImage(project?.imagePath ?? null);
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-4">
          {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}

          <FormField label="Foto do projeto" error={fieldErrors?.imagePath}>
            <ImageDrop value={image} name="imagePath" pathPrefix="projetos" onChange={setImage} />
            <p className="text-sm text-soft">
              Foto deitada (horizontal) fica melhor: no site ela aparece larga, com o nome embaixo.
            </p>
          </FormField>

          <FormField label="Nome do projeto" htmlFor="title" error={fieldErrors?.title}>
            <input
              id="title"
              name="title"
              placeholder="ex.: Espaço Gerações"
              defaultValue={project?.title}
              maxLength={80}
              className={fieldInputClass(!!fieldErrors?.title)}
              required
            />
          </FormField>

          <FormField label="Sobre o projeto (opcional)" htmlFor="description" error={fieldErrors?.description}>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={400}
              placeholder="ex.: Um prédio só para as próximas gerações: Kids, Pré-teens e Jovens."
              defaultValue={project?.description ?? ""}
              className={fieldInputClass(!!fieldErrors?.description) + " h-auto py-3"}
            />
            <p className="text-sm text-soft">Uma ou duas frases. Aparece embaixo da foto.</p>
          </FormField>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
            <input
              type="checkbox"
              name="visible"
              defaultChecked={project?.visible ?? true}
              className="mt-1 size-5 shrink-0 accent-ink"
            />
            <span>
              <span className="font-extrabold">Mostrar no site</span>
              <span className="block text-sm text-soft">Desmarque pra tirar do carrossel sem apagar.</span>
            </span>
          </label>

          <DialogFooter>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar projeto"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

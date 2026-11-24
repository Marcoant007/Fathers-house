"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FaqEntry } from "@/generated/prisma/client";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createFaq, updateFaq, type FaqActionState } from "@/lib/actions/faq";

function Check({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-5 shrink-0 accent-ink" />
      <span>
        <span className="font-extrabold">{label}</span>
        {hint ? <span className="block text-sm text-soft">{hint}</span> : null}
      </span>
    </label>
  );
}

export function FaqDialog({
  faq,
  trigger,
  triggerClassName,
}: {
  faq?: FaqEntry;
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const action = faq ? updateFaq.bind(null, faq.id) : createFaq;
  const [state, formAction, pending] = useActionState<FaqActionState, FormData>(action, undefined);
  const err = state?.fieldErrors;

  useEffect(() => {
    if (open && state && !state.error) {
      setOpen(false);
      router.push(`${pathname}?saved=${faq ? "update" : "create"}`);
    }
  }, [state, open, router, pathname, faq]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{faq ? "Editar pergunta" : "Nova pergunta"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}

          <FormField label="Pergunta" htmlFor="question" error={err?.question}>
            <input
              id="question"
              name="question"
              placeholder="ex.: O que é o GFC?"
              defaultValue={faq?.question}
              className={fieldInputClass(!!err?.question)}
              required
            />
          </FormField>

          <FormField label="Resposta" htmlFor="answer" error={err?.answer}>
            <textarea
              id="answer"
              name="answer"
              rows={6}
              defaultValue={faq?.answer}
              className={fieldInputClass(!!err?.answer) + " h-auto py-3"}
              required
            />
            <p className="text-sm text-soft">
              Dá pra usar {"{cultos}"}, {"{endereco}"}, {"{whatsapp}"}, {"{pix}"} e {"{instagram}"} — o bot troca
              pelo que está cadastrado em Cultos e Aparência.
            </p>
          </FormField>

          <FormField label="Palavras-chave" htmlFor="keywords" error={err?.keywords}>
            <textarea
              id="keywords"
              name="keywords"
              rows={2}
              placeholder="gfc, grupo familiar, célula, pequeno grupo"
              defaultValue={faq?.keywords.join(", ")}
              className={fieldInputClass(!!err?.keywords) + " h-auto py-3"}
              required
            />
            <p className="text-sm text-soft">
              Separe por vírgula. Pense em como as pessoas perguntam. Acento e maiúscula não importam, e frases
              (“grupo familiar”) pesam mais que palavras soltas.
            </p>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Botão: texto (opcional)" htmlFor="linkLabel" error={err?.linkLabel}>
              <input
                id="linkLabel"
                name="linkLabel"
                placeholder="ex.: Ver agenda"
                defaultValue={faq?.linkLabel ?? ""}
                className={fieldInputClass(!!err?.linkLabel)}
              />
            </FormField>
            <FormField label="Botão: link (opcional)" htmlFor="linkUrl" error={err?.linkUrl}>
              <input
                id="linkUrl"
                name="linkUrl"
                placeholder="/agenda ou https://…"
                defaultValue={faq?.linkUrl ?? ""}
                className={fieldInputClass(!!err?.linkUrl)}
              />
            </FormField>
          </div>

          <div className="flex flex-col gap-1">
            <Check
              name="showWhatsapp"
              label="Mostrar botão do WhatsApp da igreja"
              defaultChecked={faq?.showWhatsapp ?? false}
            />
            <Check
              name="isFeatured"
              label="Destacar em “Perguntas frequentes”"
              hint="Aparece como botão quando a pessoa abre o tira-dúvidas."
              defaultChecked={faq?.isFeatured ?? false}
            />
            <Check
              name="active"
              label="Ativa"
              hint="Desmarque pra tirar do bot sem apagar."
              defaultChecked={faq?.active ?? true}
            />
          </div>

          <FormField label="Ordem" htmlFor="sortOrder">
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={faq?.sortOrder ?? 0}
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

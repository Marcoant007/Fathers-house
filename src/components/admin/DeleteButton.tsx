"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { cn } from "cn";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteButton({
  itemId,
  itemTitle,
  itemLabel,
  listHref,
  deleteAction,
  variant = "full",
  description,
}: {
  itemId: string;
  itemTitle: string;
  /** ex.: "evento", "aviso" — usado nas frases do modal */
  itemLabel: string;
  listHref: string;
  deleteAction: (id: string) => Promise<void>;
  /** full = botão grande; compact = botão pequeno com texto (linhas de tabela); icon = só a lixeira */
  variant?: "full" | "compact" | "icon";
  /** Troca a frase padrão do modal ("Isso remove o {itemLabel}…"). */
  description?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Enquanto exclui, o modal fica aberto mostrando "Excluindo…" (não fecha no Esc nem clicando fora).
  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) setError(null);
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAction(itemId);
      } catch {
        setError(`Não deu pra excluir agora. Tente de novo em instantes.`);
        return;
      }
      // Fecha junto com a lista atualizada (mesma transição): o "Excluindo…" fica
      // até a linha sumir da tela.
      startTransition(() => {
        setOpen(false);
        if (pathname !== listHref) router.push(listHref);
        else router.refresh();
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        aria-label={variant === "icon" ? `Excluir ${itemTitle}` : undefined}
        title={variant === "icon" ? "Excluir" : undefined}
        className={cn(
          "font-extrabold text-danger",
          variant === "full" && "rounded-full border-2 border-danger px-6 py-4 text-[15px]",
          variant === "compact" &&
            "flex min-h-11 items-center gap-2 rounded-full px-3 text-sm hover:bg-danger/10",
          variant === "icon" && "flex size-9 items-center justify-center rounded-lg hover:bg-danger/10"
        )}
      >
        {variant === "full" ? (
          `Excluir ${itemLabel}`
        ) : variant === "compact" ? (
          <>
            <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
            Excluir
            <span className="sr-only"> {itemTitle}</span>
          </>
        ) : (
          <Trash2 size={18} strokeWidth={2} aria-hidden="true" />
        )}
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Excluir “{itemTitle}”?</DialogTitle>
        </DialogHeader>
        <p className="text-[15px] text-soft">
          {description ?? `Isso remove o ${itemLabel} e a imagem dele (se tiver uma) pra sempre. Não dá pra desfazer.`}
        </p>
        {error ? (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose
            disabled={pending}
            className="rounded-full px-6 py-3 text-[15px] font-extrabold text-soft disabled:opacity-50"
          >
            Cancelar
          </DialogClose>
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={confirmDelete}
            className="flex items-center justify-center gap-2 rounded-full bg-danger px-6 py-3 text-[15px] font-extrabold text-paper disabled:cursor-wait disabled:opacity-80"
          >
            {pending ? (
              <>
                <LoaderCircle size={18} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                Excluindo…
              </>
            ) : (
              "Excluir"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

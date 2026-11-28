"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { fieldInputClass } from "@/components/admin/FormField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createMinistryFunction, deleteMinistryFunction, renameMinistryFunction } from "@/lib/actions/volunteers";

type MinistryFunctionItem = { id: string; name: string; people: number };

/** Funções do ministério: as subcategorias (Kids → Professor(a), Auxiliar, Som…). */
export function MinistryFunctionsDialog({
  ministryId,
  ministryName,
  functions,
  trigger,
  triggerClassName,
}: {
  ministryId: string;
  ministryName: string;
  functions: MinistryFunctionItem[];
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Funções no {ministryName}</DialogTitle>
        </DialogHeader>
        <p className="text-[15px] text-soft">
          O que cada pessoa faz dentro do ministério (ex.: Professor(a), Auxiliar, Som). Depois é só marcar as funções
          de cada um em “Editar”.
        </p>

        {functions.length === 0 ? (
          <p className="rounded-xl bg-sand px-4 py-3 text-sm text-soft">Nenhuma função ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {functions.map((f) => (
              <FunctionRow key={`${f.id}:${f.name}`} item={f} />
            ))}
          </ul>
        )}

        <AddFunction ministryId={ministryId} />
      </DialogContent>
    </Dialog>
  );
}

function FunctionRow({ item }: { item: MinistryFunctionItem }) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== item.name;

  function run(task: () => Promise<{ error?: string }>, success: string) {
    startTransition(async () => {
      const result = await task();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      startTransition(() => router.refresh());
    });
  }

  if (confirming) {
    return (
      <li role="alert" className="flex flex-col gap-2 rounded-2xl bg-danger/10 p-3">
        <p className="text-sm font-bold text-danger">
          Apagar “{item.name}”?{" "}
          {item.people > 0
            ? `${item.people} pessoa(s) têm essa função: continuam na equipe, só sem ela.`
            : "Ninguém tem essa função ainda."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="min-h-11 rounded-full px-3 text-sm font-extrabold text-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteMinistryFunction(item.id), `Função “${item.name}” apagada.`)}
            className="flex min-h-11 items-center gap-2 rounded-full bg-danger px-4 text-sm font-extrabold text-paper disabled:opacity-80"
          >
            {pending ? <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" /> : null}
            Sim, apagar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`function-${item.id}`}>
        Nome da função
      </label>
      <input
        id={`function-${item.id}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        className={fieldInputClass()}
      />
      <span className="w-20 shrink-0 text-center text-xs font-bold text-soft">
        {item.people} {item.people === 1 ? "pessoa" : "pessoas"}
      </span>
      {dirty ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => renameMinistryFunction(item.id, name), "Nome da função salvo.")}
          className="min-h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-extrabold text-paper disabled:opacity-80"
        >
          Salvar
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold text-danger hover:bg-danger/10"
        >
          <Trash2 size={16} strokeWidth={2} aria-hidden="true" /> Apagar
          <span className="sr-only"> {item.name}</span>
        </button>
      )}
    </li>
  );
}

function AddFunction({ ministryId }: { ministryId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = name.trim();
        if (!value) return;
        startTransition(async () => {
          const result = await createMinistryFunction(ministryId, value);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(`Função “${value}” criada.`);
          startTransition(() => {
            setName("");
            router.refresh();
          });
        });
      }}
      className="flex items-end gap-2 border-t border-line pt-4"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="new-function" className="text-sm font-extrabold">
          Nova função
        </label>
        <input
          id="new-function"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex.: Auxiliar"
          maxLength={60}
          className={fieldInputClass()}
        />
      </div>
      <button
        type="submit"
        disabled={pending || name.trim().length < 2}
        className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-extrabold text-paper disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle size={18} strokeWidth={2} aria-hidden="true" className="animate-spin" />
        ) : (
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
        )}
        Adicionar
      </button>
    </form>
  );
}

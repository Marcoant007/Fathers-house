"use client";

import { useActionState, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { LiveStream } from "@/generated/prisma/client";
import { FormField, fieldInputClass } from "@/components/admin/FormField";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createLiveStream, updateLiveStream, type LiveActionState } from "@/lib/actions/live";
import { toSaoPauloInput } from "@/lib/datetime";
import type { ServiceSlot } from "@/lib/live-rules";
import { useFormSubmit } from "@/lib/use-form-submit";

export function LiveDialog({
  live,
  slots = [],
  trigger,
  triggerClassName,
}: {
  live?: LiveStream;
  /** Atalhos "preencher com um culto" (só no cadastro novo). */
  slots?: ServiceSlot[];
  trigger: React.ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const startsAtRef = useRef<HTMLInputElement>(null);

  const serverAction = live ? updateLiveStream.bind(null, live.id) : createLiveStream;
  // Fecha e mostra o "salvo" direto no fim do envio (sem useEffect).
  const action = async (prev: LiveActionState, formData: FormData) => {
    const result = await serverAction(prev, formData);
    if (result?.ok) {
      setOpen(false);
      router.push(`${pathname}?saved=${live ? "update" : "create"}`);
    }
    return result;
  };
  const [state, formAction, pending] = useActionState<LiveActionState, FormData>(action, undefined);
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  function fillFromSlot(slot: ServiceSlot) {
    if (titleRef.current) titleRef.current.value = slot.title;
    if (startsAtRef.current) startsAtRef.current.value = slot.startsAtInput;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{live ? "Editar transmissão" : "Nova transmissão"}</DialogTitle>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-4">
          {state?.error ? <p className="text-sm font-bold text-danger">{state.error}</p> : null}

          {!live && slots.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-sand p-4">
              <p className="text-sm font-extrabold">Atalho: é de um destes cultos?</p>
              <p className="text-sm text-soft">Clique pra preencher o nome e a data. Depois é só colar os links.</p>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startsAtInput + slot.title}
                    type="button"
                    onClick={() => fillFromSlot(slot)}
                    className="min-h-11 rounded-full border-2 border-line bg-card px-4 text-sm font-bold hover:border-ink"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <FormField label="Nome da transmissão" htmlFor="title" error={fieldErrors?.title}>
            <input
              ref={titleRef}
              id="title"
              name="title"
              placeholder="ex.: Culto da Família"
              defaultValue={live?.title}
              className={fieldInputClass(!!fieldErrors?.title)}
              required
            />
          </FormField>

          <FormField label="Data e hora (Brasília)" htmlFor="startsAt" error={fieldErrors?.startsAt}>
            <input
              ref={startsAtRef}
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              defaultValue={toSaoPauloInput(live?.startsAt)}
              className={fieldInputClass(!!fieldErrors?.startsAt)}
              required
            />
          </FormField>

          <FormField label="Link do YouTube" htmlFor="youtubeUrl" error={fieldErrors?.youtubeUrl}>
            <input
              id="youtubeUrl"
              name="youtubeUrl"
              type="url"
              placeholder="https://youtube.com/live/…"
              defaultValue={live?.youtubeUrl ?? ""}
              className={fieldInputClass(!!fieldErrors?.youtubeUrl)}
            />
            <p className="text-sm text-soft">
              Dá pra cadastrar antes do culto: quando a live é agendada no YouTube, o link já existe.
            </p>
          </FormField>

          <FormField label="Link do Spotify (opcional)" htmlFor="spotifyUrl" error={fieldErrors?.spotifyUrl}>
            <input
              id="spotifyUrl"
              name="spotifyUrl"
              type="url"
              placeholder="https://open.spotify.com/episode/…"
              defaultValue={live?.spotifyUrl ?? ""}
              className={fieldInputClass(!!fieldErrors?.spotifyUrl)}
            />
            <p className="text-sm text-soft">O episódio do culto no Spotify, se a igreja publicar o áudio.</p>
          </FormField>

          <FormField label="Tema ou pregador (opcional)" htmlFor="description" error={fieldErrors?.description}>
            <input
              id="description"
              name="description"
              placeholder="ex.: Pr. Fulano · Série Alicerce, parte 3"
              defaultValue={live?.description ?? ""}
              className={fieldInputClass(!!fieldErrors?.description)}
            />
          </FormField>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
            <input
              type="checkbox"
              name="visible"
              defaultChecked={live?.visible ?? true}
              className="mt-1 size-5 shrink-0 accent-ink"
            />
            <span>
              <span className="font-extrabold">Mostrar no site</span>
              <span className="block text-sm text-soft">Desmarque pra guardar só aqui no painel.</span>
            </span>
          </label>

          <DialogFooter>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar transmissão"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
